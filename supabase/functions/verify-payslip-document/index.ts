import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_name, file_type, member_name, employer_name, employer_cnpj, clinic_id } = await req.json();

    if (!file_base64) {
      return new Response(JSON.stringify({ error: "Missing file_base64" }), { status: 400, headers: corsHeaders });
    }

    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: corsHeaders });
    }

    console.log(`[verify-payslip-document] Analyzing document for ${member_name} from ${employer_name}`);

    // Call OpenAI GPT-4o Vision
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de contracheques sindicais brasileiros. 
            Seu objetivo é verificar se a imagem enviada é um contracheque válido e se contém os descontos sindicais obrigatórios.
            
            Critérios de validação:
            1. Deve ser um contracheque (Holerite).
            2. Deve conter pelo menos UM destes itens: Mensalidade Sindical, Taxa Assistencial ou Taxa Negocial.
            3. Verifique se o nome do funcionário no documento é compatível com o nome fornecido: "${member_name}".
            4. Verifique se a empresa no documento é compatível com: "${employer_name}" ou CNPJ: "${employer_cnpj}".
            
            Responda APENAS em JSON com o seguinte formato:
            {
              "is_payslip": boolean,
              "found_items": {
                "mensalidade_sindical": boolean,
                "taxa_assistencial": boolean,
                "taxa_negocial": boolean
              },
              "name_match": boolean,
              "name_found_in_document": "nome encontrado ou null",
              "message": "Mensagem explicativa curta em português"
            }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este documento."
              },
              {
                type: "image_url",
                image_url: {
                  url: file_base64.startsWith('data:') ? file_base64 : `data:${file_type || 'image/png'};base64,${file_base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });

    const aiResult = await response.json();
    const result = JSON.parse(aiResult.choices[0].message.content);

    console.log(`[verify-payslip-document] AI Result:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[verify-payslip-document] Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
