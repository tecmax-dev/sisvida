import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate Easter date
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
  for (const h of fixed) if (h.m === month && h.d === day) return h.name;

  const easter = calculateEaster(year);
  const check = (offset: number, name: string) => {
    const d = new Date(year, easter.getMonth(), easter.getDate() + offset);
    return (month === d.getMonth() + 1 && day === d.getDate()) ? name : null;
  };
  return check(-2, "Sexta-feira Santa") || check(-47, "Carnaval") || check(0, "Páscoa") || check(60, "Corpus Christi") || null;
}

function getBrazilianDateTime() {
  const now = new Date();
  const brDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const brTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const brDayName = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(now);
  const dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now);
  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const dayOfWeek = dayMap[dayParts] ?? 0;

  const [h, m] = brTime.split(':').map(Number);
  const totalMin = h * 60 + m;
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isBusinessHours = isWeekday && totalMin >= 540 && totalMin < 960;

  return { date: brDate, time: brTime, dayOfWeek, dayName: brDayName, isWeekday, isBusinessHours };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const whazingUrl = Deno.env.get('WHAZING_API_URL');
    const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!whazingUrl || !whazingToken) {
      return new Response(JSON.stringify({ error: 'Whazing not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const br = getBrazilianDateTime();
    const [year, month, day] = br.date.split('-').map(Number);

    console.log(`[check-tickets] ${br.dayName}, ${br.date} ${br.time}`);

    // Check if today is a holiday
    const nationalHoliday = getNationalHolidayName(year, month, day);

    const { data: clinicHolidays } = await supabase
      .from('clinic_holidays')
      .select('name')
      .or(`holiday_date.eq.${br.date},and(is_recurring.eq.true,recurring_month.eq.${month},recurring_day.eq.${day})`);

    const holidayName = nationalHoliday || clinicHolidays?.[0]?.name || null;
    const isHoliday = !!holidayName;
    const isWeekend = !br.isWeekday;
    const isUnavailable = isHoliday || isWeekend || !br.isBusinessHours;

    const unavailableReason = isHoliday ? `feriado (${holidayName})` :
      isWeekend ? 'fim de semana' : !br.isBusinessHours ? 'fora do horário comercial' : '';

    console.log(`[check-tickets] Disponível: ${!isUnavailable}. Motivo: ${unavailableReason || 'horário normal'}`);

    if (!isUnavailable) {
      return new Response(JSON.stringify({
        message: 'Atendimento disponível. Nenhuma ação necessária.',
        date: br.date, time: br.time, available: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Query our local whazing_tickets table for open/pending tickets NOT yet notified
    const { data: openTickets, error: ticketsError } = await supabase
      .from('whazing_tickets')
      .select('*')
      .in('status', ['open', 'pending'])
      .eq('holiday_notified', false);

    if (ticketsError) {
      console.error('[check-tickets] Error querying tickets:', ticketsError);
      throw ticketsError;
    }

    console.log(`[check-tickets] Tickets abertos não notificados: ${openTickets?.length || 0}`);

    if (!openTickets || openTickets.length === 0) {
      return new Response(JSON.stringify({
        message: `Hoje é ${unavailableReason}. Nenhum ticket pendente de notificação.`,
        date: br.date, time: br.time, available: false, reason: unavailableReason, ticketsFound: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send holiday notification to each open ticket
    const apiUrl = whazingUrl.replace(/\/$/, '');
    const results: any[] = [];

    for (const ticket of openTickets) {
      const phone = ticket.contact_number;
      const name = ticket.contact_name || 'Cliente';

      if (!phone) {
        results.push({ ticketId: ticket.ticket_id, status: 'skipped', reason: 'no phone' });
        continue;
      }

      const dateFormatted = br.date.split('-').reverse().join('/');
      const message = `Olá, ${name}! 👋\n\n` +
        `Identificamos que você tem uma solicitação em aberto conosco.\n\n` +
        `📅 Hoje, *${br.dayName}* (${dateFormatted}), nosso atendimento humano está *indisponível* (${unavailableReason}).\n\n` +
        `🕐 O atendimento humano funciona de *segunda a sexta, das 09h às 16h* (exceto feriados).\n\n` +
        `Seu chamado está registrado e será respondido assim que nosso atendimento retornar. ✅\n\n` +
        `Se precisar de algo urgente, posso tentar ajudar como assistente virtual! É só me enviar sua dúvida. 🤖`;

      try {
        let cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        const sendResponse = await fetch(`${apiUrl}/apioficial`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${whazingToken}`,
          },
          body: JSON.stringify({
            number: cleanPhone,
            contents: { type: "text", body: { text: message } }
          }),
        });

        if (sendResponse.ok) {
          // Mark ticket as notified
          await supabase
            .from('whazing_tickets')
            .update({ holiday_notified: true, holiday_notified_at: new Date().toISOString() })
            .eq('id', ticket.id);

          console.log(`[check-tickets] ✅ Notificado ticket #${ticket.ticket_id} (${phone})`);
          results.push({ ticketId: ticket.ticket_id, phone, name, status: 'sent' });
        } else {
          const errText = await sendResponse.text();
          console.log(`[check-tickets] ❌ Falha ticket #${ticket.ticket_id}: ${errText}`);
          results.push({ ticketId: ticket.ticket_id, phone, status: 'failed', error: errText });
        }
      } catch (err) {
        console.error(`[check-tickets] ❌ Erro ticket #${ticket.ticket_id}:`, err);
        results.push({ ticketId: ticket.ticket_id, phone, status: 'error', error: String(err) });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    return new Response(JSON.stringify({
      message: `${unavailableReason} — ${sent}/${openTickets.length} tickets notificados.`,
      date: br.date, time: br.time, available: false, reason: unavailableReason,
      ticketsFound: openTickets.length, notified: sent, results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[check-tickets] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
