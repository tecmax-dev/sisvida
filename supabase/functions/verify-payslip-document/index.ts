import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getPayslipAcceptanceDays(clinicId?: string): Promise<number> {
  if (!clinicId) return 60; // default
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("clinics")
      .select("payslip_acceptance_days")
      .eq("id", clinicId)
      .single();
    if (data?.payslip_acceptance_days !== null && data?.payslip_acceptance_days !== undefined) {
      return data.payslip_acceptance_days;
    }
  } catch (e) {
    console.error("[verify-payslip] Error fetching acceptance days:", e);
  }
  return 60;
}

function buildCompetencePrompt(acceptanceDays: number, currentMonth: number, currentYear: number): string {
  if (acceptanceDays === 0) {
    return `Identifique o mês/ano de competência (período de referência) do contracheque.
Extraia o mês e ano de competência do documento e retorne nos campos "competence_month" (1-12) e "competence_year" (YYYY).
Não há restrição de prazo para a competência do contracheque.`;
  }
  const monthsBack = Math.ceil(acceptanceDays / 30);
  let minMonth = currentMonth - monthsBack;
  let minYear = currentYear;
  while (minMonth < 1) {
    minMonth += 12;
    minYear -= 1;
  }
  return `Identifique o mês/ano de competência (período de referência) do contracheque.
Extraia o mês e ano de competência do documento e retorne nos campos "competence_month" (1-12) e "competence_year" (YYYY).
NÃO valide se a competência está dentro do prazo — apenas extraia o mês e ano. A validação de prazo será feita pelo sistema automaticamente.
Para referência: o mês mínimo aceito é ${String(minMonth).padStart(2, '0')}/${minYear} (inclusive).`;
}

