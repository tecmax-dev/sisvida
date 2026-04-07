import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json(401, { error: "Not authenticated" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return json(401, { error: "Not authenticated" });

    const { path, bucket } = await req.json();
    if (!path) return json(400, { error: "Missing 'path'" });

    // Determine bucket - support both dependent-documents and dependent-cpf-photos
    const bucketName = bucket === "dependent-cpf-photos" ? "dependent-cpf-photos" : "dependent-documents";

    console.log(`[get-dependent-doc-signed-url] path=${path} bucket=${bucketName} user=${user.id}`);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify user has clinic access (extract from path or check any clinic role)
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (!roles || roles.length === 0) {
      return json(403, { error: "Forbidden" });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(path, 60 * 60);

    if (error) {
      console.error(`[get-dependent-doc-signed-url] Storage error:`, error);
      // Try fallback bucket
      if (bucketName === "dependent-cpf-photos") {
        const { data: data2, error: error2 } = await supabaseAdmin.storage
          .from("dependent-documents")
          .createSignedUrl(path, 60 * 60);
        if (!error2 && data2?.signedUrl) {
          return json(200, { signedUrl: data2.signedUrl });
        }
      } else {
        const { data: data2, error: error2 } = await supabaseAdmin.storage
          .from("dependent-cpf-photos")
          .createSignedUrl(path, 60 * 60);
        if (!error2 && data2?.signedUrl) {
          return json(200, { signedUrl: data2.signedUrl });
        }
      }
      return json(404, { error: "Object not found" });
    }

    if (!data?.signedUrl) return json(404, { error: "Object not found" });

    return json(200, { signedUrl: data.signedUrl });
  } catch (err) {
    console.error("[get-dependent-doc-signed-url] error", err);
    return json(500, { error: "Internal error" });
  }
});
