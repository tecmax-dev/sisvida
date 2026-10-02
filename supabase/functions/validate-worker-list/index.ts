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

// Regras simplificadas: basta uma lista de nomes + identificação da empresa
// (nome, razão social OU CNPJ). O tipo de contribuição é o escolhido pelo usuário no envio.
function evaluateAi(ai: any, employer: any) {
  const inconsistencias: string[] = Array.isArray(ai.inconsistencias) ? ai.inconsistencias.map(String) : [];
  const blocks: string[] = [];
  if (!ai.e_relacao_trabalhadores) blocks.push("O documento não é uma relação de trabalhadores.");
  if (ai.legivel === false) blocks.push("O documento está ilegível ou sem informações suficientes.");
  const docCnpj = digits(ai.cnpj_identificado);
  const empCnpj = digits(employer?.cnpj);
  const cnpjMatch = docCnpj.length === 14 && !!empCnpj && docCnpj === empCnpj;
  const a = normName(ai.empresa_identificada);
  const names = [normName(employer?.name), normName(employer?.trade_name)].filter(Boolean);
  const nameMatch = !!a && names.some((n) => n && (a.includes(n) || n.includes(a)));
  if (docCnpj.length === 14 && empCnpj && docCnpj !== empCnpj && !nameMatch) {
    blocks.push(`CNPJ do documento (${ai.cnpj_identificado}) diferente do CNPJ da empresa do lançamento.`);
  } else if (!cnpjMatch && !nameMatch) {
    blocks.push(ai.empresa_identificada
      ? `Empresa do documento (${ai.empresa_identificada}) diferente da empresa do lançamento.`
      : "O documento não informa o nome, a razão social ou o CNPJ da empresa.");
  }
  const qtd = Number(ai.quantidade_trabalhadores);
  if (!qtd || qtd < 1) blocks.push("Nenhum trabalhador identificado no documento.");
  const confianca = Math.max(0, Math.min(1, Number(ai.confianca) || 0));
  if (confianca < 0.5) blocks.push("Confiança da análise insuficiente.");
  const valido = blocks.length === 0;
  const allInconsistencies = [...blocks, ...inconsistencias.filter((i) => !blocks.includes(i))];
  const motivo = valido ? String(ai.motivo || "Relação validada.") : blocks[0] || String(ai.motivo || "Documento não validado.");
  const result = {
    valido, confianca,
    empresa_identificada: ai.empresa_identificada ?? null,
    cnpj_identificado: ai.cnpj_identificado ?? null,
    tipo_contribuicao_identificado: ai.tipo_contribuicao_identificado ?? null,
    competencia: ai.competencia ?? null,
    quantidade_trabalhadores: qtd || null,
    dados_extraidos: ai.dados_extraidos ?? null,
    inconsistencias: allInconsistencies,
    motivo,
  };
  return { valido, confianca, allInconsistencies, motivo, result };
}

function escapeHtml(s: unknown) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, (c) => map[c]);
}

