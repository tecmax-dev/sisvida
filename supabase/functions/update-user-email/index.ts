import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token) return json({ error: "Não autorizado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Não autorizado" }, 401);
    const caller = userData.user;

    const { targetUserId, newEmail } = await req.json();
    if (!targetUserId || !newEmail) {
      return json({ error: "Dados incompletos" }, 400);
    }
    const email = String(newEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Formato de email inválido" }, 400);
    }

    // Authorization: super admin OR owner/admin of a clinic shared with the target user
    const { data: superAdmin } = await admin
      .from("super_admins")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();

    let allowed = !!superAdmin;

    if (!allowed) {
      const { data: callerRoles } = await admin
        .from("user_roles")
        .select("clinic_id, role")
        .eq("user_id", caller.id)
        .in("role", ["owner", "admin"]);

      const adminClinics = (callerRoles ?? [])
        .map((r: any) => r.clinic_id)
        .filter(Boolean);

      if (adminClinics.length > 0) {
        const { data: targetRoles } = await admin
          .from("user_roles")
          .select("clinic_id")
          .eq("user_id", targetUserId)
          .in("clinic_id", adminClinics);
        allowed = (targetRoles ?? []).length > 0;
      }
    }

    if (!allowed) return json({ error: "Não autorizado" }, 403);

    const { error: updateErr } = await admin.auth.admin.updateUserById(
      targetUserId,
      { email, email_confirm: true },
    );
    if (updateErr) {
      const msg = String(updateErr.message || "");
      if (msg.toLowerCase().includes("already")) {
        return json({ error: "Este email já está em uso por outro usuário" }, 400);
      }
      return json({ error: msg || "Erro ao atualizar email" }, 400);
    }

    await admin.from("profiles").update({ email }).eq("user_id", targetUserId);

    return json({ success: true, email });
  } catch (e) {
    console.error("update-user-email error", e);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
