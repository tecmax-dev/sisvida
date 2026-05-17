import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const SUPPORT_START_MINUTES = 9 * 60;
const SUPPORT_END_MINUTES = 16 * 60;

function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getNationalHolidayName(year: number, month: number, day: number): string | null {
  const fixed = [
    { name: "Confraternização Universal", m: 1, d: 1 },
    { name: "Tiradentes", m: 4, d: 21 },
    { name: "Dia do Trabalho", m: 5, d: 1 },
    { name: "Independência do Brasil", m: 9, d: 7 },
    { name: "Nossa Senhora Aparecida", m: 10, d: 12 },
    { name: "Finados", m: 11, d: 2 },
    { name: "Proclamação da República", m: 11, d: 15 },
    { name: "Natal", m: 12, d: 25 },
  ];
  for (const holiday of fixed) if (holiday.m === month && holiday.d === day) return holiday.name;

  const easter = calculateEaster(year);
  const check = (offset: number, name: string) => {
    const d = new Date(year, easter.getMonth(), easter.getDate() + offset);
    return month === d.getMonth() + 1 && day === d.getDate() ? name : null;
  };
  return check(-2, "Sexta-feira Santa") || check(-47, "Carnaval") || check(0, "Páscoa") || check(60, "Corpus Christi") || null;
}

function getBrazilianDateTime() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const dayName = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(now);
  const dayShort = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now);
  const dayOfWeek = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[dayShort] ?? 0;
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = hour * 60 + minute;
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isBusinessHours = isWeekday && totalMinutes >= SUPPORT_START_MINUTES && totalMinutes < SUPPORT_END_MINUTES;
  return { date, time, dayName, isWeekday, isBusinessHours };
}

async function getHumanSupportStatus(supabase: any) {
  const br = getBrazilianDateTime();
  const [year, month, day] = br.date.split('-').map(Number);
  const nationalHoliday = getNationalHolidayName(year, month, day);
  const { data: clinicHolidays } = await supabase
    .from('clinic_holidays')
    .select('name')
    .eq('clinic_id', SINDICATO_CLINIC_ID)
    .or(`holiday_date.eq.${br.date},and(is_recurring.eq.true,recurring_month.eq.${month},recurring_day.eq.${day})`);
  const holidayName = nationalHoliday || clinicHolidays?.[0]?.name || null;
  const available = br.isBusinessHours && !holidayName;
  const reason = holidayName ? `feriado (${holidayName})` : !br.isWeekday ? 'fim de semana' : !br.isBusinessHours ? 'fora do horário de atendimento' : '';
  return { ...br, available, reason };
}

