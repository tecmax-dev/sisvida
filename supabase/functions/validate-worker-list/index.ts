import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Somente as contribuições 124, 125 e 126 passam pela validação
const isAllowedType = (name: unknown) => /^\s*(124|125|126)\b/.test(String(name ?? ""));

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

function normName(s: unknown) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\/?A|MEI)\b/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt(p: { employerName: string; employerCnpj: string; typeName: string; competence: string }) {
  return `Você é um auditor sindical brasileiro. Analise o documento enviado por uma empresa e verifique se ele é uma RELAÇÃO/LISTA DE TRABALHADORES que tiveram contribuição sindical recolhida.

Dados do lançamento:
- Empresa: "${p.employerName}"
- CNPJ: "${p.employerCnpj}"
- Tipo de contribuição selecionado: "${p.typeName}"
- Competência: "${p.competence}"

Verifique:
1. Se o documento realmente contém uma relação de trabalhadores (nomes de pessoas, idealmente com CPF/matrícula).
2. Se o documento é legível e tem informações suficientes.
3. Qual empresa (razão social) e CNPJ aparecem no documento.
4. Se o tipo de contribuição aparece e se é compatível com o selecionado.
5. Competência/período e quantidade de trabalhadores.
6. Qualquer inconsistência.
Observação: listas de trabalhadores muitas vezes não informam o tipo de contribuição nem a competência; nesse caso use null em tipo_compativel e registre em inconsistencias, sem reprovar por isso. Marque tipo_compativel=false apenas se o documento indicar claramente OUTRO tipo de contribuição.

Responda SOMENTE com JSON, sem markdown:
{
  "e_relacao_trabalhadores": boolean,
  "legivel": boolean,
  "valido": boolean,
  "confianca": number (0 a 1),
  "empresa_identificada": string|null,
  "cnpj_identificado": string|null,
  "tipo_contribuicao_identificado": string|null,
  "tipo_compativel": boolean|null,
  "competencia": string|null,
  "quantidade_trabalhadores": number|null,
  "dados_extraidos": { "trabalhadores": [{ "nome": string, "cpf_ou_identificador": string|null }], "outros": object },
  "inconsistencias": string[],
  "motivo": string (resumo em português)
}`;
}

