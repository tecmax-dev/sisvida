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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, cnpj, access_code, employer_id, contribution_id, reason, union_entity_id } = await req.json();

    // Limpar CNPJ (apenas números)
    const cleanCnpj = cnpj?.replace(/\D/g, "");

    if (action === "login") {
      // Validar CNPJ e código de acesso
      if (!cleanCnpj || !access_code) {
        return new Response(
          JSON.stringify({ error: "CNPJ e código de acesso são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar empresa - agora incluindo union_entity_id e category_id para isolamento e filtragem de CCTs
      const { data: employer, error } = await supabase
        .from("employers")
        .select("id, name, cnpj, clinic_id, access_code, access_code_expires_at, union_entity_id, category_id")
        .eq("cnpj", cleanCnpj)
        .single();

      if (error || !employer) {
        return new Response(
          JSON.stringify({ error: "CNPJ não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!employer.access_code) {
        return new Response(
          JSON.stringify({ error: "Código de acesso não configurado. Entre em contato com o sindicato." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (employer.access_code !== access_code.toUpperCase()) {
        return new Response(
          JSON.stringify({ error: "Código de acesso inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar expiração
      if (employer.access_code_expires_at && new Date(employer.access_code_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Código de acesso expirado. Solicite um novo código." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar dados do sindicato vinculado (se houver)
      let unionEntity = null;
      if (employer.union_entity_id) {
        const { data: entity } = await supabase
          .from("union_entities")
          .select("id, razao_social, nome_fantasia, cnpj, entity_type")
          .eq("id", employer.union_entity_id)
          .single();
        unionEntity = entity;
      }

      // Atualizar último acesso
      await supabase
        .from("employers")
        .update({ portal_last_access_at: new Date().toISOString() })
        .eq("id", employer.id);

      // Registrar log
      await supabase.from("employer_portal_logs").insert({
        employer_id: employer.id,
        action: "login",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        details: { union_entity_id: employer.union_entity_id },
      });

      // Gerar token de sessão simples (base64 do employer_id + timestamp)
      const sessionToken = btoa(`${employer.id}:${Date.now()}`);

      return new Response(
        JSON.stringify({
          success: true,
          employer: {
            id: employer.id,
            name: employer.name,
            cnpj: employer.cnpj,
            clinic_id: employer.clinic_id,
            union_entity_id: employer.union_entity_id,
            category_id: employer.category_id,
          },
          union_entity: unionEntity,
          session_token: sessionToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_contributions") {
      if (!employer_id) {
        return new Response(
          JSON.stringify({ error: "ID da empresa não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar que a empresa pertence ao sindicato correto (se especificado)
      if (union_entity_id) {
        const { data: employer } = await supabase
          .from("employers")
          .select("union_entity_id")
          .eq("id", employer_id)
          .single();
        
        if (employer && employer.union_entity_id !== union_entity_id) {
          return new Response(
            JSON.stringify({ error: "Acesso não autorizado a esta empresa" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Buscar o clinic_id da empresa para verificar configuração de ocultação
      const { data: employerData } = await supabase
        .from("employers")
        .select("clinic_id")
        .eq("id", employer_id)
        .single();

      // Buscar configuração de ocultação de pendências
      let hidePendingBeforeDate: string | null = null;
      if (employerData?.clinic_id) {
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("hide_pending_before_date")
          .eq("id", employerData.clinic_id)
          .single();
        
        hidePendingBeforeDate = clinicData?.hide_pending_before_date || null;
      }

      // Buscar contribuições com informação de negociação
      let query = supabase
        .from("employer_contributions")
        .select(`
          *,
          contribution_type:contribution_types(name),
          negotiation:debt_negotiations(id, negotiation_code, status, installments_count)
        `)
        .eq("employer_id", employer_id);

      const { data: contributions, error } = await query
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar contribuições" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filtrar contribuições ocultadas (pendentes/vencidas anteriores à data configurada)
      let filteredContributions = contributions || [];
      if (hidePendingBeforeDate) {
        const hideDate = new Date(hidePendingBeforeDate);
        filteredContributions = filteredContributions.filter(c => {
          // Ocultar apenas pendentes/vencidas anteriores à data
          if ((c.status === 'pending' || c.status === 'overdue') && c.due_date) {
            const dueDate = new Date(c.due_date);
            return dueDate >= hideDate;
          }
          return true; // Manter pagas, canceladas, awaiting_value, etc.
        });
      }

      // Registrar log
      await supabase.from("employer_portal_logs").insert({
        employer_id,
        action: "view_contributions",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      return new Response(
        JSON.stringify({ contributions: filteredContributions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "request_reissue") {
      if (!employer_id || !contribution_id) {
        return new Response(
          JSON.stringify({ error: "Dados incompletos para solicitação" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Criar solicitação de 2ª via
      const { data, error } = await supabase
        .from("contribution_reissue_requests")
        .insert({
          contribution_id,
          employer_id,
          reason: reason || "Solicitação de 2ª via pelo portal",
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar solicitação" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Registrar log
      await supabase.from("employer_portal_logs").insert({
        employer_id,
        action: "request_reissue",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        details: { contribution_id, request_id: data.id },
      });

      return new Response(
        JSON.stringify({ success: true, request: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_reissue_requests") {
      if (!employer_id) {
        return new Response(
          JSON.stringify({ error: "ID da empresa não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: requests, error } = await supabase
        .from("contribution_reissue_requests")
        .select("*")
        .eq("employer_id", employer_id)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar solicitações" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ requests }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não reconhecida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
