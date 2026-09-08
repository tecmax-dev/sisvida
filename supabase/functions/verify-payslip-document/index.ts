import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const SYSTEM_PROMPT = (member_name: string, employer_name: string, employer_cnpj: string) => `Você é um especialista em análise de contracheques sindicais brasileiros (Holerites).
Seu objetivo é verificar se a imagem enviada é um contracheque válido e se contém os descontos sindicais obrigatórios.

Critérios de validação:
1. Identificar se o documento é um Holerite/Contracheque.
2. Procurar por rubricas/descrições como: "Mensalidade Sindical", "Contribuição Sindical", "Taxa Assistencial", "Taxa Negocial", "Contribuição Assistencial", ou variações destes nomes.
3. Verificar se o nome do funcionário no documento é compatível com: "${member_name}".
4. Verificar se a empresa ou CNPJ no documento é compatível com: "${employer_name}" ou "${employer_cnpj}".

Responda ESTRITAMENTE em formato JSON, sem markdown, sem texto antes ou depois, apenas o objeto JSON:
{
  "is_payslip": boolean,
  "found_items": {
    "mensalidade_sindical": boolean,
    "taxa_assistencial": boolean,
    "taxa_negocial": boolean
  },
  "name_match": boolean,
  "name_found_in_document": "string ou null",
  "message": "Resumo em português da análise"
}`;

function extractJson(text: string): any {
  if (!text || !text.trim()) throw new Error("A IA não retornou conteúdo (resposta vazia). Tente novamente.");
  // Remove markdown code fences se existirem
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    console.error("[verify-payslip-document] Conteúdo sem JSON:", cleaned.slice(0, 500));
    throw new Error("Resposta da IA não contém JSON válido");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    console.error("[verify-payslip-document] Falha ao parsear JSON:", cleaned.slice(0, 500));
    throw new Error("Não foi possível interpretar a resposta da IA. Tente novamente.");
  }
}

async function callLovableGateway(imageUrl: string, systemPrompt: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analise este documento e verifique se é um contracheque válido com descontos sindicais. Responda apenas com o JSON solicitado." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 2048,
    }),
  });

  if (response.status === 429) {
    const err: any = new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    err.code = "RATE_LIMIT";
    throw err;
  }
  if (response.status === 402) {
    const err: any = new Error("Créditos de IA esgotados. Contate o suporte para regularizar.");
    err.code = "NO_CREDITS";
    throw err;
  }

  const rawText = await response.text();
  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    console.error("[verify-payslip-document] Resposta não-JSON do gateway:", rawText.slice(0, 500));
    throw new Error(`Resposta inesperada do gateway de IA (status ${response.status})`);
  }
  if (!response.ok) {
    console.error("[verify-payslip-document] Gateway retornou erro:", response.status, JSON.stringify(json).slice(0, 500));
    throw new Error(json?.error?.message || `Erro no gateway de IA (status ${response.status})`);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("[verify-payslip-document] Sem content na resposta:", JSON.stringify(json).slice(0, 800));
  }
  return extractJson(content);
}



serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_name, file_type, member_name, employer_name, employer_cnpj, clinic_id } = await req.json();

    if (!file_base64) {
      return new Response(JSON.stringify({ error: "Missing file_base64" }), { status: 400, headers: corsHeaders });
    }

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      console.error("Nenhuma chave de IA configurada (OPENAI_API_KEY ou LOVABLE_API_KEY)");
      return new Response(JSON.stringify({
        error: "AI service not configured",
        is_payslip: false,
        message: "Serviço de verificação por IA não está configurado. Contate o suporte técnico.",
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[verify-payslip-document] Analyzing document for ${member_name} from ${employer_name} (provider: ${OPENAI_API_KEY ? 'openai' : 'lovable-gateway'})`);

    const imageUrl = file_base64.startsWith('data:') ? file_base64 : `data:${file_type || 'image/png'};base64,${file_base64}`;
    const systemPrompt = SYSTEM_PROMPT(member_name || "", employer_name || "", employer_cnpj || "");

    let result: any;
    try {
      result = OPENAI_API_KEY
        ? await callOpenAI(imageUrl, systemPrompt)
        : await callLovableGateway(imageUrl, systemPrompt);
    } catch (primaryErr: any) {
      // Fallback: se a OpenAI falhar e houver chave do gateway Lovable, tenta o gateway
      if (OPENAI_API_KEY && LOVABLE_API_KEY && primaryErr.code !== "RATE_LIMIT" && primaryErr.code !== "NO_CREDITS") {
        console.warn(`[verify-payslip-document] OpenAI falhou (${primaryErr.message}), tentando fallback Lovable Gateway`);
        result = await callLovableGateway(imageUrl, systemPrompt);
      } else {
        throw primaryErr;
      }
    }

    console.log(`[verify-payslip-document] Result for ${member_name}:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[verify-payslip-document] Error: ${error?.message}`, error?.stack || error);
    const friendlyMessage = error.code === "RATE_LIMIT" || error.code === "NO_CREDITS"
      ? error.message
      : `Falha na análise automática do documento (${error?.message || "erro desconhecido"}). Você pode tentar novamente ou, se for administrador, atualizar a data manualmente.`;
    return new Response(JSON.stringify({
      error: error.message,
      is_payslip: false,
      message: friendlyMessage,
    }), {
      status: 200, // Return 200 so frontend can handle the error message gracefully
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