async function callOpenAI(prompt: string, base64: string, mime: string, fileName: string) {
  const dataUrl = `data:${mime};base64,${base64}`;
  const filePart =
    mime === "application/pdf"
      ? { type: "file", file: { filename: fileName || "lista.pdf", file_data: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl } };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: [{ type: "text", text: "Analise o documento e responda apenas com o JSON." }, filePart] },
      ],
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("[validate-worker-list] OpenAI error", res.status, raw.slice(0, 500));
    if (res.status === 429) throw new Error("Serviço de análise sobrecarregado. Tente novamente em instantes.");
    throw new Error("Não foi possível analisar o documento agora. Tente novamente.");
  }
  const content = JSON.parse(raw)?.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "");
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("A análise não retornou um resultado válido. Tente novamente.");
  return JSON.parse(cleaned.slice(s, e + 1));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!OPENAI_API_KEY) return json({ error: "Validação por IA não configurada." }, 200);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const { contribution_id, contribution_type_id, portal_type, portal_id, file_base64, file_name, mime_type } = body;

    // Painel "Envio de Listas" (Portal do Contador): lançamentos aguardando valor
    // de TODAS as empresas vinculadas + última validação de cada um.
    if (body.action === "portal_status") {
      if (portal_type !== "accounting_office" || !portal_id) return json({ error: "Sem permissão." }, 403);
      const { data: links } = await supabase.from("accounting_office_employers").select("employer_id").eq("accounting_office_id", portal_id);
      const employerIds = (links || []).map((l: any) => l.employer_id);
      if (employerIds.length === 0) return json({ employers: [], items: [] });
      const { data: emps } = await supabase.from("employers").select("id, name, trade_name, cnpj").in("id", employerIds).order("name");
      const items: any[] = [];
      for (let i = 0; i < employerIds.length; i += 200) {
        const { data: cs } = await supabase
          .from("employer_contributions")
          .select("id, employer_id, contribution_type_id, competence_month, competence_year, due_date, status, contribution_type:contribution_types(id, name)")
          .in("employer_id", employerIds.slice(i, i + 200))
          .eq("status", "awaiting_value")
          .order("competence_year", { ascending: false })
          .order("competence_month", { ascending: false })
          .order("id");
        items.push(...(cs || []).filter((c: any) => isAllowedType(c.contribution_type?.name)));
      }
      const ids = items.map((c) => c.id);
      const latest: Record<string, any> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data: vs } = await supabase
          .from("contribution_worker_list_validations")
          .select("id, contribution_id, status, reason, file_name, created_at, used_at, confidence, ai_result")
          .in("contribution_id", ids.slice(i, i + 200))
          .eq("portal_type", "accounting_office")
          .eq("portal_id", portal_id)
          .order("created_at", { ascending: false });
        for (const v of vs || []) if (!latest[v.contribution_id]) latest[v.contribution_id] = v;
      }
      const since = Date.now() - 24 * 60 * 60 * 1000;
      return json({
        employers: emps || [],
        items: items.map((c) => {
          const v = latest[c.id];
          return {
            ...c,
            validation: v
              ? {
                  id: v.id, status: v.status, reason: v.reason, file_name: v.file_name, created_at: v.created_at,
                  quantidade: v.ai_result?.quantidade_trabalhadores ?? null,
                  cnpj_identificado: v.ai_result?.cnpj_identificado ?? null,
                  usable: v.status === "valid" && !v.used_at && new Date(v.created_at).getTime() >= since,
                }
              : null,
          };
        }),
      });
    }

    if (!contribution_id || !portal_id || !["employer", "accounting_office"].includes(portal_type)) {
      return json({ error: "Dados do lançamento incompletos." }, 400);
    }
    if (body.action === "list_types") {
      const { data: c } = await supabase.from("employer_contributions").select("employer_id, clinic_id, contribution_type_id, employer:employers(clinic_id)").eq("id", contribution_id).maybeSingle();
      if (!c) return json({ error: "Contribuição não encontrada." }, 404);
      if (portal_type === "employer" && c.employer_id !== portal_id) return json({ error: "Sem permissão." }, 403);
      if (portal_type === "accounting_office") {
        const { data: l } = await supabase.from("accounting_office_employers").select("id").eq("accounting_office_id", portal_id).eq("employer_id", c.employer_id).maybeSingle();
        if (!l) return json({ error: "Sem permissão." }, 403);
      }
      const clinicId = (c.employer as any)?.clinic_id || c.clinic_id;
      const { data: types } = await supabase.from("contribution_types").select("id, name").eq("clinic_id", clinicId).eq("is_active", true).order("name");
      const allowed = (types || []).filter((t: any) => isAllowedType(t.name));
      return json({ types: allowed, default_type_id: c.contribution_type_id });
    }
    if (!contribution_type_id) return json({ error: "Selecione o tipo de contribuição." }, 400);
    if (!file_base64) return json({ error: "Envie a relação de trabalhadores." }, 400);
    const mime = String(mime_type || "").toLowerCase();
    if (!ALLOWED_MIME.includes(mime)) return json({ error: "Formato inválido. Envie PDF, JPG, JPEG ou PNG." }, 400);
    const bytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_BYTES) return json({ error: "Arquivo maior que 10 MB." }, 400);

    const { data: contribution } = await supabase
      .from("employer_contributions")
      .select("id, employer_id, clinic_id, status, contribution_type_id, competence_month, competence_year, employer:employers(id, name, trade_name, cnpj, clinic_id), contribution_type:contribution_types(id, name)")
      .eq("id", contribution_id)
      .maybeSingle();
    if (!contribution) return json({ error: "Contribuição não encontrada." }, 404);

    // Autorização do portal: a lista fica sempre vinculada à empresa do lançamento
    if (portal_type === "employer") {
      if (contribution.employer_id !== portal_id) return json({ error: "Sem permissão para este lançamento." }, 403);
    } else {
      const { data: link } = await supabase
        .from("accounting_office_employers")
        .select("id")
        .eq("accounting_office_id", portal_id)
        .eq("employer_id", contribution.employer_id)
        .maybeSingle();
      if (!link) return json({ error: "Sem permissão para este lançamento." }, 403);
    }
    if (contribution.status !== "awaiting_value") {
      return json({ error: "Esta contribuição não está aguardando valor." }, 400);
    }

    const { data: selectedType } = await supabase
      .from("contribution_types")
      .select("id, name")
      .eq("id", contribution_type_id)
      .maybeSingle();
    if (!selectedType || !isAllowedType(selectedType.name)) return json({ error: "Tipo de contribuição inválido." }, 400);

    const employer: any = contribution.employer;
    const competence = `${String(contribution.competence_month).padStart(2, "0")}/${contribution.competence_year}`;
    const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
    const filePath = `${contribution.employer_id}/${contribution.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("worker-lists").upload(filePath, bytes, { contentType: mime });
    if (upErr) {
      console.error("[validate-worker-list] upload", upErr);
      return json({ error: "Falha ao guardar o arquivo. Tente novamente." }, 200);
    }

    const ai = await callOpenAI(
      buildPrompt({ employerName: employer?.name || "", employerCnpj: employer?.cnpj || "", typeName: selectedType.name, competence }),
      file_base64,
      mime,
      file_name,
    );

    // Regras determinísticas (não dependem apenas da IA)
    const inconsistencias: string[] = Array.isArray(ai.inconsistencias) ? ai.inconsistencias.map(String) : [];
    const blocks: string[] = [];
    if (contribution.contribution_type_id && contribution.contribution_type_id !== selectedType.id) {
      blocks.push(`O tipo selecionado (${selectedType.name}) não corresponde ao tipo deste lançamento (${(contribution.contribution_type as any)?.name || "outro"}).`);
    }
    if (!ai.e_relacao_trabalhadores) blocks.push("O documento não é uma relação de trabalhadores.");
    if (ai.legivel === false) blocks.push("O documento está ilegível ou sem informações suficientes.");
    const docCnpj = digits(ai.cnpj_identificado);
    const empCnpj = digits(employer?.cnpj);
    if (docCnpj.length === 14 && empCnpj && docCnpj !== empCnpj) {
      blocks.push(`CNPJ do documento (${ai.cnpj_identificado}) diferente do CNPJ da empresa do lançamento.`);
    }
    if (docCnpj.length !== 14 && ai.empresa_identificada) {
      const a = normName(ai.empresa_identificada);
      const names = [normName(employer?.name), normName(employer?.trade_name)].filter(Boolean);
      const match = names.some((n) => n && (a.includes(n) || n.includes(a)));
      if (!match) blocks.push(`Empresa do documento (${ai.empresa_identificada}) diferente da empresa do lançamento.`);
    }
    if (ai.tipo_compativel === false) blocks.push("O tipo de contribuição do documento não é compatível com o selecionado.");
    const qtd = Number(ai.quantidade_trabalhadores);
    if (!qtd || qtd < 1) blocks.push("Nenhum trabalhador identificado no documento.");
    const confianca = Math.max(0, Math.min(1, Number(ai.confianca) || 0));
    if (confianca < 0.6) blocks.push("Confiança da análise insuficiente.");

    // ausência de tipo/competência no documento é registrada como inconsistência, não bloqueia
    const valido = blocks.length === 0;
    const allInconsistencies = [...blocks, ...inconsistencias.filter((i) => !blocks.includes(i))];
    const motivo = valido ? String(ai.motivo || "Relação validada.") : blocks[0] || String(ai.motivo || "Documento não validado.");

    const result = {
      valido,
      confianca,
      empresa_identificada: ai.empresa_identificada ?? null,
      cnpj_identificado: ai.cnpj_identificado ?? null,
      tipo_contribuicao_identificado: ai.tipo_contribuicao_identificado ?? null,
      competencia: ai.competencia ?? null,
      quantidade_trabalhadores: qtd || null,
      dados_extraidos: ai.dados_extraidos ?? null,
      inconsistencias: allInconsistencies,
      motivo,
    };

    const { data: row, error: insErr } = await supabase
      .from("contribution_worker_list_validations")
      .insert({
        clinic_id: employer?.clinic_id || contribution.clinic_id || null,
        employer_id: contribution.employer_id,
        contribution_id: contribution.id,
        contribution_type_id: selectedType.id,
        competence_month: contribution.competence_month,
        competence_year: contribution.competence_year,
        portal_type,
        portal_id,
        file_path: filePath,
        file_name: file_name || null,
        mime_type: mime,
        status: valido ? "valid" : "invalid",
        confidence: confianca,
        ai_result: ai,
        extracted_data: ai.dados_extraidos ?? null,
        inconsistencies: allInconsistencies,
        reason: motivo,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[validate-worker-list] insert", insErr);
      return json({ error: "Falha ao registrar a validação." }, 200);
    }

    return json({ success: true, validation_id: valido ? row.id : null, result });
  } catch (e: any) {
    console.error("[validate-worker-list] error", e);
    return json({ error: e?.message || "Erro ao validar a lista." }, 200);
  }
});