function validateCompetence(
  compMonth: number,
  compYear: number,
  acceptanceDays: number,
  currentMonth: number,
  currentYear: number
): { valid: boolean; reason?: string } {
  if (acceptanceDays === 0) return { valid: true };

  const monthsBack = Math.ceil(acceptanceDays / 30);
  let minMonth = currentMonth - monthsBack;
  let minYear = currentYear;
  while (minMonth < 1) {
    minMonth += 12;
    minYear -= 1;
  }

  const compDate = compYear * 12 + compMonth;
  const minDate = minYear * 12 + minMonth;

  if (compDate < minDate) {
    return {
      valid: false,
      reason: `Contracheque com competência ${String(compMonth).padStart(2, '0')}/${compYear} está fora do prazo. Aceitamos apenas contracheques a partir de ${String(minMonth).padStart(2, '0')}/${minYear}.`,
    };
  }
  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_base64, file_name, file_type, member_name, clinic_id } = await req.json();

    if (!file_base64) {
      return new Response(
        JSON.stringify({ is_payslip: false, message: "Nenhum arquivo enviado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[verify-payslip] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ is_payslip: false, message: "Verificação indisponível. Contate o administrador." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const acceptanceDays = await getPayslipAcceptanceDays(clinic_id);
    console.log("[verify-payslip] Acceptance days:", acceptanceDays);

    const isPdf = file_type === "application/pdf";
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const competencePrompt = buildCompetencePrompt(acceptanceDays, currentMonth, currentYear);

    const prompt = `Analise este documento e determine se é um CONTRACHEQUE (holerite/demonstrativo de pagamento de salário).

Um contracheque válido GERALMENTE contém alguns destes elementos (não precisa ter todos):
- Nome do empregado/funcionário
- Nome da empresa/empregador  
- Valores de salário/vencimentos
- Descontos (INSS, IRRF, vale transporte, etc.)
- Período de referência (mês/ano)

IMPORTANTE - VALIDAÇÃO DO NOME:
O nome do associado/titular é: "${member_name || "NÃO INFORMADO"}"
${member_name ? `Verifique se o nome que aparece no contracheque como EMPREGADO/FUNCIONÁRIO corresponde (total ou parcialmente) ao nome "${member_name}". Considere que o nome pode estar abreviado, em ordem diferente, ou parcialmente visível. Se houver correspondência parcial significativa (ex: pelo menos nome e sobrenome), considere como match. Se o nome no documento for COMPLETAMENTE diferente do nome do associado, retorne is_payslip como false.` : ""}

IMPORTANTE - VALIDAÇÃO DA COMPETÊNCIA/MÊS DE REFERÊNCIA:
A data atual é: ${String(currentMonth).padStart(2, '0')}/${currentYear}
${competencePrompt}

IMPORTANTE: Verifique se o contracheque contém pelo menos UM dos seguintes itens sindicais nos descontos:
1. **Mensalidade Sindical** (ou "Contrib. Sindical", "Mens. Sindical", "MENSALIDADE SINDICAL")
2. **Taxa Assistencial** (ou "Taxa Assist.", "Contrib. Assistencial")  
3. **Taxa Negocial** (ou "Taxa Negoc.", "Contrib. Negocial")

ATENÇÃO: Seja FLEXÍVEL na identificação. O documento pode ter diferentes layouts, fontes, qualidade de imagem ou formatação. Se você consegue identificar os elementos principais de um contracheque, considere-o válido.

Se o documento NÃO é um contracheque (por exemplo: foto pessoal, documento genérico, imagem aleatória, selfie, paisagem, etc.), retorne is_payslip como false.

Responda EXATAMENTE no formato JSON (sem markdown, sem backticks):
{"is_payslip": true ou false, "confidence": 0.0 a 1.0, "reason": "breve explicação", "name_match": true ou false, "name_found_in_document": "nome encontrado no documento ou null", "competence_month": número 1-12 ou null, "competence_year": número YYYY ou null, "found_items": {"mensalidade_sindical": true ou false, "taxa_assistencial": true ou false, "taxa_negocial": true ou false}}

Se o documento é um contracheque mas NÃO contém nenhum dos itens sindicais listados, retorne is_payslip como false e explique quais itens estão faltando.
Se o nome no documento não corresponde ao nome do associado, retorne is_payslip como false.
NÃO rejeite o contracheque por causa da competência/data — o sistema validará isso automaticamente.
Nome do arquivo: ${file_name}`;

    const imageContent = {
      type: "image_url" as const,
      image_url: { url: file_base64, detail: "high" as const },
    };

    const messages: any[] = [
      { role: "user", content: [{ type: "text", text: prompt }, imageContent] },
    ];

    console.log("[verify-payslip] Sending to OpenAI for analysis...", { isPdf, file_name, acceptanceDays });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 500, temperature: 0.1 }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[verify-payslip] OpenAI error:", response.status, errText);
      return new Response(
        JSON.stringify({ is_payslip: false, message: "Erro na verificação do documento. Tente novamente." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    console.log("[verify-payslip] AI response:", content);

    let isPayslip = false;
    let reason = "Não foi possível determinar o tipo do documento.";
    let foundItems = { mensalidade_sindical: false, taxa_assistencial: false, taxa_negocial: false };
    let nameMatch = false;
    let nameFoundInDocument: string | null = null;
    let competenceMonth: number | null = null;
    let competenceYear: number | null = null;

    try {
      const jsonMatch = content.match(/\{[\s\S]*"is_payslip"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isPayslip = parsed.is_payslip === true;
        const confidence = parsed.confidence || 0;
        reason = parsed.reason || reason;
        nameMatch = !!parsed.name_match;
        nameFoundInDocument = parsed.name_found_in_document || null;

        if (parsed.found_items) {
          foundItems = {
            mensalidade_sindical: !!parsed.found_items.mensalidade_sindical,
            taxa_assistencial: !!parsed.found_items.taxa_assistencial,
            taxa_negocial: !!parsed.found_items.taxa_negocial,
          };
        }

        if (parsed.competence_month) competenceMonth = parseInt(parsed.competence_month) || null;
        if (parsed.competence_year) competenceYear = parseInt(parsed.competence_year) || null;

        if (isPayslip && confidence < 0.4) {
          isPayslip = false;
          reason = "Documento não reconhecido como contracheque com confiança suficiente.";
        }

        if (isPayslip && member_name && !nameMatch) {
          isPayslip = false;
          reason = `O nome no contracheque (${nameFoundInDocument || "não identificado"}) não corresponde ao nome do associado (${member_name}).`;
        }

        // Validate competence using configurable acceptance days
        if (isPayslip && parsed.competence_month && parsed.competence_year) {
          const result = validateCompetence(
            parseInt(parsed.competence_month),
            parseInt(parsed.competence_year),
            acceptanceDays,
            currentMonth,
            currentYear
          );
          if (!result.valid) {
            isPayslip = false;
            reason = result.reason!;
          }
        }
      }
    } catch (parseErr) {
      console.error("[verify-payslip] Parse error:", parseErr);
      isPayslip = false;
      reason = "Não foi possível analisar o documento. Envie uma imagem mais nítida.";
    }

    const message = isPayslip
      ? `✅ ${reason}`
      : `❌ ${reason} Por favor, envie um contracheque válido com os descontos sindicais.`;

    return new Response(
      JSON.stringify({ is_payslip: isPayslip, message, found_items: foundItems, name_match: nameMatch, name_found_in_document: nameFoundInDocument, competence_month: competenceMonth, competence_year: competenceYear }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[verify-payslip] Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ is_payslip: false, message: `Erro na verificação: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
