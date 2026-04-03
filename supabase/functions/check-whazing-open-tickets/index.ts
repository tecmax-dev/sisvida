import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const whazingUrl = Deno.env.get('WHAZING_API_URL');
    const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!whazingUrl || !whazingToken) {
      return new Response(JSON.stringify({ error: 'Whazing not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const apiUrl = whazingUrl.replace(/\/$/, '');

    // Get Brazilian date/time
    const now = new Date();
    const brDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const brTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const brDayName = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(now);

    console.log(`[check-tickets] Data BR: ${brDate}, Hora: ${brTime}, Dia: ${brDayName}`);

    // Check if today is a holiday - query all clinics' holidays
    const [year, month, day] = brDate.split('-').map(Number);
    
    const { data: fixedHolidays } = await supabase
      .from('clinic_holidays')
      .select('name, clinic_id')
      .eq('holiday_date', brDate);

    const { data: recurringHolidays } = await supabase
      .from('clinic_holidays')
      .select('name, clinic_id')
      .eq('is_recurring', true)
      .eq('recurring_month', month)
      .eq('recurring_day', day);

    // Also check Brazilian national holidays (Sexta-feira Santa = Easter - 2)
    const nationalHolidays = getNationalHolidayName(year, month, day);
    
    const isHoliday = (fixedHolidays && fixedHolidays.length > 0) || 
                      (recurringHolidays && recurringHolidays.length > 0) || 
                      nationalHolidays !== null;
    
    const holidayName = nationalHolidays || 
                        fixedHolidays?.[0]?.name || 
                        recurringHolidays?.[0]?.name || 
                        'Feriado';

    console.log(`[check-tickets] Hoje é feriado? ${isHoliday ? `SIM - ${holidayName}` : 'NÃO'}`);

    // Check day of week
    const dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now);
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const dayOfWeek = dayMap[dayParts] ?? 0;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const isUnavailable = isHoliday || isWeekend;

    if (!isUnavailable) {
      return new Response(JSON.stringify({ 
        message: 'Hoje não é feriado nem fim de semana. Atendimento normal.',
        date: brDate,
        time: brTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch open/pending tickets from Whazing
    console.log(`[check-tickets] Buscando tickets abertos no Whazing...`);
    
    // Try to list tickets - Whazing/Evolution API typically uses /tickets endpoint
    let openTickets: any[] = [];
    
    // Try /tickets endpoint with status filter
    const ticketsResponse = await fetch(`${apiUrl}/tickets?status=open&status=pending`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whazingToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (ticketsResponse.ok) {
      const ticketsData = await ticketsResponse.json();
      // Handle different response formats
      if (Array.isArray(ticketsData)) {
        openTickets = ticketsData;
      } else if (ticketsData.tickets && Array.isArray(ticketsData.tickets)) {
        openTickets = ticketsData.tickets;
      } else if (ticketsData.data && Array.isArray(ticketsData.data)) {
        openTickets = ticketsData.data;
      }
      console.log(`[check-tickets] Encontrados ${openTickets.length} tickets abertos`);
    } else {
      const errText = await ticketsResponse.text();
      console.log(`[check-tickets] /tickets retornou ${ticketsResponse.status}: ${errText}`);
      
      // Fallback: try /ticket/list or similar endpoints
      const altResponse = await fetch(`${apiUrl}/ticket`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whazingToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (Array.isArray(altData)) {
          openTickets = altData.filter((t: any) => t.status === 'open' || t.status === 'pending');
        } else if (altData.tickets) {
          openTickets = altData.tickets.filter((t: any) => t.status === 'open' || t.status === 'pending');
        }
        console.log(`[check-tickets] (fallback) Encontrados ${openTickets.length} tickets abertos`);
      } else {
        console.log(`[check-tickets] Fallback /ticket retornou ${altResponse.status}`);
      }
    }

    if (openTickets.length === 0) {
      return new Response(JSON.stringify({
        message: `Hoje é ${holidayName}. Nenhum ticket aberto encontrado no Whazing.`,
        date: brDate,
        isHoliday,
        holidayName,
        ticketsFound: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For each open ticket, send a holiday notification message
    const results: any[] = [];
    
    for (const ticket of openTickets) {
      const contactPhone = ticket.contact?.number || ticket.number || ticket.contactId;
      const contactName = ticket.contact?.name || ticket.contact?.pushname || 'Cliente';
      const ticketId = ticket.id;

      if (!contactPhone) {
        console.log(`[check-tickets] Ticket #${ticketId} sem telefone, pulando...`);
        results.push({ ticketId, status: 'skipped', reason: 'no phone' });
        continue;
      }

      console.log(`[check-tickets] Processando ticket #${ticketId} - ${contactName} (${contactPhone})`);

      // Send holiday notification message via Whazing
      const message = `Olá, ${contactName}! 👋\n\n` +
        `Identificamos que você tem uma solicitação em aberto conosco.\n\n` +
        `📅 Hoje, *${brDayName}* (${brDate.split('-').reverse().join('/')}), é *${holidayName}* e nosso atendimento humano está *indisponível*.\n\n` +
        `🕐 O atendimento humano funciona de *segunda a sexta, das 09h às 12h e das 13h às 16h* (exceto feriados).\n\n` +
        `Seu chamado está registrado e será respondido assim que nosso atendimento retornar. ✅\n\n` +
        `Se precisar de algo urgente, posso tentar ajudar como assistente virtual! É só me enviar sua dúvida. 🤖`;

      try {
        const sendResponse = await fetch(`${apiUrl}/apioficial`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${whazingToken}`,
          },
          body: JSON.stringify({
            number: contactPhone,
            contents: {
              type: "text",
              body: { text: message }
            }
          }),
        });

        if (sendResponse.ok) {
          console.log(`[check-tickets] ✅ Mensagem enviada para ticket #${ticketId} (${contactPhone})`);
          results.push({ ticketId, contactPhone, contactName, status: 'sent' });
        } else {
          const errText = await sendResponse.text();
          console.log(`[check-tickets] ❌ Falha ao enviar para ticket #${ticketId}: ${errText}`);
          results.push({ ticketId, contactPhone, status: 'failed', error: errText });
        }
      } catch (err) {
        console.log(`[check-tickets] ❌ Erro ao enviar para ticket #${ticketId}:`, err);
        results.push({ ticketId, contactPhone, status: 'error', error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      message: `Hoje é ${holidayName}. Processados ${openTickets.length} tickets.`,
      date: brDate,
      time: brTime,
      isHoliday,
      holidayName,
      ticketsFound: openTickets.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[check-tickets] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Check if a given date matches a Brazilian national holiday
function getNationalHolidayName(year: number, month: number, day: number): string | null {
  const fixedNational: { name: string; month: number; day: number }[] = [
    { name: "Confraternização Universal", month: 1, day: 1 },
    { name: "Tiradentes", month: 4, day: 21 },
    { name: "Dia do Trabalho", month: 5, day: 1 },
    { name: "Independência do Brasil", month: 9, day: 7 },
    { name: "Nossa Senhora Aparecida", month: 10, day: 12 },
    { name: "Finados", month: 11, day: 2 },
    { name: "Proclamação da República", month: 11, day: 15 },
    { name: "Natal", month: 12, day: 25 },
  ];

  for (const h of fixedNational) {
    if (h.month === month && h.day === day) return h.name;
  }

  // Calculate Easter-based holidays
  const easter = calculateEaster(year);
  const easterMonth = easter.getMonth() + 1;
  const easterDay = easter.getDate();

  // Sexta-feira Santa (Easter - 2)
  const goodFriday = new Date(year, easter.getMonth(), easter.getDate() - 2);
  if (month === goodFriday.getMonth() + 1 && day === goodFriday.getDate()) return "Sexta-feira Santa";

  // Carnaval (Easter - 47)
  const carnaval = new Date(year, easter.getMonth(), easter.getDate() - 47);
  if (month === carnaval.getMonth() + 1 && day === carnaval.getDate()) return "Carnaval";

  // Páscoa
  if (month === easterMonth && day === easterDay) return "Páscoa";

  // Corpus Christi (Easter + 60)
  const corpus = new Date(year, easter.getMonth(), easter.getDate() + 60);
  if (month === corpus.getMonth() + 1 && day === corpus.getDate()) return "Corpus Christi";

  return null;
}

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
  const mo = Math.floor((h + l - 7 * m + 114) / 31);
  const da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, mo - 1, da);
}
