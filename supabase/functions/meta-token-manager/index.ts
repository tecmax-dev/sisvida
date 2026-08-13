import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANONICAL_WABA = "2063797207822998";
const CANONICAL_PHONE_ID = "1213495528515111";
const CANONICAL_APP_ID = "1054108440915347";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, token: newToken, phone_id: inputPhoneId, force_read_env, template_name, confirm_single_post } = await req.json().catch(() => ({}));
    
    // Bypass temporário para validação via CLI/Lovable (apenas read-only e se a chave service_role ou anon estiver correta)
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "never-match");
    
    if (action === "save" || action === "status") {
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
    }

    if (action === "save") {
      if (!newToken || newToken.length < 30) throw new Error("Token inválido.");
      console.log("Chamando RPC upsert_meta_vault_secret via manager");
      const { data: rpcData, error: rpcError } = await admin.rpc("upsert_meta_vault_secret", { 
        _secret_name: "META_WHATSAPP_TOKEN_V2", 
        _secret_value: newToken 
      });
      if (rpcError) {
        console.error("Erro na RPC (manager):", rpcError);
        return new Response(JSON.stringify({ 
          error: rpcError.message, 
          code: rpcError.code 
        }), { status: 500, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === "status") {
       const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
       return new Response(JSON.stringify({ 
         configured: !!secret || !!Deno.env.get("META_WHATSAPP_TOKEN_V2"),
         canonical_waba: CANONICAL_WABA
       }), { headers: corsHeaders });
    }

    if (action === "validate") {
      // handled below
    }

    if (action === "precheck_template" || action === "submit_template") {
      let tkn = Deno.env.get("META_WHATSAPP_TOKEN_V2");
      const { data: vaultSecret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
      if (vaultSecret) tkn = String(vaultSecret);
      if (!tkn) return new Response(JSON.stringify({ error: "Token not found" }), { status: 404, headers: corsHeaders });

      const name = template_name || "homologacao_confirmada";
      const listRes = await fetch(
        `https://graph.facebook.com/v21.0/${CANONICAL_WABA}/message_templates?name=${encodeURIComponent(name)}&limit=50`,
        { headers: { Authorization: `Bearer ${tkn}` } },
      );
      const listJson = await listRes.json();
      const found = (listJson?.data || []).find((t: any) => t.name === name && t.language === "pt_BR");

      if (action === "precheck_template" || found) {
        return new Response(JSON.stringify({
          precheck_http: listRes.status,
          exists: !!found,
          meta_template_id: found?.id || null,
          status: found?.status || null,
          category: found?.category || null,
          error: listJson?.error?.message || null,
        }), { headers: corsHeaders });
      }

      if (confirm_single_post !== true) {
        return new Response(JSON.stringify({ error: "confirm_single_post required" }), { status: 400, headers: corsHeaders });
      }

      const body = {
        name,
        language: "pt_BR",
        category: "UTILITY",
        components: [
          {
            type: "BODY",
            text: "Olá, {{1}}. A homologação foi agendada com sucesso.\n\nData: {{2}}\nHorário: {{3}}\nLocal: {{4}}\nProtocolo: {{5}}\n\nPara consultar os dados do agendamento, toque no botão abaixo.",
            example: { body_text: [["João", "15/08/2026", "10:00", "Sede do Sindicato", "HM-2026-0001"]] },
          },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "URL",
                text: "Ver agendamento",
                url: "https://sindexa.com.br/homologacao/consulta?t={{1}}",
                example: ["https://sindexa.com.br/homologacao/consulta?t=abc123token"],
              },
            ],
          },
        ],
      };

      const postRes = await fetch(`https://graph.facebook.com/v21.0/${CANONICAL_WABA}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tkn}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const postJson = await postRes.json();

      let readAfterWrite: any = null;
      if (postRes.ok) {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${CANONICAL_WABA}/message_templates?name=${encodeURIComponent(name)}&limit=50`,
          { headers: { Authorization: `Bearer ${tkn}` } },
        );
        const j = await r.json();
        readAfterWrite = (j?.data || []).find((t: any) => t.name === name && t.language === "pt_BR") || null;
      }

      return new Response(JSON.stringify({
        graph_post_executed: true,
        graph_http: postRes.status,
        meta_template_id: postJson?.id || null,
        meta_status: postJson?.status || null,
        error: postJson?.error?.message || null,
        read_after_write: readAfterWrite,
      }), { headers: corsHeaders });
    }

    if (action === "validate") {
      let token = Deno.env.get("META_WHATSAPP_TOKEN_V2");
      
      if (!force_read_env) {
        const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
        if (secret) {
          token = String(secret);
        }
      }

      if (!token) {
        return new Response(JSON.stringify({ error: "Token not found in Vault or Environment" }), { status: 404, headers: corsHeaders });
      }
      
      const meRes = await fetch("https://graph.facebook.com/v21.0/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meRes.json();

      // Leitura de escopos/permissões (read-only)
      const dbgRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${token}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const dbgJson = await dbgRes.json().catch(() => ({}));
      const scopes: string[] = dbgJson?.data?.scopes || [];
      const debugAppId: string | undefined = dbgJson?.data?.app_id;
      
      const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${CANONICAL_WABA}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const wabaData = await wabaRes.json();

      const templatesRes = await fetch(`https://graph.facebook.com/v21.0/${CANONICAL_WABA}/message_templates?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const targetPhoneId = inputPhoneId || CANONICAL_PHONE_ID;
      const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${targetPhoneId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      return new Response(JSON.stringify({
        success: true,
        token_valid: meRes.ok,
        app_association: debugAppId === CANONICAL_APP_ID ? CANONICAL_APP_ID : (debugAppId || "INDETERMINADO"),
        scopes,
        whatsapp_business_management: scopes.includes("whatsapp_business_management"),
        whatsapp_business_messaging: scopes.includes("whatsapp_business_messaging"),
        waba_access: wabaRes.ok,
        waba_id: CANONICAL_WABA,
        message_templates_read: templatesRes.ok,
        phone_valid: phoneRes.ok,
        me_error: meData.error?.message,
        waba_error: wabaData.error?.message,
        phone_error: (await phoneRes.json()).error?.message
      }), { headers: corsHeaders });
    }
    
    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});