// Gera um documento HTML real (upload físico ao Storage) para listas montadas no editor do sistema,
// evitando registros com file_path fictício que não correspondem a nenhum arquivo existente.
function buildRosterHtml(p: { employerName: string; employerCnpj: string; typeName: string; competence: string; workers: { nome: string; cpf: string | null }[] }) {
  const rows = p.workers
    .map((w, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(w.nome)}</td><td>${escapeHtml(w.cpf || "")}</td></tr>`)
    .join("");
  const head = `<p><strong>Empresa:</strong> ${escapeHtml(p.employerName)}${p.employerCnpj ? ` — CNPJ ${escapeHtml(p.employerCnpj)}` : ""}</p><p><strong>Tipo de contribuição:</strong> ${escapeHtml(p.typeName)} ${p.competence ? `— Competência ${escapeHtml(p.competence)}` : ""}</p><p><strong>Total de trabalhadores:</strong> ${p.workers.length}</p>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relação de trabalhadores</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin-bottom:4px}p{margin:2px 0;color:#444;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:6px 8px;font-size:13px;text-align:left}th{background:#f3f3f3}</style></head><body><h1>Relação de trabalhadores</h1>${head}<table><thead><tr><th>#</th><th>Nome</th><th>CPF</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:24px;color:#888">Documento gerado automaticamente a partir da lista confirmada no sistema em ${new Date().toLocaleString("pt-BR")}.</p></body></html>`;
}

function buildPrompt(p: { employerName: string; employerCnpj: string; typeName: string; competence: string }) {
  return `Você é um auditor sindical brasileiro. Analise o documento enviado por uma empresa e verifique se ele é uma RELAÇÃO/LISTA DE TRABALHADORES que tiveram contribuição sindical recolhida.

Dados do lançamento:
- Empresa: "${p.employerName}"
- CNPJ: "${p.employerCnpj}"
- Tipo de contribuição selecionado: "${p.typeName}"
- Competência: "${p.competence}"

Verifique:
1. Se o documento contém uma lista de nomes de funcionários/trabalhadores (CPF/matrícula são opcionais).
2. Se o documento é legível.
3. Qual empresa aparece: basta o nome, a razão social, o nome fantasia OU o CNPJ (qualquer um deles é suficiente).
4. Competência/período (se houver) e quantidade de nomes de trabalhadores.
O tipo de contribuição é escolhido pelo usuário no envio: NÃO reprove por tipo ausente ou diferente; use null em tipo_compativel. Não reprove por falta de CPF, competência ou tipo.

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

Deno.serve(async (req) => {
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

    // Listas enviadas (histórico) visíveis no portal da empresa/contador
    if (body.action === "list_sent") {
      if (!portal_id || !["employer", "accounting_office"].includes(portal_type)) return json({ error: "Sem permissão." }, 403);
      let employerIds: string[] = [];
      if (portal_type === "employer") employerIds = [portal_id];
      else {
        const { data: links } = await supabase.from("accounting_office_employers").select("employer_id").eq("accounting_office_id", portal_id);
        employerIds = (links || []).map((l: any) => l.employer_id);
      }
      if (body.employer_id) employerIds = employerIds.filter((id) => id === body.employer_id);
      if (employerIds.length === 0) return json({ lists: [] });
      const lists: any[] = [];
      const empNames: Record<string, string> = {};
      for (let i = 0; i < employerIds.length; i += 200) {
        const { data: es } = await supabase.from("employers").select("id, name, trade_name").in("id", employerIds.slice(i, i + 200));
        for (const e of es || []) empNames[e.id] = e.trade_name || e.name;
      }
      for (let i = 0; i < employerIds.length; i += 200) {
        const { data: vs } = await supabase
          .from("contribution_worker_list_validations")
          .select("id, employer_id, status, reason, file_name, created_at, portal_type, competence_month, competence_year, ai_result, contribution_type:contribution_types(name)")
          .in("employer_id", employerIds.slice(i, i + 200))
          .order("created_at", { ascending: false })
          .limit(1000);
        lists.push(...(vs || []).map((v: any) => ({
          id: v.id, employer_id: v.employer_id, status: v.status, reason: v.reason, file_name: v.file_name,
          created_at: v.created_at, origin: v.portal_type, competence_month: v.competence_month, competence_year: v.competence_year,
          quantidade: v.ai_result?.quantidade_trabalhadores ?? null,
          type_name: v.contribution_type?.name ?? null,
          employer_name: empNames[v.employer_id] || null,
        })));
      }
      return json({ lists });
    }

    // Link temporário (1h) para visualizar o documento de uma validação,
    // com a mesma checagem de permissão do portal.
    if (body.action === "get_file_url") {
      const validationId = body.validation_id;
      if (!validationId || !portal_id) return json({ error: "Dados incompletos." }, 400);
      const { data: v } = await supabase
        .from("contribution_worker_list_validations")
        .select("id, employer_id, file_path, file_name, mime_type, extracted_data")
        .eq("id", validationId)
        .maybeSingle();
      if (!v) return json({ error: "Validação não encontrada." }, 404);
      if (portal_type === "employer" && v.employer_id !== portal_id) return json({ error: "Sem permissão." }, 403);
      if (portal_type === "accounting_office") {
        const { data: l } = await supabase.from("accounting_office_employers").select("id").eq("accounting_office_id", portal_id).eq("employer_id", v.employer_id).maybeSingle();
        if (!l) return json({ error: "Sem permissão." }, 403);
      }
      // Registros antigos (anteriores a esta correção) foram salvos com um file_path
      // fictício e sem mime_type, sem nenhum arquivo físico no Storage — para esses,
      // devolvemos a relação de nomes já extraída em vez de tentar abrir um arquivo inexistente.
      if (!v.file_path || (!v.mime_type && v.file_path.startsWith("roster/"))) {
        const workers = (v.extracted_data as any)?.trabalhadores || [];
        return json({ roster: true, workers, file_name: v.file_name || "Lista de trabalhadores" });
      }
      const { data: s, error: sErr } = await supabase.storage.from("worker-lists").createSignedUrl(v.file_path, 3600);
      if (sErr || !s?.signedUrl) {
        // Autocorreção: se mesmo tendo file_path o arquivo não existe mais no bucket,
        // cai para a relação de nomes (quando disponível) em vez de bloquear o usuário.
        const workers = (v.extracted_data as any)?.trabalhadores || [];
        if (workers.length > 0) return json({ roster: true, workers, file_name: v.file_name || "Lista de trabalhadores" });
        return json({ error: "Não foi possível abrir o arquivo." }, 200);
      }
      return json({ url: s.signedUrl, file_name: v.file_name, mime_type: v.mime_type });
    }

    // ===== Lista de nomes (cadastro de trabalhadores por empresa) =====
    // Gestores do sindicato: reprocessar pela IA ou aprovar manualmente uma lista
    if (body.action === "staff_reprocess" || body.action === "staff_approve" || body.action === "staff_import_names") {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      const { data: u } = await supabase.auth.getUser(token);
      if (!u?.user) return json({ error: "Sessão expirada. Entre novamente." }, 401);
      const { data: v } = await supabase.from("contribution_worker_list_validations")
        .select("id, clinic_id, employer_id, file_path, mime_type, file_name, contribution_type_id, competence_month, competence_year, ai_result, extracted_data")
        .eq("id", String(body.validation_id || "")).maybeSingle();
      if (!v) return json({ error: "Lista não encontrada." }, 404);
      const [{ data: sa }, { data: roles }] = await Promise.all([
        supabase.from("super_admins").select("id").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("clinic_id", v.clinic_id).in("role", ["owner", "admin"]),
      ]);
      if (!sa && !(roles || []).length) return json({ error: "Apenas gestores podem fazer isso." }, 403);

      // Importar nomes do arquivo enviado para o cadastro de trabalhadores da empresa
      if (body.action === "staff_import_names") {
        let list: any[] = (v.extracted_data as any)?.trabalhadores || [];
        if ((!list || list.length === 0) && v.file_path && !String(v.file_path).startsWith("roster/")) {
          const { data: f } = await supabase.storage.from("worker-lists").download(v.file_path);
          if (!f) return json({ error: "Arquivo da lista não encontrado." }, 200);
          const buf = new Uint8Array(await f.arrayBuffer());
          let bin = ""; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
          try {
            const ai = await callOpenAI(
              'Extraia todos os nomes de trabalhadores do documento. Responda SOMENTE JSON: {"trabalhadores":[{"nome":string,"cpf_ou_identificador":string|null}]}',
              btoa(bin), v.mime_type || "application/pdf", v.file_name || "lista.pdf");
            list = ai?.trabalhadores || [];
            await supabase.from("contribution_worker_list_validations").update({ extracted_data: { ...((v.extracted_data as any) || {}), trabalhadores: list } }).eq("id", v.id);
          } catch (e) { console.error("[staff_import_names]", e); return json({ error: "Não foi possível ler os nomes do arquivo." }, 200); }
        }
        const nk = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
        const seen = new Map<string, any>();
        for (const t of list || []) {
          const name = String(t?.nome || "").trim().slice(0, 150); const k = nk(name);
          if (k.length < 3 || seen.has(k)) continue;
          const cpf = digits(t?.cpf_ou_identificador);
          seen.set(k, { clinic_id: v.clinic_id, employer_id: v.employer_id, name, name_norm: k, cpf: cpf.length === 11 ? cpf : null, active: true });
        }
        if (seen.size === 0) return json({ error: "Nenhum nome encontrado no arquivo." }, 200);
        if (!v.contribution_type_id) return json({ error: "Defina o tipo de contribuição da lista antes de importar os nomes." }, 200);
        seen.forEach((r) => { r.contribution_type_id = v.contribution_type_id; });
        const keys = Array.from(seen.keys());
        const existing = new Set<string>();
        for (let i = 0; i < keys.length; i += 300) {
          const { data: ws } = await supabase.from("employer_workers").select("name_norm").eq("employer_id", v.employer_id).eq("contribution_type_id", v.contribution_type_id).in("name_norm", keys.slice(i, i + 300));
          (ws || []).forEach((w: any) => existing.add(w.name_norm));
        }
        const rows = Array.from(seen.entries()).filter(([k]) => !existing.has(k)).map(([, r]) => r);
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from("employer_workers").insert(rows.slice(i, i + 500));
          if (error) { console.error(error); return json({ error: "Falha ao salvar os nomes." }, 200); }
        }
        return json({ success: true, found: seen.size, added: rows.length, skipped: seen.size - rows.length });
      }

      // Ajuste opcional de tipo/competência (via lançamento da empresa)
      if (body.contribution_id) {
        const { data: c } = await supabase.from("employer_contributions")
          .select("id, employer_id, contribution_type_id, competence_month, competence_year, contribution_type:contribution_types(name)")
          .eq("id", String(body.contribution_id)).maybeSingle();
        if (!c || c.employer_id !== v.employer_id) return json({ error: "Competência inválida para esta empresa." }, 400);
        if (!isAllowedType((c as any).contribution_type?.name)) return json({ error: "Tipo de contribuição não aceito." }, 400);
        const { error: upErr } = await supabase.from("contribution_worker_list_validations").update({
          contribution_id: c.id, contribution_type_id: c.contribution_type_id, competence_month: c.competence_month, competence_year: c.competence_year,
        }).eq("id", v.id);
        if (upErr) return json({ error: "Não foi possível alterar tipo/competência." }, 200);
        v.contribution_type_id = c.contribution_type_id; v.competence_month = c.competence_month; v.competence_year = c.competence_year;
      }

      if (body.action === "staff_approve") {
        const note = String(body.note || "").trim().slice(0, 300);
        const { error } = await supabase.from("contribution_worker_list_validations").update({
          status: "valid",
          reason: `Aprovada manualmente por gestor${note ? `: ${note}` : "."}`,
          ai_result: { ...(v.ai_result || {}), aprovacao_manual: { user_id: u.user.id, email: u.user.email, at: new Date().toISOString(), note } },
        }).eq("id", v.id);
        if (error) return json({ error: "Não foi possível aprovar a lista." }, 200);
        return json({ success: true });
      }

      // Reprocessar
      if (v.ai_result?.origem === "lista_montada") return json({ error: "Lista montada no sistema não precisa ser reprocessada." }, 200);
      const { data: file, error: dErr } = await supabase.storage.from("worker-lists").download(v.file_path);
      if (dErr || !file) return json({ error: "Arquivo da lista não encontrado." }, 200);
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const b64 = btoa(bin);
      const mimeR = v.mime_type || (/\.pdf$/i.test(v.file_path) ? "application/pdf" : /\.png$/i.test(v.file_path) ? "image/png" : "image/jpeg");
      const [{ data: emp }, { data: tp }] = await Promise.all([
        supabase.from("employers").select("name, trade_name, cnpj").eq("id", v.employer_id).maybeSingle(),
        v.contribution_type_id ? supabase.from("contribution_types").select("name").eq("id", v.contribution_type_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const competence = v.competence_month ? `${String(v.competence_month).padStart(2, "0")}/${v.competence_year}` : "";
      const ai = await callOpenAI(
        buildPrompt({ employerName: emp?.name || "", employerCnpj: emp?.cnpj || "", typeName: (tp as any)?.name || "", competence }),
        b64, mimeR, v.file_name,
      );
      const ev = evaluateAi(ai, emp);
      const { error } = await supabase.from("contribution_worker_list_validations").update({
        status: ev.valido ? "valid" : "invalid",
        confidence: ev.confianca,
        ai_result: ai,
        extracted_data: ai.dados_extraidos ?? null,
        inconsistencies: ev.allInconsistencies,
        reason: ev.motivo,
      }).eq("id", v.id);
      if (error) return json({ error: "Não foi possível salvar o reprocessamento." }, 200);
      return json({ success: true, result: ev.result });
    }

    if (typeof body.action === "string" && body.action.startsWith("roster_")) {
      let employerId = String(body.employer_id || "");
      if (!employerId && body.contribution_id) {
        const { data: cc } = await supabase.from("employer_contributions").select("employer_id").eq("id", body.contribution_id).maybeSingle();
        employerId = cc?.employer_id || "";
      }
      if (!employerId) return json({ error: "Empresa não informada." }, 400);
      const { data: emp } = await supabase.from("employers").select("id, clinic_id, name, trade_name, cnpj").eq("id", employerId).maybeSingle();
      if (!emp) return json({ error: "Empresa não encontrada." }, 404);
      // Autorização
      if (portal_type === "employer") {
        if (portal_id !== employerId) return json({ error: "Sem permissão." }, 403);
      } else if (portal_type === "accounting_office") {
        const { data: l } = await supabase.from("accounting_office_employers").select("id").eq("accounting_office_id", portal_id).eq("employer_id", employerId).maybeSingle();
        if (!l) return json({ error: "Sem permissão." }, 403);
      } else if (portal_type === "staff") {
        const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
        const { data: u } = await supabase.auth.getUser(token);
        if (!u?.user) return json({ error: "Sessão expirada." }, 401);
        const { data: ok } = await supabase.rpc("has_clinic_access", { _user_id: u.user.id, _clinic_id: emp.clinic_id });
        if (!ok) return json({ error: "Sem permissão." }, 403);
      } else return json({ error: "Sem permissão." }, 403);

      const nameKey = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

      if (body.action === "roster_get") {
        const { data: workers } = await supabase.from("employer_workers").select("id, name, cpf, active, inactive_reason, inactive_note, contribution_type_id").eq("employer_id", employerId).order("name").limit(5000);
        const { data: items } = await supabase.from("employer_worker_roster_items")
          .select("worker_id, contribution_id, competence_month, competence_year, contribution_type:contribution_types(name)")
          .eq("employer_id", employerId).limit(20000);
        const { data: contribs } = await supabase.from("employer_contributions")
          .select("id, competence_month, competence_year, status, contribution_type_id, contribution_type:contribution_types(name)")
          .eq("employer_id", employerId).in("status", ["awaiting_value", "pending", "overdue", "paid"])
          .order("competence_year", { ascending: false }).order("competence_month", { ascending: false }).limit(60);
        return json({
          workers: workers || [],
          items: (items || []).map((i: any) => ({ ...i, type_name: i.contribution_type?.name ?? null })),
          contributions: (contribs || []).filter((c: any) => isAllowedType(c.contribution_type?.name))
            .map((c: any) => ({ id: c.id, competence_month: c.competence_month, competence_year: c.competence_year, status: c.status, contribution_type_id: c.contribution_type_id, type_name: c.contribution_type?.name ?? null })),
        });
      }

      if (body.action === "roster_import") {
        // Extrai nomes das listas validadas (usa o que a IA já leu; se faltar, lê o arquivo)
        // Só listas do mesmo tipo de contribuição (não misturar Mensalidade e Taxa Negocial)
        let importType = String(body.contribution_type_id || "");
        if (!importType && body.contribution_id) {
          const { data: ct } = await supabase.from("employer_contributions").select("contribution_type_id").eq("id", body.contribution_id).maybeSingle();
          importType = ct?.contribution_type_id || "";
        }
        if (!importType) return json({ error: "Escolha a competência (tipo de contribuição) antes de importar." }, 200);
        const { data: vs } = await supabase.from("contribution_worker_list_validations")
          .select("id, file_path, file_name, mime_type, extracted_data")
          .eq("employer_id", employerId).eq("contribution_type_id", importType).eq("status", "valid").not("file_path", "like", "roster/%")
          .order("created_at", { ascending: false }).limit(12);
        const seen = new Map<string, { nome: string; cpf: string | null }>();
        let aiCalls = 0;
        for (const v of vs || []) {
          let list: any[] = (v.extracted_data as any)?.trabalhadores || [];
          if ((!list || list.length === 0) && v.file_path && aiCalls < 3 && OPENAI_API_KEY) {
            aiCalls++;
            const { data: f } = await supabase.storage.from("worker-lists").download(v.file_path);
            if (f) {
              const buf = new Uint8Array(await f.arrayBuffer());
              let bin = ""; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
              try {
                const ai = await callOpenAI(
                  'Extraia todos os nomes de trabalhadores do documento. Responda SOMENTE JSON: {"trabalhadores":[{"nome":string,"cpf_ou_identificador":string|null}]}',
                  btoa(bin), v.mime_type || "application/pdf", v.file_name || "lista.pdf");
                list = ai?.trabalhadores || [];
                await supabase.from("contribution_worker_list_validations").update({ extracted_data: { trabalhadores: list } }).eq("id", v.id);
              } catch (e) { console.error("[roster_import]", e); }
            }
          }
          for (const t of list || []) {
            const nome = String(t?.nome || "").trim(); const k = nameKey(nome);
            if (k.length < 3 || seen.has(k)) continue;
            const cpf = digits(t?.cpf_ou_identificador); seen.set(k, { nome, cpf: cpf.length === 11 ? cpf : null });
          }
        }
        return json({ names: Array.from(seen.values()).sort((a, b) => a.nome.localeCompare(b.nome)) });
      }

      if (body.action === "roster_save") {
        const names: any[] = Array.isArray(body.names) ? body.names.slice(0, 3000) : [];
        const contribId = String(body.contribution_id || "");
        const REASONS = ["Férias", "Licença INSS", "Demissão", "Outros"];
        const all = new Map<string, { name: string; cpf: string | null; active: boolean; reason: string | null; note: string | null }>();
        for (const n of names) {
          const name = String(n?.nome ?? n?.name ?? "").trim().slice(0, 150); const k = nameKey(name);
          if (k.length < 3 || all.has(k)) continue;
          const cpf = digits(n?.cpf);
          const active = n?.active !== false;
          const reason = active ? null : (REASONS.includes(n?.inactive_reason) ? n.inactive_reason : null);
          const note = active ? null : (String(n?.inactive_note || "").trim().slice(0, 300) || null);
          if (!active && !reason) return json({ error: `Informe o motivo da desativação de ${name}.` }, 200);
          if (!active && reason === "Outros" && !note) return json({ error: `Descreva o motivo da desativação de ${name}.` }, 200);
          all.set(k, { name, cpf: cpf.length === 11 ? cpf : null, active, reason, note });
        }
        const clean = new Map(Array.from(all.entries()).filter(([, v]) => v.active));
        if (!contribId) return json({ error: "Escolha a competência." }, 200);
        const { data: ctype } = await supabase.from("employer_contributions").select("contribution_type_id, employer_id").eq("id", contribId).maybeSingle();
        if (!ctype || ctype.employer_id !== employerId || !ctype.contribution_type_id) return json({ error: "Competência inválida." }, 400);
        const typeId = ctype.contribution_type_id;
        // Cadastro único por empresa (sem repetir nomes)
        // Nomes nunca são excluídos: só ativados/desativados com motivo
        const rows = Array.from(all.entries()).map(([k, v]) => ({
          clinic_id: emp.clinic_id, employer_id: employerId, name: v.name, name_norm: k, cpf: v.cpf, contribution_type_id: typeId,
          active: v.active, inactive_reason: v.reason, inactive_note: v.note, inactive_at: v.active ? null : new Date().toISOString(),
        }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from("employer_workers").upsert(rows.slice(i, i + 500), { onConflict: "employer_id,contribution_type_id,name_norm" });
          if (error) { console.error(error); return json({ error: "Falha ao salvar os nomes." }, 200); }
        }
        if (!contribId) return json({ success: true, saved: rows.length });
        if (clean.size === 0) return json({ error: "Deixe pelo menos 1 trabalhador ativo." }, 200);

        const { data: c } = await supabase.from("employer_contributions")
          .select("id, employer_id, contribution_type_id, competence_month, competence_year, contribution_type:contribution_types(name)")
          .eq("id", contribId).maybeSingle();
        if (!c || c.employer_id !== employerId) return json({ error: "Competência inválida." }, 400);
        if (!isAllowedType((c as any).contribution_type?.name)) return json({ error: "Tipo de contribuição não aceito." }, 400);

        const keys = Array.from(clean.keys());
        const ids: string[] = [];
        for (let i = 0; i < keys.length; i += 300) {
          const { data: ws } = await supabase.from("employer_workers").select("id").eq("employer_id", employerId).eq("contribution_type_id", typeId).in("name_norm", keys.slice(i, i + 300));
          ids.push(...(ws || []).map((w: any) => w.id));
        }
        await supabase.from("employer_worker_roster_items").delete().eq("contribution_id", contribId);
        const origin = portal_type;
        const items = ids.map((wid) => ({
          clinic_id: emp.clinic_id, employer_id: employerId, contribution_id: contribId, contribution_type_id: c.contribution_type_id,
          competence_month: c.competence_month, competence_year: c.competence_year, worker_id: wid, origin,
        }));
        for (let i = 0; i < items.length; i += 500) await supabase.from("employer_worker_roster_items").insert(items.slice(i, i + 500));

        // Registro de envio da competência (portais: libera o VALOR pelas regras existentes)
        const actorId = portal_type === "staff" ? (await supabase.auth.getUser((req.headers.get("Authorization") || "").replace("Bearer ", ""))).data.user?.id : portal_id;

        // Gera um documento REAL (HTML) com a relação de nomes e envia ao Storage,
        // para que "Ver" sempre encontre um arquivo físico (nunca mais file_path fictício).
        const competenceStr = `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`;
        const rosterWorkers = Array.from(clean.values()).map((x) => ({ nome: x.name, cpf: x.cpf }));
        const html = buildRosterHtml({
          employerName: emp.trade_name || emp.name || "",
          employerCnpj: emp.cnpj || "",
          typeName: (c as any).contribution_type?.name || "",
          competence: competenceStr,
          workers: rosterWorkers,
        });
        const rosterPath = `roster/${contribId}/${Date.now()}.html`;
        const { error: upErr } = await supabase.storage.from("worker-lists").upload(rosterPath, new TextEncoder().encode(html), { contentType: "text/html" });
        if (upErr) { console.error("[roster_save] upload", upErr); return json({ error: "Falha ao gerar o documento da lista." }, 200); }

        const { data: v, error: vErr } = await supabase.from("contribution_worker_list_validations").insert({
          clinic_id: emp.clinic_id, employer_id: employerId, contribution_id: contribId, contribution_type_id: c.contribution_type_id,
          competence_month: c.competence_month, competence_year: c.competence_year, portal_type, portal_id: actorId,
          file_path: rosterPath, file_name: "Relação de trabalhadores.html", mime_type: "text/html",
          status: "valid", confidence: 1,
          ai_result: { quantidade_trabalhadores: ids.length, origem: "lista_montada" },
          extracted_data: { trabalhadores: rosterWorkers.map((x) => ({ nome: x.nome, cpf_ou_identificador: x.cpf })) },
          reason: "Lista de nomes confirmada no sistema.",
        }).select("id").single();
        if (vErr) { console.error(vErr); return json({ error: "Falha ao registrar a lista." }, 200); }
        return json({ success: true, validation_id: v.id, total: ids.length });
      }
      return json({ error: "Ação inválida." }, 400);
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
    // Reaproveita somente validação do MESMO lançamento/empresa/portal (válida, não usada, 24h)
    if (body.action === "latest_valid") {
      const { data: c } = await supabase.from("employer_contributions").select("employer_id").eq("id", contribution_id).maybeSingle();
      if (!c) return json({ validation: null });
      if (portal_type === "employer" && c.employer_id !== portal_id) return json({ error: "Sem permissão." }, 403);
      if (portal_type === "accounting_office") {
        const { data: l } = await supabase.from("accounting_office_employers").select("id").eq("accounting_office_id", portal_id).eq("employer_id", c.employer_id).maybeSingle();
        if (!l) return json({ error: "Sem permissão." }, 403);
      }
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: v } = await supabase
        .from("contribution_worker_list_validations")
        .select("id, contribution_type_id, reason, confidence, ai_result, file_name")
        .eq("contribution_id", contribution_id).eq("employer_id", c.employer_id)
        .eq("portal_type", portal_type).eq("portal_id", portal_id)
        .eq("status", "valid").is("used_at", null).gte("created_at", sinceIso)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return json({ validation: v || null });
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

    const { valido, confianca, allInconsistencies, motivo, result } = evaluateAi(ai, employer);

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
