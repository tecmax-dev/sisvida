import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, cpf, password, member_id, clinic_id } = await req.json();

    // ==================== LOGIN ====================
    if (action === "login") {
      if (!cpf || !password) {
        return new Response(
          JSON.stringify({ error: "CPF e senha são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize CPF (remove formatting)
      const normalizedCpf = cpf.replace(/\D/g, "");

      // Verify password via RPC
      const { data: patientData, error: rpcError } = await supabase.rpc("verify_patient_password", {
        p_cpf: normalizedCpf,
        p_password: password,
      });

      if (rpcError) {
        console.error("[member-portal-auth] RPC error:", rpcError);
        return new Response(
          JSON.stringify({ error: "Erro ao verificar credenciais" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!patientData || patientData.length === 0) {
        return new Response(
          JSON.stringify({ error: "CPF ou senha incorretos" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the patient for the target clinic if multiple exist
      const targetClinicId = clinic_id || "89e7585e-7bce-4e58-91fa-c37080d1170d";
      const patient = patientData.find((p: any) => p.clinic_id === targetClinicId) ?? patientData[0];

      if (!patient?.is_active) {
        return new Response(
          JSON.stringify({ error: "Conta inativa. Entre em contato com o sindicato." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get full patient data
      const { data: fullPatient, error: patientError } = await supabase
        .from("patients")
        .select("id, name, cpf, email, phone, photo_url, registration_number, clinic_id")
        .eq("id", patient.patient_id)
        .single();

      if (patientError || !fullPatient) {
        return new Response(
          JSON.stringify({ error: "Erro ao carregar dados do sócio" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log access
      await supabase.from("audit_logs").insert({
        action: "member_portal_login",
        entity_type: "patient",
        entity_id: fullPatient.id,
        user_id: fullPatient.id,
        details: { cpf: normalizedCpf, portal: "member" },
      });

      return new Response(
        JSON.stringify({
          success: true,
          member: {
            id: fullPatient.id,
            name: fullPatient.name,
            cpf: fullPatient.cpf,
            email: fullPatient.email,
            phone: fullPatient.phone,
            photo_url: fullPatient.photo_url,
            registration_number: fullPatient.registration_number,
            clinic_id: fullPatient.clinic_id,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== GET CONTRIBUTIONS ====================
    if (action === "get_contributions") {
      if (!member_id) {
        return new Response(
          JSON.stringify({ error: "ID do sócio é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get contributions linked to this member (PF contributions)
      const { data: contributions, error: contribError } = await supabase
        .from("employer_contributions")
        .select(`
          id,
          value,
          due_date,
          status,
          competence_month,
          competence_year,
          lytex_invoice_url,
          lytex_invoice_id,
          paid_at,
          public_access_token,
          contribution_types (id, name)
        `)
        .eq("member_id", member_id)
        .not("status", "eq", "cancelled")
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (contribError) {
        console.error("[member-portal-auth] Error fetching contributions:", contribError);
        return new Response(
          JSON.stringify({ error: "Erro ao carregar contribuições" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Transform to expected format
      const formatted = (contributions || []).map((c: any) => ({
        id: c.id,
        amount: c.value,
        due_date: c.due_date,
        status: c.status,
        competence_month: c.competence_month,
        competence_year: c.competence_year,
        lytex_invoice_url: c.lytex_invoice_url,
        lytex_invoice_id: c.lytex_invoice_id,
        paid_at: c.paid_at,
        public_access_token: c.public_access_token,
        contribution_type: c.contribution_types,
      }));

      return new Response(
        JSON.stringify({ contributions: formatted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== GET CARD DATA ====================
    if (action === "get_card") {
      if (!member_id) {
        return new Response(
          JSON.stringify({ error: "ID do sócio é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get patient card
      const { data: card, error: cardError } = await supabase
        .from("patient_cards")
        .select("*")
        .eq("patient_id", member_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({ card }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[member-portal-auth] Error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
