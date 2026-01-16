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

    const { action, email, access_code, accounting_office_id, union_entity_id } = await req.json();

    // Limpar email
    const cleanEmail = email?.toLowerCase().trim();

    if (action === "login") {
      // Validar email e código de acesso
      if (!cleanEmail || !access_code) {
        return new Response(
          JSON.stringify({ error: "E-mail e código de acesso são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar escritório - agora incluindo union_entity_id para isolamento multi-tenant
      const { data: office, error } = await supabase
        .from("accounting_offices")
        .select("id, name, email, clinic_id, access_code, access_code_expires_at, is_active, union_entity_id")
        .eq("email", cleanEmail)
        .single();

      if (error || !office) {
        return new Response(
          JSON.stringify({ error: "E-mail não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!office.is_active) {
        return new Response(
          JSON.stringify({ error: "Escritório inativo. Entre em contato com o sindicato." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!office.access_code) {
        return new Response(
          JSON.stringify({ error: "Código de acesso não configurado. Entre em contato com o sindicato." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (office.access_code !== access_code.toUpperCase()) {
        return new Response(
          JSON.stringify({ error: "Código de acesso inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar expiração
      if (office.access_code_expires_at && new Date(office.access_code_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Código de acesso expirado. Solicite um novo código." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar dados do sindicato vinculado (se houver)
      let unionEntity = null;
      if (office.union_entity_id) {
        const { data: entity } = await supabase
          .from("union_entities")
          .select("id, razao_social, nome_fantasia, cnpj, entity_type")
          .eq("id", office.union_entity_id)
          .single();
        unionEntity = entity;
      }

      // Atualizar último acesso
      await supabase
        .from("accounting_offices")
        .update({ portal_last_access_at: new Date().toISOString() })
        .eq("id", office.id);

      // Registrar log
      await supabase.from("accounting_office_portal_logs").insert({
        accounting_office_id: office.id,
        action: "login",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        details: { union_entity_id: office.union_entity_id },
      });

      // Gerar token de sessão simples (base64 do office_id + timestamp)
      const sessionToken = btoa(`${office.id}:${Date.now()}`);

      return new Response(
        JSON.stringify({
          success: true,
          accounting_office: {
            id: office.id,
            name: office.name,
            email: office.email,
            clinic_id: office.clinic_id,
            union_entity_id: office.union_entity_id,
          },
          union_entity: unionEntity,
          session_token: sessionToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_employers") {
      if (!accounting_office_id) {
        return new Response(
          JSON.stringify({ error: "ID do escritório não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar o escritório para obter o union_entity_id
      const { data: office } = await supabase
        .from("accounting_offices")
        .select("union_entity_id")
        .eq("id", accounting_office_id)
        .single();

      // Buscar empresas vinculadas
      const { data: links, error: linksError } = await supabase
        .from("accounting_office_employers")
        .select("employer_id")
        .eq("accounting_office_id", accounting_office_id);

      if (linksError) {
        console.error("Error fetching employer links:", linksError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar empresas vinculadas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const employerIds = links?.map(l => l.employer_id) || [];

      if (employerIds.length === 0) {
        return new Response(
          JSON.stringify({ employers: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar dados das empresas - filtrar pelo mesmo union_entity_id para isolamento
      let query = supabase
        .from("employers")
        .select("id, name, cnpj, trade_name, union_entity_id")
        .in("id", employerIds)
        .order("name");

      // Se o escritório tem um sindicato vinculado, filtrar apenas empresas do mesmo sindicato
      if (office?.union_entity_id) {
        query = query.eq("union_entity_id", office.union_entity_id);
      }

      const { data: employers, error: employersError } = await query;

      if (employersError) {
        console.error("Error fetching employers:", employersError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar empresas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Registrar log
      await supabase.from("accounting_office_portal_logs").insert({
        accounting_office_id,
        action: "view_employers",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      return new Response(
        JSON.stringify({ employers }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_contributions") {
      if (!accounting_office_id) {
        return new Response(
          JSON.stringify({ error: "ID do escritório não informado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar o escritório para obter o union_entity_id
      const { data: office } = await supabase
        .from("accounting_offices")
        .select("union_entity_id")
        .eq("id", accounting_office_id)
        .single();

      // Buscar empresas vinculadas
      const { data: links, error: linksError } = await supabase
        .from("accounting_office_employers")
        .select("employer_id")
        .eq("accounting_office_id", accounting_office_id);

      if (linksError) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar empresas vinculadas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const employerIds = links?.map(l => l.employer_id) || [];

      if (employerIds.length === 0) {
        return new Response(
          JSON.stringify({ contributions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se o escritório tem um sindicato vinculado, filtrar apenas empresas do mesmo sindicato
      let filteredEmployerIds = employerIds;
      if (office?.union_entity_id) {
        const { data: validEmployers } = await supabase
          .from("employers")
          .select("id")
          .in("id", employerIds)
          .eq("union_entity_id", office.union_entity_id);
        
        filteredEmployerIds = validEmployers?.map(e => e.id) || [];
      }

      if (filteredEmployerIds.length === 0) {
        return new Response(
          JSON.stringify({ contributions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar configuração de ocultação de pendências (usar clinic_id do escritório)
      const { data: officeData } = await supabase
        .from("accounting_offices")
        .select("clinic_id")
        .eq("id", accounting_office_id)
        .single();

      let hidePendingBeforeDate: string | null = null;
      if (officeData?.clinic_id) {
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("hide_pending_before_date")
          .eq("id", officeData.clinic_id)
          .single();
        
        hidePendingBeforeDate = clinicData?.hide_pending_before_date || null;
      }

      // Buscar contribuições de todas as empresas vinculadas com informação de negociação
      const { data: contributions, error } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employer:employers(id, name, cnpj),
          contribution_type:contribution_types(name),
          negotiation:debt_negotiations(id, negotiation_code, status, installments_count)
        `)
        .in("employer_id", filteredEmployerIds)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (error) {
        console.error("Error fetching contributions:", error);
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
      await supabase.from("accounting_office_portal_logs").insert({
        accounting_office_id,
        action: "view_contributions",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      return new Response(
        JSON.stringify({ contributions: filteredContributions }),
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
