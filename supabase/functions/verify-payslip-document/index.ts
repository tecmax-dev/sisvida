import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_base64, file_name, file_type, member_name } = await req.json();

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

    const isPdf = file_type === "application/pdf";

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

IMPORTANTE: Verifique se o contracheque contém pelo menos UM dos seguintes itens sindicais nos descontos:
1. **Mensalidade Sindical** (ou "Contrib. Sindical", "Mens. Sindical", "MENSALIDADE SINDICAL")
2. **Taxa Assistencial** (ou "Taxa Assist.", "Contrib. Assistencial")  
3. **Taxa Negocial** (ou "Taxa Negoc.", "Contrib. Negocial")

ATENÇÃO: Seja FLEXÍVEL na identificação. O documento pode ter diferentes layouts, fontes, qualidade de imagem ou formatação. Se você consegue identificar os elementos principais de um contracheque, considere-o válido.

Se o documento NÃO é um contracheque (por exemplo: foto pessoal, documento genérico, imagem aleatória, selfie, paisagem, etc.), retorne is_payslip como false.

Responda EXATAMENTE no formato JSON (sem markdown, sem backticks):
{"is_payslip": true ou false, "confidence": 0.0 a 1.0, "reason": "breve explicação", "name_match": true ou false, "name_found_in_document": "nome encontrado no documento ou null", "found_items": {"mensalidade_sindical": true ou false, "taxa_assistencial": true ou false, "taxa_negocial": true ou false}}

Se o documento é um contracheque mas NÃO contém nenhum dos itens sindicais listados, retorne is_payslip como false e explique quais itens estão faltando.
Se o nome no documento não corresponde ao nome do associado, retorne is_payslip como false.
Nome do arquivo: ${file_name}`;

    // Send the file as visual content - GPT-4o supports both images and PDFs via base64 data URL
    const imageContent = {
      type: "image_url" as const,
      image_url: { 
        url: file_base64,
        detail: "high" as const
      }
    };

    const messages: any[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          imageContent,
        ],
      },
    ];

    console.log("[verify-payslip] Sending to OpenAI for analysis...", { isPdf, file_name });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        max_tokens: 500,
        temperature: 0.1,
      }),
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

        if (isPayslip && confidence < 0.4) {
          isPayslip = false;
          reason = "Documento não reconhecido como contracheque com confiança suficiente.";
        }

        // Validate name match when member_name was provided
        if (isPayslip && member_name && !nameMatch) {
          isPayslip = false;
          reason = `O nome no contracheque (${nameFoundInDocument || "não identificado"}) não corresponde ao nome do associado (${member_name}).`;
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
      JSON.stringify({ is_payslip: isPayslip, message, found_items: foundItems, name_match: nameMatch, name_found_in_document: nameFoundInDocument }),
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
