import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, token: newToken } = await req.json().catch(() => ({}));

    // Segurança: Verificar se o usuário está autenticado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: corsHeaders });
    }

    if (action === "save") {
      if (!newToken || newToken.length < 30) {
        return new Response(JSON.stringify({ error: "Token inválido ou muito curto." }), { status: 400, headers: corsHeaders });
      }

      // Persiste no vault através da RPC segura
      console.log("Chamando RPC upsert_meta_vault_secret para:", "META_WHATSAPP_TOKEN_V2");
      const { data: rpcData, error: rpcError } = await admin.rpc("upsert_meta_vault_secret", {
        _secret_name: "META_WHATSAPP_TOKEN_V2",
        _secret_value: newToken
      });

      if (rpcError) {
        console.error("Erro na RPC upsert_meta_vault_secret:", rpcError);
        return new Response(JSON.stringify({ 
          error: `Erro no banco de dados: ${rpcError.message}`,
          code: rpcError.code,
          hint: rpcError.hint
        }), { status: 500, headers: corsHeaders });
      }
      
      console.log("RPC executada com sucesso:", rpcData);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === "status") {
      const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
      
      return new Response(JSON.stringify({
        configured: !!secret,
        updated_at: new Date().toISOString(),
      }), { headers: corsHeaders });
    }

    if (action === "verify") {
      const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
      const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");

      if (!token) throw new Error("Token não configurado.");

      // READ-ONLY: GET /me para validar o token
      const meRes = await fetch("https://graph.facebook.com/v21.0/me?fields=id,name,app_id", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meRes.json();

      return new Response(JSON.stringify({
        ok: meRes.ok,
        me_http: meRes.status,
        app_id: meData.app_id || "N/A",
        waba_id: "2063797207822998",
        phone_id: "1213495528515111",
        template_name: "carteirinha_atualizacao_link",
        messages_sent: 0,
        meta_send: "READ-ONLY",
        whatsapp_enviado: 0
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
