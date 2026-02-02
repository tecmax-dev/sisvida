import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * MOBILE BOOKING INIT - Edge Function (OTIMIZADO)
 * 
 * Esta função é o único ponto de entrada para o fluxo de agendamento mobile.
 * Elimina dependência de auth client-side e RLS policies.
 * 
 * OTIMIZAÇÕES v2:
 * - Queries executadas em PARALELO (Promise.all) em vez de sequencial
 * - Reduz latência de ~1500ms para ~400ms
 * 
 * GARANTIAS:
 * - Usa SERVICE_ROLE_KEY (bypassa RLS)
 * - Não depende de sessão do usuário
 * - Retorna todos os dados necessários em uma única chamada
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { patientId } = await req.json();

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "missing patientId", professionals: [], dependents: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // FASE 1: Buscar cartão (necessário para obter clinic_id)
    const { data: card, error: cardError } = await supabase
      .from("patient_cards")
      .select("clinic_id, expires_at, is_active")
      .eq("patient_id", patientId)
      .eq("is_active", true)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cardError) {
      console.error("[mobile-booking-init] Erro ao buscar cartão:", cardError);
      return new Response(
        JSON.stringify({ error: "card_lookup_failed", professionals: [], dependents: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sem cartão ativo
    if (!card?.clinic_id) {
      return new Response(
        JSON.stringify({ 
          noActiveCard: true,
          professionals: [], 
          dependents: [],
          clinicId: null,
          bookingMonthsAhead: 1
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clinicId = card.clinic_id;

    // Cartão expirado - use midday normalization to avoid timezone issues
    if (card.expires_at) {
      const expiryDate = new Date(card.expires_at);
      expiryDate.setUTCHours(12, 0, 0, 0);
      const nowMidDay = new Date();
      nowMidDay.setUTCHours(12, 0, 0, 0);
      
      if (expiryDate < nowMidDay) {
        return new Response(
          JSON.stringify({ 
            cardExpired: true,
            cardExpiryDate: card.expires_at,
            professionals: [], 
            dependents: [],
            clinicId,
            bookingMonthsAhead: 1
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // FASE 2: Executar TODAS as queries restantes em PARALELO
    const [
      clinicConfigResult,
      professionalsResult,
      patientResult,
      dependentsResult
    ] = await Promise.all([
      // Query 1: Config da clínica
      supabase
        .from("clinics")
        .select("booking_months_ahead")
        .eq("id", clinicId)
        .single(),

      // Query 2: Profissionais ativos com especialidades
      supabase
        .from("professionals")
        .select(`
          id, 
          name, 
          specialty, 
          appointment_duration, 
          schedule, 
          avatar_url,
          professional_specialties (
            specialty:specialties (
              id,
              name,
              category
            )
          )
        `)
        .eq("clinic_id", clinicId)
        .eq("is_active", true),

      // Query 3: Dados do paciente (bloqueio)
      supabase
        .from("patients")
        .select("no_show_blocked_until, no_show_unblocked_at, is_active")
        .eq("id", patientId)
        .single(),

      // Query 4: Dependentes via RPC
      supabase.rpc("get_patient_dependents", { p_patient_id: patientId })
    ]);

    // Processar resultados
    const bookingMonthsAhead = clinicConfigResult.data?.booking_months_ahead ?? 12;

    // Mapear profissionais
    const professionals = (professionalsResult.data || []).map((prof: any) => ({
      id: prof.id,
      name: prof.name,
      specialty: prof.specialty,
      appointment_duration: prof.appointment_duration,
      schedule: prof.schedule,
      avatar_url: prof.avatar_url,
      specialties: (prof.professional_specialties || [])
        .filter((ps: any) => ps.specialty)
        .map((ps: any) => ({
          id: ps.specialty.id,
          name: ps.specialty.name,
          category: ps.specialty.category,
        })),
    }));

    // Verificar bloqueio do paciente
    let blockedMessage: string | null = null;
    const patientData = patientResult.data;
    if (patientData) {
      if (patientData.no_show_blocked_until) {
        const blockedUntil = new Date(patientData.no_show_blocked_until);
        const isStillWithinBlock = new Date() < blockedUntil;
        const isUnblockedByAdmin = !!patientData.no_show_unblocked_at;

        if (isStillWithinBlock && !isUnblockedByAdmin) {
          blockedMessage = `Você está bloqueado para agendamentos até ${blockedUntil.toLocaleDateString("pt-BR")}`;
        }
      }

      if (!patientData.is_active) {
        blockedMessage = "Sua conta está inativa. Entre em contato com o sindicato.";
      }
    }

    const dependents = dependentsResult.data || [];

    // Log de performance
    const elapsed = Date.now() - startTime;
    console.log(`[mobile-booking-init] Completed in ${elapsed}ms (patient: ${patientId})`);

    // Retornar todos os dados
    return new Response(
      JSON.stringify({
        clinicId,
        professionals,
        dependents,
        blockedMessage,
        noActiveCard: false,
        cardExpired: false,
        bookingMonthsAhead,
        _debug: { elapsed_ms: elapsed }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[mobile-booking-init] Erro geral:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", professionals: [], dependents: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
