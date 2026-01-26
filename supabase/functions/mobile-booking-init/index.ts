import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * MOBILE BOOKING INIT - Edge Function
 * 
 * Esta função é o único ponto de entrada para o fluxo de agendamento mobile.
 * Elimina dependência de auth client-side e RLS policies.
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

    // 1. Buscar cartão ativo do paciente
    const { data: card, error: cardError } = await supabase
      .from("patient_cards")
      .select("clinic_id, expires_at, is_active")
      .eq("patient_id", patientId)
      .eq("is_active", true)
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
          clinicId: null
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cartão expirado
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          cardExpired: true,
          cardExpiryDate: card.expires_at,
          professionals: [], 
          dependents: [],
          clinicId: card.clinic_id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar profissionais ativos da clínica
    const { data: professionals, error: profError } = await supabase
      .from("professionals")
      .select("id, name, specialty, appointment_duration, schedule, avatar_url")
      .eq("clinic_id", card.clinic_id)
      .eq("is_active", true);

    if (profError) {
      console.error("[mobile-booking-init] Erro ao buscar profissionais:", profError);
    }

    // 3. Buscar dados do paciente (bloqueio, status)
    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("no_show_blocked_until, no_show_unblocked_at, is_active")
      .eq("id", patientId)
      .single();

    let blockedMessage: string | null = null;
    if (!patientError && patientData) {
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

    // 4. Buscar dependentes via RPC
    const { data: dependents, error: depError } = await supabase
      .rpc("get_patient_dependents", { p_patient_id: patientId });

    if (depError) {
      console.error("[mobile-booking-init] Erro ao buscar dependentes:", depError);
    }

    // 5. Retornar todos os dados
    return new Response(
      JSON.stringify({
        clinicId: card.clinic_id,
        professionals: professionals || [],
        dependents: dependents || [],
        blockedMessage,
        noActiveCard: false,
        cardExpired: false,
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
