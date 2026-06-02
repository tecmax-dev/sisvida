import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "sindical-documentos";
const PUBLIC_MARKER = `/object/public/${BUCKET}/`;
const SIGN_MARKER = `/object/sign/${BUCKET}/`;

function extractPath(value: string): string | null {
  if (!value) return null;
  if (value.includes(PUBLIC_MARKER)) {
    return value.split(PUBLIC_MARKER)[1]?.split("?")[0] ?? null;
  }
  if (value.includes(SIGN_MARKER)) {
    return value.split(SIGN_MARKER)[1]?.split("?")[0] ?? null;
  }
  if (!value.startsWith("http")) {
    return value.replace(/^\/+/, "").split("?")[0];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const rawValue: string = body?.value ?? body?.path ?? "";
    const expiresIn: number = Math.min(Number(body?.expiresIn) || 3600, 60 * 60 * 24);

    const path = extractPath(rawValue);
    if (!path) {
      return new Response(
        JSON.stringify({ error: "invalid_path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorization: super admin or user with any union entity access
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: userId });
    let allowed = !!isSuper;
    if (!allowed) {
      const { data: hasAccess } = await admin.rpc("has_union_entity_access", { _user_id: userId });
      allowed = !!hasAccess;
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);

    if (signError || !signed?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "sign_failed", details: signError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ signedUrl: signed.signedUrl, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});