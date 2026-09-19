import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token) return json({ error: "Token inválido" }, 200);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: panel } = await supabase
      .from("panels")
      .select("id, clinic_id, name, token, is_active, queue_ids, display_config")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!panel) return json({ error: "Painel não encontrado ou inativo" }, 200);

    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name, logo_url")
      .eq("id", panel.clinic_id)
      .maybeSingle();

    const { data: queues } = await supabase
      .from("queues")
      .select("id, name, display_mode")
      .eq("clinic_id", panel.clinic_id);

    const queueMap = new Map((queues || []).map((q) => [q.id, q]));
    const panelQueueIds: string[] = Array.isArray(panel.queue_ids) && panel.queue_ids.length
      ? panel.queue_ids
      : (queues || []).map((q) => q.id);

    // Chamadas do dia (fuso America/Sao_Paulo)
    const nowSp = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const startSp = new Date(
      Date.UTC(nowSp.getUTCFullYear(), nowSp.getUTCMonth(), nowSp.getUTCDate(), 3, 0, 0),
    ).toISOString();

    let callsQuery = supabase
      .from("queue_calls")
      .select(
        "id, queue_id, patient_id, appointment_id, professional_id, ticket_number, ticket_prefix, room_name, called_at, status",
      )
      .eq("clinic_id", panel.clinic_id)
      .in("status", ["called", "in_service"])
      .not("called_at", "is", null)
      .gte("called_at", startSp)
      .order("called_at", { ascending: false })
      .limit(6);

    if (panelQueueIds.length) callsQuery = callsQuery.in("queue_id", panelQueueIds);

    const { data: rawCalls } = await callsQuery;
    const calls = rawCalls || [];

    // Resolver nomes de paciente/dependente e profissional
    const patientIds = [...new Set(calls.map((c) => c.patient_id).filter(Boolean))] as string[];
    const appointmentIds = [...new Set(calls.map((c) => c.appointment_id).filter(Boolean))] as string[];
    const professionalIds = [...new Set(calls.map((c) => c.professional_id).filter(Boolean))] as string[];

    const [{ data: patients }, { data: appointments }, { data: professionals }] = await Promise.all([
      patientIds.length
        ? supabase.from("patients").select("id, name").in("id", patientIds)
        : Promise.resolve({ data: [] as any[] }),
      appointmentIds.length
        ? supabase.from("appointments").select("id, dependent_id, professional_id").in("id", appointmentIds)
        : Promise.resolve({ data: [] as any[] }),
      professionalIds.length
        ? supabase.from("professionals").select("id, name").in("id", professionalIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const apptMap = new Map((appointments || []).map((a) => [a.id, a]));
    const dependentIds = [
      ...new Set((appointments || []).map((a) => a.dependent_id).filter(Boolean)),
    ] as string[];

    const { data: dependents } = dependentIds.length
      ? await supabase.from("patient_dependents").select("id, name").in("id", dependentIds)
      : { data: [] as any[] };

    const missingProfIds = [
      ...new Set(
        (appointments || [])
          .map((a) => a.professional_id)
          .filter((id) => id && !professionalIds.includes(id)),
      ),
    ] as string[];

    const { data: extraProfs } = missingProfIds.length
      ? await supabase.from("professionals").select("id, name").in("id", missingProfIds)
      : { data: [] as any[] };

    const patientMap = new Map((patients || []).map((p) => [p.id, p.name]));
    const dependentMap = new Map((dependents || []).map((d) => [d.id, d.name]));
    const professionalMap = new Map(
      [...(professionals || []), ...(extraProfs || [])].map((p) => [p.id, p.name]),
    );

    const mapped = calls.map((c) => {
      const appt = c.appointment_id ? apptMap.get(c.appointment_id) : null;
      const patientName =
        (appt?.dependent_id ? dependentMap.get(appt.dependent_id) : null) ||
        (c.patient_id ? patientMap.get(c.patient_id) : null) ||
        "";
      const profId = c.professional_id || appt?.professional_id || null;
      const queue = queueMap.get(c.queue_id);
      return {
        id: c.id,
        queue_id: c.queue_id,
        patient_name: patientName,
        professional_name: profId ? professionalMap.get(profId) || null : null,
        room_name: c.room_name || null,
        ticket_number: `${c.ticket_prefix || ""}${c.ticket_number}`,
        called_at: c.called_at,
        status: c.status,
        queue: queue ? { name: queue.name, display_mode: queue.display_mode } : undefined,
      };
    });

    const { data: banners } = await supabase
      .from("panel_banners")
      .select("*")
      .eq("clinic_id", panel.clinic_id)
      .eq("is_active", true)
      .order("order_index");

    return json({
      panel: {
        id: panel.id,
        clinic_id: panel.clinic_id,
        name: panel.name,
        token: panel.token,
        is_active: panel.is_active,
      },
      clinic: clinic || null,
      currentCall: mapped[0] || null,
      recentCalls: mapped.slice(1),
      banners: banners || [],
    });
  } catch (e) {
    console.error("public-panel-data error", e);
    return json({ error: "Erro ao carregar painel" }, 200);
  }
});
