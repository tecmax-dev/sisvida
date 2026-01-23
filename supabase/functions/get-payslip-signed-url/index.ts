import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  path?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json(401, { error: "Not authenticated" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client (respects the caller JWT)
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) return json(401, { error: "Not authenticated" });

    const { path }: Body = await req.json();
    if (!path) return json(400, { error: "Missing 'path'" });

    const clinicId = path.split("/")[0];
    if (!clinicId || !isUuid(clinicId)) return json(400, { error: "Invalid path" });

    // Admin client (bypasses RLS) — MUST validate access manually.
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Allow access if user has a role for this clinic OR is a global moderator.
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .or(`clinic_id.eq.${clinicId},and(clinic_id.is.null,role.eq.moderator)`)
      .limit(1);

    if (rolesError) return json(500, { error: "Failed to verify permissions" });
    if (!roles || roles.length === 0) return json(403, { error: "Forbidden" });

    const { data, error } = await supabaseAdmin.storage
      .from("contra-cheques")
      .createSignedUrl(path, 60 * 60);

    if (error) {
      const msg = (error as any)?.message || "Object not found";
      const isNotFound = msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("object not found");
      return json(isNotFound ? 404 : 500, { error: msg });
    }

    if (!data?.signedUrl) return json(404, { error: "Object not found" });

    return json(200, { signedUrl: data.signedUrl });
  } catch (err) {
    console.error("[get-payslip-signed-url] error", err);
    return json(500, { error: "Internal error" });
  }
});
