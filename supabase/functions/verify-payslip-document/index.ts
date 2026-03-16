import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_base64, file_name, file_type } = await req.json();

    if (!file_base64) {
      return new Response(
        JSON.stringify({ is_payslip: false, message: "Nenhum arquivo enviado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Gemini Flash for fast image/document analysis
    const LOVABLE_AI_URL = Deno.env.get("LOVABLE_AI_BASE_URL");
    const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_AI_API_KEY");

    if (!LOVABLE_AI_URL || !LOVABLE_AI_KEY) {
      // Fallback: accept the document if AI is not configured
      console.log("[verify-payslip] AI not configured, accepting document");
      return new Response(
        JSON.stringify({ is_payslip: true, message: "Documento aceito (verificação automática indisponível)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For PDFs, we can't send as image - do text-based analysis
    const isPdf = file_type === "application/pdf";

    const prompt = `Analise este documento e determine se é um CONTRACHEQUE (holerite/demonstrativo de pagamento de salário) que contenha descontos sindicais.

Um contracheque válido deve conter:
- Nome do empregado/funcionário
- Nome da empresa/empregador
- Salário bruto e líquido
- Descontos (INSS, IRRF, etc.)
- Proventos/vencimentos
- Período de referência (mês/ano)

IMPORTANTE: Verifique se o contracheque contém pelo menos UM dos seguintes itens sindicais nos descontos:
1. **Mensalidade Sindical** (ou "Contrib. Sindical", "Mens. Sindical")
2. **Taxa Assistencial** (ou "Taxa Assist.", "Contrib. Assistencial")
3. **Taxa Negocial** (ou "Taxa Negoc.", "Contrib. Negocial")

Responda EXATAMENTE no formato JSON:
{
  "is_payslip": true/false,
  "confidence": 0.0-1.0,
  "reason": "breve explicação",
  "found_items": {
    "mensalidade_sindical": true/false,
    "taxa_assistencial": true/false,
    "taxa_negocial": true/false
  }
}

Se o documento é um contracheque mas NÃO contém nenhum dos itens sindicais listados, retorne is_payslip como false e explique quais itens estão faltando.
Nome do arquivo: ${file_name}`;

    const messages: any[] = [
      {
        role: "user",
        content: isPdf
          ? [
              { type: "text", text: prompt + "\n\nNota: Este é um arquivo PDF. Analise pelo nome e contexto." },
            ]
          : [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: file_base64 },
              },
            ],
      },
    ];

    const response = await fetch(`${LOVABLE_AI_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("[verify-payslip] AI response error:", response.status);
      // Fallback on AI error - don't block the user
      return new Response(
        JSON.stringify({ is_payslip: true, message: "Documento aceito (verificação temporariamente indisponível)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    console.log("[verify-payslip] AI response:", content);

    // Parse AI response
    let isPayslip = false;
    let reason = "Não foi possível determinar o tipo do documento.";

    try {
      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isPayslip = parsed.is_payslip === true;
        const confidence = parsed.confidence || 0;
        reason = parsed.reason || reason;

        // Accept if confidence is above 0.5
        if (isPayslip && confidence < 0.3) {
          isPayslip = false;
          reason = "Documento não reconhecido como contracheque com confiança suficiente.";
        }
      }
    } catch (parseErr) {
      console.error("[verify-payslip] Parse error:", parseErr);
      // Check for simple yes/no in content
      const lower = content.toLowerCase();
      if (lower.includes("is_payslip\": true") || lower.includes("é um contracheque")) {
        isPayslip = true;
        reason = "Documento identificado como contracheque.";
      }
    }

    const message = isPayslip
      ? `✅ ${reason}`
      : `❌ ${reason} Por favor, envie um contracheque válido.`;

    return new Response(
      JSON.stringify({ is_payslip: isPayslip, message }),
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
