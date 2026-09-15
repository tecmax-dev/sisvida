import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    await requireStaff(req);
  } catch (authErr) {
    const denied = authErrorResponse(authErr, corsHeaders);
    if (denied) return denied;
    throw authErr;
  }


  try {
    const body = await req.json();
    const action = body.action;
    const conversation_id = body.conversation_id;
    
    const PROBE_ID = "PROBE_AUDIT_V3";

    if (action === "audit-real-click-1632" || action === "ping-probe" || action === "get-message-raw") {
        if (action === "ping-probe") return new Response(JSON.stringify({ ok: true, probe: PROBE_ID }), { headers: corsHeaders });
        
        const clinicId = body.clinicId || body.clinic_id || "89e7585e-7bce-4e58-91fa-c37080d1170d";
        const secretName = `CHATWOOT_TOKEN_${clinicId.replace(/-/g, "_")}`;
        const cw_token = Deno.env.get(secretName) || Deno.env.get("CHATWOOT_TOKEN_89e7585e_7bce_4e58_91fa_c37080d1170d") || "";
        const CW_URL = "https://chat.zapresponde.app/api/v1/accounts/1";
        
        const msgRes = await fetch(`${CW_URL}/conversations/${conversation_id}/messages`, {
            headers: { "api_access_token": cw_token, "Content-Type": "application/json" }
        });
        const messages = await msgRes.json();
        const messages_list = messages.payload || [];

        if (action === "get-message-raw") {
            const msgId = body.message_id;
            const msg = messages_list.find((m: any) => String(m.id) === String(msgId));
            return new Response(JSON.stringify({ probe: PROBE_ID, message: msg }), { headers: corsHeaders });
        }
        
        const result = messages_list.map((m: any) => ({
            id: m.id,
            message_type: m.message_type,
            content: m.content,
            created_at: m.created_at,
            content_attributes: m.content_attributes,
            source_id: m.source_id
        }));

        return new Response(JSON.stringify({ 
            probe: PROBE_ID,
            conversation_id,
            messages: result.slice(0, 50)
        }), { headers: corsHeaders });
    }

    // Teste de conexão: lista as caixas de entrada da conta no Chatwoot.
    if (action === "test-connection") {
      const clinicId = body.clinicId || body.clinic_id || "89e7585e-7bce-4e58-91fa-c37080d1170d";
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: cfg } = await supabase
        .from("chatwoot_configs")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (!cfg) {
        return new Response(JSON.stringify({ ok: false, message: "Configuração não encontrada." }), { headers: corsHeaders });
      }

      const secretName = cfg.chatwoot_api_token_secret_name ||
        `CHATWOOT_TOKEN_${clinicId.replace(/-/g, "_")}`;
      const token = Deno.env.get(secretName) ?? "";
      const baseUrl = String(cfg.chatwoot_base_url ?? "").replace(/\/+$/, "");
      if (!token || !baseUrl) {
        return new Response(JSON.stringify({ ok: false, message: "Endereço ou token ausente." }), { headers: corsHeaders });
      }

      const res = await fetch(`${baseUrl}/api/v1/accounts/${cfg.chatwoot_account_id}/inboxes`, {
        headers: { api_access_token: token, "Content-Type": "application/json" },
      });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* resposta não-JSON */ }

      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.payload) ? parsed.payload : [];
      const okConn = res.ok && Array.isArray(list);

      await supabase.from("chatwoot_configs").update({
        connection_status: okConn ? "CONNECTED" : "ERROR",
        last_test_at: new Date().toISOString(),
        last_test_status: okConn ? `OK (${list.length} caixas)` : `HTTP ${res.status}`,
      }).eq("clinic_id", clinicId);

      if (!okConn) {
        return new Response(JSON.stringify({ ok: false, message: `Falha na conexão (HTTP ${res.status}).` }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        ok: true,
        inboxes: list.map((i: any) => ({ id: i.id, name: i.name, channel_type: i.channel_type })),
        webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/chatwoot-webhook?key=${cfg.webhook_secret ?? ""}`,
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: `Action ${action} unknown`, probe: PROBE_ID }), { status: 400, headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
