import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonOk(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Initialize Supabase client at module level for faster cold starts
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const startTime = Date.now();
  console.log("[employer-portal-auth] Request received");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, cnpj, access_code, employer_id, contribution_id, reason, union_entity_id } = body;
    console.log("[employer-portal-auth] Action:", action, "Time:", Date.now() - startTime, "ms");

    // Limpar CNPJ (apenas números)
    const cleanCnpj = cnpj?.replace(/\D/g, "");

    if (action === "login") {
      if (!cleanCnpj || !access_code) {
        return jsonOk({ success: false, error: "CNPJ e código de acesso são obrigatórios", code: "missing_credentials" });
      }

      console.log("[employer-portal-auth] Querying employer by CNPJ:", cleanCnpj);
      const queryStart = Date.now();
      
      const { data: employer, error } = await supabase
        .from("employers")
        .select("id, name, cnpj, clinic_id, access_code, access_code_expires_at, union_entity_id, category_id")
        .eq("cnpj", cleanCnpj)
        .maybeSingle();

      console.log("[employer-portal-auth] Query completed in:", Date.now() - queryStart, "ms");

      if (error) {
        console.error("[employer-portal-auth] DB error:", error);
        return jsonOk({ success: false, error: "Erro ao consultar banco de dados", code: "db_error" });
      }

      if (!employer) {
        return jsonOk({ success: false, error: "CNPJ não encontrado", code: "cnpj_not_found" });
      }

      if (!employer.access_code) {
        return jsonOk({ success: false, error: "Código de acesso não configurado. Entre em contato com o sindicato.", code: "access_code_missing" });
      }

      if (employer.access_code !== access_code.toUpperCase()) {
        return jsonOk({ success: false, error: "Código de acesso inválido", code: "invalid_access_code" });
      }

      if (employer.access_code_expires_at && new Date(employer.access_code_expires_at) < new Date()) {
        return jsonOk({ success: false, error: "Código de acesso expirado. Solicite um novo código.", code: "access_code_expired" });
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

      // Atualizar último acesso (best-effort)
      try {
        await supabase
          .from("employers")
          .update({ portal_last_access_at: new Date().toISOString() })
          .eq("id", employer.id);
      } catch (e) {
        console.error("[employer-portal-auth] warn update_last_access failed:", e);
      }

      // Registrar log (best-effort)
      try {
        await supabase.from("employer_portal_logs").insert({
          employer_id: employer.id,
          action: "login",
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { union_entity_id: employer.union_entity_id },
        });
      } catch (e) {
        console.error("[employer-portal-auth] warn portal_logs insert failed:", e);
      }

      const sessionToken = btoa(`${employer.id}:${Date.now()}`);

      return jsonOk({
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
      });
    }

    if (action === "get_contributions") {
      if (!employer_id) {
        return jsonOk({ success: false, error: "ID da empresa não informado", code: "missing_employer_id" });
      }

      if (union_entity_id) {
        const { data: employer } = await supabase
          .from("employers")
          .select("union_entity_id")
          .eq("id", employer_id)
          .single();
        
        if (employer && employer.union_entity_id !== union_entity_id) {
          return jsonOk({ success: false, error: "Acesso não autorizado a esta empresa", code: "unauthorized" });
        }
      }

      const { data: employerData } = await supabase
        .from("employers")
        .select("clinic_id")
        .eq("id", employer_id)
        .single();

      let hidePendingBeforeDate: string | null = null;
      if (employerData?.clinic_id) {
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("hide_pending_before_date")
          .eq("id", employerData.clinic_id)
          .single();
        
        hidePendingBeforeDate = clinicData?.hide_pending_before_date || null;
      }

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
        return jsonOk({ success: false, error: "Erro ao buscar contribuições", code: "db_error" });
      }

      let filteredContributions = contributions || [];
      if (hidePendingBeforeDate) {
        const hideDate = new Date(hidePendingBeforeDate);
        filteredContributions = filteredContributions.filter(c => {
          if ((c.status === 'pending' || c.status === 'overdue') && c.due_date) {
            const dueDate = new Date(c.due_date);
            return dueDate >= hideDate;
          }
          return true;
        });
      }

      // Registrar log (best-effort)
      try {
        await supabase.from("employer_portal_logs").insert({
          employer_id,
          action: "view_contributions",
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
        });
      } catch (e) {
        console.error("[employer-portal-auth] warn portal_logs view_contributions failed:", e);
      }

      return jsonOk({ contributions: filteredContributions });
    }

    if (action === "request_reissue") {
      if (!employer_id || !contribution_id) {
        return jsonOk({ success: false, error: "Dados incompletos para solicitação", code: "missing_data" });
      }

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
        return jsonOk({ success: false, error: "Erro ao criar solicitação", code: "db_error" });
      }

      // Registrar log (best-effort)
      try {
        await supabase.from("employer_portal_logs").insert({
          employer_id,
          action: "request_reissue",
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { contribution_id, request_id: data.id },
        });
      } catch (e) {
        console.error("[employer-portal-auth] warn portal_logs request_reissue failed:", e);
      }

      return jsonOk({ success: true, request: data });
    }

    if (action === "get_reissue_requests") {
      if (!employer_id) {
        return jsonOk({ success: false, error: "ID da empresa não informado", code: "missing_employer_id" });
      }

      const { data: requests, error } = await supabase
        .from("contribution_reissue_requests")
        .select("*")
        .eq("employer_id", employer_id)
        .order("created_at", { ascending: false });

      if (error) {
        return jsonOk({ success: false, error: "Erro ao buscar solicitações", code: "db_error" });
      }

      return jsonOk({ requests });
    }

    return jsonOk({ success: false, error: "Ação não reconhecida", code: "unknown_action" });
  } catch (error) {
    console.error("[employer-portal-auth] Error:", error);
    return jsonOk({ success: false, error: "Erro interno do servidor", code: "internal_error" });
  }
});
