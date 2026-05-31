import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * MOBILE SLOT AVAILABILITY - Edge Function
 * 
 * Busca agendamentos existentes usando SERVICE_ROLE_KEY para contornar
 * problemas de RLS quando a sessão JWT mobile expira.
 * 
 * Sem essa função, slots ocupados aparecem como disponíveis no PWA.
 * 
 * Input: { professionalId, date, type?: "medical" | "legal" }
 * Output: { appointments: [{ start_time, end_time, status }] }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { professionalId, date, type } = body;

    if (!professionalId || typeof professionalId !== "string") {
      return new Response(
        JSON.stringify({ error: "missing or invalid professionalId" }),
          { status: 400, headers: jsonHeaders }
      );
    }

    if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "missing or invalid date (expected YYYY-MM-DD)" }),
          { status: 400, headers: jsonHeaders }
      );
    }

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(professionalId)) {
      return new Response(
        JSON.stringify({ error: "invalid professionalId format" }),
          { status: 400, headers: jsonHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (type === "legal") {
      // Homologação appointments
      const { data, error } = await supabase
        .from("homologacao_appointments")
        .select("id, start_time, end_time, status, professional_id, appointment_date")
        .eq("professional_id", professionalId)
        .eq("appointment_date", date)
        .neq("status", "cancelled");

      if (error) {
        console.error("[mobile-slot-availability] Error fetching legal appointments:", error);
        return new Response(
          JSON.stringify({ error: "query_failed", appointments: [] }),
          { status: 500, headers: jsonHeaders }
        );
      }

      return new Response(
        JSON.stringify({ appointments: data || [] }),
        { headers: jsonHeaders }
      );
    }

    // Medical appointments (default) + manual slot blocks from the admin agenda
    const [{ data, error }, { data: blocks, error: blocksError }] = await Promise.all([
      supabase
        .from("appointments")
        .select("start_time, end_time, status")
        .eq("professional_id", professionalId)
        .eq("appointment_date", date)
        .not("status", "in", '("cancelled","completed","no_show")'),
      supabase
        .from("appointment_slot_blocks")
        .select("start_time, end_time")
        .eq("professional_id", professionalId)
        .eq("block_date", date),
    ]);

    if (error || blocksError) {
      console.error("[mobile-slot-availability] Error fetching appointments/blocks:", error || blocksError);
      return new Response(
        JSON.stringify({ error: "query_failed", appointments: [] }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const blockedSlots = (blocks || []).map((block) => ({
      start_time: block.start_time,
      end_time: block.end_time,
      status: "blocked",
    }));

    return new Response(
      JSON.stringify({ appointments: [...(data || []), ...blockedSlots] }),
      { headers: jsonHeaders }
    );
  } catch (err) {
    console.error("[mobile-slot-availability] Error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", appointments: [] }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
