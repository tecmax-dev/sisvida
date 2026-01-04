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

    const { action, email, access_code, accounting_office_id } = await req.json();

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

      const { data: office, error } = await supabase
        .from("accounting_offices")
        .select("id, name, email, clinic_id, access_code, access_code_expires_at, is_active")
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
          },
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

      // Buscar dados das empresas
      const { data: employers, error: employersError } = await supabase
        .from("employers")
        .select("id, name, cnpj, trade_name")
        .in("id", employerIds)
        .order("name");

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

      // Buscar contribuições de todas as empresas vinculadas
      const { data: contributions, error } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employer:employers(id, name, cnpj),
          contribution_type:contribution_types(name)
        `)
        .in("employer_id", employerIds)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (error) {
        console.error("Error fetching contributions:", error);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar contribuições" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Registrar log
      await supabase.from("accounting_office_portal_logs").insert({
        accounting_office_id,
        action: "view_contributions",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      return new Response(
        JSON.stringify({ contributions }),
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