const unavailableSupportMessage = (reason: string) =>
  `Nosso atendimento humano está indisponível no momento${reason ? `: ${reason}` : ''}.\n\n` +
  `O atendimento humano funciona de *segunda a sexta-feira, das 09h às 16h*, exceto feriados.\n\n` +
  `Posso ajudar por aqui como assistente virtual. Se preferir, envie seu assunto que deixaremos registrado para retorno assim que o atendimento estiver disponível. 📋`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verification for Meta Webhook setup
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe") {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("OK", { status: 200 });
  }

  try {
    const body = await req.json();
    console.log('[WEBHOOK_ENTRY]');
    console.log('[RAW_PAYLOAD]', JSON.stringify(body, null, 2));

    // Minimalist Parser
    const messageObj = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || body.message || {};
    const from = (body.wa_id || body.phone || messageObj.from || "").toString().replace(/\D/g, "");
    
    const extractedButtonId = messageObj.interactive?.button_reply?.id || messageObj.buttonId || null;
    const extractedButtonTitle = messageObj.interactive?.button_reply?.title || messageObj.buttonText || null;
    const text = (messageObj.text?.body || messageObj.conversation || "").toString().trim();

    console.log('[BUTTON_ID]', extractedButtonId);
    console.log('[BUTTON_TITLE]', extractedButtonTitle);

    if (!from) {
      return new Response(JSON.stringify({ ok: true, reason: "no phone" }), { status: 200 });
    }

    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID");
    const to = from.startsWith('55') ? from : `55${from}`;

    const sendResponse = async (payload: any) => {
      const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${META_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          ...payload
        }),
      });
      const result = await res.text();
      console.log('[MESSAGE_SENT]', result);
      return result;
    };

    // Log the incoming message
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from('whatsapp_incoming_logs').insert({
        phone: to,
        message_text: text || `[Button: ${extractedButtonTitle || extractedButtonId}]`,
        raw_payload: body,
        processed: true,
        processed_action: extractedButtonId ? `button_${extractedButtonId}` : 'text_message'
      });
    } catch (logErr) {
      console.error('[LOG_ERROR]', logErr);
    }

    const isGreeting = /\b(oi|ola|olá|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|menu)\b/i.test(text);

    // --- ROUTING LOGIC ---

    // 1. MAIN MENU
    if (isGreeting || extractedButtonId === "menu_principal") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "text", text: "Sindicato dos Comerciários" },
          body: { text: "Olá! Bem-vindo ao nosso canal oficial. Como podemos ajudar hoje? Escolha uma opção abaixo:" },
          footer: { text: "Atendimento Automático" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "whazing_associado", title: "Sou Associado" } },
              { type: "reply", reply: { id: "whazing_empresa", title: "Sou Empresa" } },
              { type: "reply", reply: { id: "whazing_contabilidade", title: "Contabilidade" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "main_menu" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. SUBMENU ASSOCIADO
    if (extractedButtonId === "whazing_associado" || extractedButtonId === "voltar_associado") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Você selecionou *Sou Associado*.\n\nEscolha o que deseja:" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "agendar_consulta", title: "Agendar Consulta" } },
              { type: "reply", reply: { id: "whazing_sub_carteirinha", title: "Atualizar Carteira" } },
              { type: "reply", reply: { id: "whazing_sub_outros", title: "Outros Assuntos" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_associado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. SUBMENU EMPRESA
    if (extractedButtonId === "whazing_empresa" || extractedButtonId === "voltar_empresa") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Você selecionou *Sou Empresa*.\n\nComo podemos ajudar?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "whazing_sub_boleto", title: "2ª Via Boleto" } },
              { type: "reply", reply: { id: "whazing_sub_cct", title: "CCT / Pisos" } },
              { type: "reply", reply: { id: "whazing_sub_outros", title: "Outros Assuntos" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_empresa" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. SUBMENU CONTABILIDADE
    if (extractedButtonId === "whazing_contabilidade") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Você selecionou *Contabilidade*.\n\nComo podemos ajudar?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "whazing_sub_homologacao", title: "Homologação" } },
              { type: "reply", reply: { id: "whazing_sub_cct", title: "CCT / Pisos" } },
              { type: "reply", reply: { id: "whazing_sub_outros", title: "Outros Assuntos" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_contabilidade" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. CARTEIRINHA / BOLETO / HOMOLOGAÇÃO / CCT (Follow-up or Action)
    const followUpAction = (msg: string) => ({
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: msg + "\n\nPosso ajudar com mais alguma coisa?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "falar_atendente", title: "Falar c/ Atendente" } },
            { type: "reply", reply: { id: "menu_principal", title: "Menu Principal" } }
          ]
        }
      }
    });

    if (extractedButtonId === "whazing_sub_carteirinha") {
      await sendResponse(followUpAction("Para atualizar sua carteirinha, você pode fazer diretamente pelo nosso aplicativo ou enviar os documentos por aqui."));
      return new Response(JSON.stringify({ ok: true, action: "carteirinha" }));
    }

    if (extractedButtonId === "agendar_consulta") {
      await sendResponse(followUpAction("O agendamento de consultas pelo WhatsApp estará disponível a partir do dia *30/05/2026*."));
      return new Response(JSON.stringify({ ok: true, action: "agendar_consulta_indisponivel" }));
    }

    if (extractedButtonId === "whazing_sub_boleto") {
      await sendResponse(followUpAction("Para emitir a 2ª via do boleto, informe o CNPJ da empresa."));
      return new Response(JSON.stringify({ ok: true, action: "boleto" }));
    }

    if (extractedButtonId === "whazing_sub_cct") {
      // 1) Mensagem com CTA URL para convenções anteriores
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: {
            text:
              "📄 As Convenções Coletivas e Tabelas de Pisos Salariais vigentes estão disponíveis em nosso site ou podem ser solicitadas aqui.\n\n" +
              "Acesse também o histórico de convenções anteriores pelo botão abaixo.",
          },
          action: {
            name: "cta_url",
            parameters: {
               display_text: "Ver Anteriores",
              url: "https://comerciariosilheus.org.br/ccts/",
            },
          },
        },
      });
      // 2) Follow-up com opções de navegação
      await sendResponse(followUpAction("Posso ajudar com mais alguma coisa?"));
      return new Response(JSON.stringify({ ok: true, action: "cct" }));
    }

    if (extractedButtonId === "whazing_sub_homologacao") {
      await sendResponse(followUpAction("O agendamento de homologação deve ser feito pelo portal da empresa."));
      return new Response(JSON.stringify({ ok: true, action: "homologacao" }));
    }

    if (extractedButtonId === "whazing_sub_outros" || extractedButtonId === "falar_atendente") {
      await sendResponse({
        type: "text",
        text: { body: "Entendido. Vou te encaminhar para um de nossos atendentes. Por favor, aguarde um momento. ⏳" }
      });
      // Here you would typically trigger a handoff to human (Whazing/ZapResponder)
      return new Response(JSON.stringify({ ok: true, action: "handoff" }));
    }

    return new Response(JSON.stringify({ ok: true, status: "unhandled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ERROR]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});