import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = [
  "owner",
  "admin",
  "receptionist",
  "professional",
  "administrative",
  "entidade_sindical_admin",
  "moderator",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth - validate caller is super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Check super admin
    const { data: isSuper } = await admin.rpc("is_super_admin", {
      _user_id: userData.user.id,
    });

    if (!isSuper) {
      return new Response(JSON.stringify({ error: "Apenas Super Admin pode alterar roles" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, clinic_id, role, access_group_id } = body;

    if (!user_id || !clinic_id || !role) {
      return new Response(
        JSON.stringify({ error: "user_id, clinic_id e role são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "Role inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update existing user_role for that user+clinic
    const { data: existing, error: findErr } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user_id)
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (findErr) throw findErr;

    if (!existing) {
      return new Response(
        JSON.stringify({ error: "Vínculo não encontrado para este usuário/clínica" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateErr } = await admin
      .from("user_roles")
      .update({
        role,
        access_group_id: access_group_id || null,
      })
      .eq("id", existing.id);

    if (updateErr) throw updateErr;

    // Audit log
    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "update_user_role",
      entity_type: "user_role",
      entity_id: existing.id,
      details: { target_user_id: user_id, clinic_id, role, access_group_id },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("update-user-role error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
