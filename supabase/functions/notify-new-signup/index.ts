import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { userName, userEmail, userPhone, businessType, userId } = await req.json();

    console.log(`[notify-new-signup] Novo cadastro recebido: ${userName} (${userEmail})`);

    // Get all super admins
    const { data: superAdmins, error: adminError } = await supabase
      .from("super_admins")
      .select("user_id");

    if (adminError) {
      console.error("[notify-new-signup] Erro ao buscar super admins:", adminError);
      throw adminError;
    }

    console.log(`[notify-new-signup] Encontrados ${superAdmins?.length || 0} super admins`);

    // Create audit log entry for each super admin
    const auditLogs = (superAdmins || []).map((admin) => ({
      action: "new_user_signup",
      entity_type: "user",
      entity_id: userId || null,
      user_id: admin.user_id,
      details: {
        new_user_name: userName,
        new_user_email: userEmail,
        new_user_phone: userPhone,
        business_type: businessType,
        signup_timestamp: new Date().toISOString(),
      },
      user_agent: req.headers.get("user-agent") || "edge-function",
    }));

    if (auditLogs.length > 0) {
      const { error: insertError } = await supabase
        .from("audit_logs")
        .insert(auditLogs);

      if (insertError) {
        console.error("[notify-new-signup] Erro ao inserir audit logs:", insertError);
        throw insertError;
      }

      console.log(`[notify-new-signup] ${auditLogs.length} notificações criadas com sucesso`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified_admins: superAdmins?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[notify-new-signup] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
