import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedIntent {
  intent: 'schedule' | 'cancel' | 'reschedule' | 'list' | 'help' | 'confirm' | 'deny' | 'select_option' | 'unknown';
  entities: {
    professional_name?: string;
    date?: string; // formato: YYYY-MM-DD ou "amanhã", "quarta", etc.
    time?: string; // formato: HH:MM ou "14h", "duas da tarde", etc.
    option_number?: number;
    cpf?: string;
  };
  confidence: number;
  friendly_response?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, available_professionals, available_dates, available_times } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[ai-assistant] LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ 
        intent: 'unknown', 
        entities: {}, 
        confidence: 0,
        error: 'API key not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context-aware system prompt
    let contextInfo = '';
    if (available_professionals && available_professionals.length > 0) {
      contextInfo += `\nProfissionais disponíveis: ${available_professionals.map((p: { name: string }, i: number) => `${i + 1}. ${p.name}`).join(', ')}`;
    }
    if (available_dates && available_dates.length > 0) {
      contextInfo += `\nDatas disponíveis: ${available_dates.map((d: { formatted: string; weekday: string }, i: number) => `${i + 1}. ${d.formatted} (${d.weekday})`).join(', ')}`;
    }
    if (available_times && available_times.length > 0) {
      contextInfo += `\nHorários disponíveis: ${available_times.map((t: { formatted: string }, i: number) => `${i + 1}. ${t.formatted}`).join(', ')}`;
    }

    const systemPrompt = `Você é um assistente de agendamento de consultas médicas via WhatsApp. Seu trabalho é interpretar mensagens dos pacientes e extrair a intenção e entidades relevantes.

Estado atual da conversa: ${context || 'início'}
${contextInfo}

IMPORTANTE:
- Se o usuário mencionar um número (1, 2, 3...), isso provavelmente é uma seleção de opção
- Se mencionar "sim", "confirmo", "ok", "👍" -> intent: confirm
- Se mencionar "não", "cancelar", "desisto" -> intent: deny
- CPF deve ter 11 dígitos numéricos
- Datas podem ser: "amanhã", "segunda", "dia 15", etc.
- Horários podem ser: "14h", "duas da tarde", "às 10", etc.
- Se o usuário pedir para agendar/marcar consulta -> intent: schedule
- Se pedir para cancelar/desmarcar -> intent: cancel
- Se pedir para reagendar/remarcar -> intent: reschedule
- Se pedir para ver consultas/agendamentos -> intent: list
- Se precisar de ajuda/não entendeu -> intent: help

Retorne APENAS um JSON válido no seguinte formato:
{
  "intent": "schedule|cancel|reschedule|list|help|confirm|deny|select_option|unknown",
  "entities": {
    "professional_name": "nome do profissional se mencionado",
    "date": "data em YYYY-MM-DD se possível identificar, ou o texto original",
    "time": "horário em HH:MM se possível identificar, ou o texto original",
    "option_number": número se o usuário escolheu uma opção,
    "cpf": "CPF com 11 dígitos se mencionado"
  },
  "confidence": 0.0 a 1.0,
  "friendly_response": "resposta amigável e natural se a intenção não foi clara"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1, // Low temperature for more consistent extraction
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ai-assistant] AI gateway error:', response.status, errorText);
      
      // Return a fallback response instead of failing
      return new Response(JSON.stringify({ 
        intent: 'unknown', 
        entities: {}, 
        confidence: 0,
        friendly_response: 'Desculpe, não entendi. Por favor, escolha uma opção do menu.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('[ai-assistant] Raw AI response:', content);

    // Parse JSON from response
    let extracted: ExtractedIntent;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[ai-assistant] Failed to parse AI response:', parseError);
      extracted = {
        intent: 'unknown',
        entities: {},
        confidence: 0,
        friendly_response: 'Desculpe, não entendi. Por favor, escolha uma opção do menu.'
      };
    }

    console.log('[ai-assistant] Extracted intent:', extracted);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ai-assistant] Error:', error);
    return new Response(JSON.stringify({ 
      intent: 'unknown', 
      entities: {}, 
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
