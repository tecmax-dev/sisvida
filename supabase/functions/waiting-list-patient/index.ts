import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * WAITING LIST PATIENT - Edge Function
 *
 * Ações do associado (PWA/App) sobre a fila de espera:
 *  - status : verifica se a fila está habilitada na clínica
 *  - join   : entra na fila de espera de um profissional
 *  - list   : lista as filas e ofertas do associado
 *  - accept : aceita a oferta de vaga (transacional, à prova de concorrência)
 *  - decline: recusa a oferta e passa a vaga ao próximo da fila
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, patientId, clinicId, professionalId, specialtyId, offerId, notes } = body ?? {};

    if (!UUID.test(String(patientId ?? ""))) {
      return new Response(JSON.stringify({ error: "invalid patientId" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    if (action !== "list" && !UUID.test(String(clinicId ?? ""))) {
      return new Response(JSON.stringify({ error: "invalid clinicId" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate the patient has access to this clinic.
    // In the union app, the scheduling clinic is resolved from the active card,
    // so allow either the patient record clinic or an active patient card clinic.
    const { data: patient } = await supabase
      .from("patients")
      .select("id, clinic_id")
      .eq("id", patientId)
      .maybeSingle();

    if (!patient) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    const { data: activeCards } = await supabase
      .from("patient_cards")
      .select("clinic_id")
      .eq("patient_id", patientId)
      .eq("is_active", true);

    const allowedClinicIds = Array.from(new Set([
      patient.clinic_id,
      ...((activeCards ?? []).map((card) => card.clinic_id).filter(Boolean)),
    ]));

    if (action !== "list" && !allowedClinicIds.includes(clinicId)) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    if (action === "status") {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("waiting_list_enabled, waiting_list_offer_timeout_minutes")
        .eq("id", clinicId)
        .maybeSingle();
      return new Response(JSON.stringify({
        enabled: !!clinic?.waiting_list_enabled,
        timeoutMinutes: clinic?.waiting_list_offer_timeout_minutes ?? 30,
      }), { headers: jsonHeaders });
    }

    if (action === "join") {
      if (!UUID.test(String(professionalId ?? ""))) {
        return new Response(JSON.stringify({ error: "invalid professionalId" }), { status: 400, headers: jsonHeaders });
      }

      // Regra: segue o período configurado em /sindicato (mensal ou a cada N dias).
      // Quem já atingiu o limite com o profissional nesse período não entra na fila.
      const { data: rule } = await supabase.from("clinics")
        .select("titular_booking_period, max_appointments_per_cpf_month").eq("id", clinicId).maybeSingle();
      const period = String((rule as any)?.titular_booking_period || "monthly");
      const rawLimit = (rule as any)?.max_appointments_per_cpf_month;
      const limit = rawLimit === 0 ? 0 : Math.max(1, Number(rawLimit ?? 1));
      const now = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      let monthStart: string, monthEnd: string;
      const m = /^days_(\d+)$/.exec(period);
      if (m) {
        const n = Number(m[1]);
        const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        monthStart = iso(new Date(today - (n - 1) * 86400000));
        monthEnd = iso(new Date(today + n * 86400000)); // exclusivo
      } else {
        monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
        monthEnd = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
      }

      const { count: attendedCount } = limit === 0 ? { count: 0 } : await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .eq("professional_id", professionalId)
        .gte("appointment_date", monthStart)
        .lt("appointment_date", monthEnd)
        .not("status", "in", '("cancelled","blocked")');

      if (limit > 0 && (attendedCount ?? 0) >= limit) {
        return new Response(JSON.stringify({
          error: "already_scheduled_this_month",
          message:
            "Você já atingiu o limite de consultas com este profissional no período definido pelo sindicato. A fila de espera dele fica disponível para você quando esse período terminar.",
        }), { status: 409, headers: jsonHeaders });
      }

      const { data, error } = await supabase.rpc("wl_join_queue", {
        p_clinic_id: clinicId,
        p_patient_id: patientId,
        p_professional_id: professionalId,
        p_specialty_id: specialtyId ?? null,
        p_source: "app",
        p_notes: typeof notes === "string" ? notes.slice(0, 500) : null,
      });
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: jsonHeaders });
    }

    if (action === "list") {
      if (allowedClinicIds.length === 0) {
        return new Response(JSON.stringify({ queues: [], offers: [] }), { headers: jsonHeaders });
      }

      const { data: queues, error } = await supabase
        .from("waiting_list")
        .select("id, clinic_id, professional_id, specialty_id, queue_position, queue_status, entered_at, offered_appointment_date, offered_appointment_time, offered_professional_name, slot_expires_at, professional:professionals!waiting_list_professional_id_fkey(id, name)")
        .in("clinic_id", allowedClinicIds)
        .eq("patient_id", patientId)
        .order("entered_at", { ascending: false });
      if (error) throw error;

      const { data: offers } = await supabase
        .from("waiting_list_offers")
        .select("id, clinic_id, waiting_list_id, professional_id, appointment_date, start_time, end_time, expires_at, status, offered_at")
        .in("clinic_id", allowedClinicIds)
        .eq("patient_id", patientId)
        .order("offered_at", { ascending: false })
        .limit(20);

      // Live FIFO position among active peers
      const enriched = [] as unknown[];
      for (const q of queues ?? []) {
        let position: number | null = null;
        if (q.queue_status === "ATIVO") {
          const professionalFilter = q.professional_id
            ? `professional_id.is.null,professional_id.eq.${q.professional_id}`
            : "professional_id.is.null";
          const { count } = await supabase
            .from("waiting_list")
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", q.clinic_id)
            .eq("queue_status", "ATIVO")
            .lte("entered_at", q.entered_at)
            .or(professionalFilter);
          position = count ?? null;
        }
        enriched.push({ ...q, live_position: position });
      }

      return new Response(JSON.stringify({ queues: enriched, offers: offers ?? [] }), { headers: jsonHeaders });
    }

    if (action === "accept" || action === "decline") {
      if (!UUID.test(String(offerId ?? ""))) {
        return new Response(JSON.stringify({ error: "invalid offerId" }), { status: 400, headers: jsonHeaders });
      }
      const fn = action === "accept" ? "wl_accept_offer" : "wl_decline_offer";
      const { data, error } = await supabase.rpc(fn, { p_offer_id: offerId, p_patient_id: patientId });
      if (error) throw error;

      const result = data as Record<string, unknown>;

      // When declined, the RPC already offered the slot to the next in line.
      if (action === "decline") {
        const next = result?.next as Record<string, unknown> | undefined;
        if (next?.offered === true && next?.patient_id) {
          try {
            await supabase.functions.invoke("send-push-notification", {
              body: {
                clinic_id: clinicId,
                title: "Nova oportunidade de agendamento",
                body: "Uma vaga ficou disponível para você. Toque para aceitar ou recusar.",
                target_type: "specific",
                target_patient_ids: [next.patient_id],
                url: "/app/filas",
              },
            });
          } catch (_) { /* best effort */ }
        }
      }

      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: "invalid action" }), { status: 400, headers: jsonHeaders });
  } catch (err) {
    console.error("[waiting-list-patient] error", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: jsonHeaders });
  }
});