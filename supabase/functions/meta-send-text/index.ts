import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveMetaCreds, type MetaApiVersion } from "../_shared/meta-creds.ts";
import { blockedByOptOut } from "../_shared/opt-out.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const WINDOW_HOURS = 24;

// Chatgoo já está integrado nativamente à Meta WhatsApp Cloud API e recebe
// inbound e outgoing echoes diretamente. Mirror local removido para evitar
// duplicação de mensagens no painel e loops via meta-webhook.

interface SendBody {
  to: string;
  text: string;
  ticket_id?: string;
  phone_number_id?: string;
  token?: string;
  api_version?: MetaApiVersion;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body: SendBody = await req.json();
    const { to, text, ticket_id, phone_number_id, token, api_version } = body;

    const creds = await resolveMetaCreds(api_version);
    let TOKEN = token || creds.token;
    if (token === "SYSTEM") {
      TOKEN = Deno.env.get("META_SYSTEM_USER_TOKEN") || TOKEN;
    }
    const PHONE_ID = phone_number_id || creds.phoneNumberId;
    console.log(`[meta-send-text] Using API ${creds.active} phone_id=${PHONE_ID}`);

    if (!PHONE_ID || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "Credenciais Meta ausentes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!to || !text?.trim()) {
      return new Response(
        JSON.stringify({ error: "to e text são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const phone = normalizePhone(to);

    // Hard-stop on opt-out: mensagens livres do operador também respeitam.
    const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
    if (await blockedByOptOut({
      clinicId: SINDICATO_CLINIC_ID,
      phone,
      sourceFunction: "meta-send-text",
    })) {
      return new Response(
        JSON.stringify({
          error: "OPT_OUT",
          message: "Contato com opt-out ativo (PARAR). Envio bloqueado.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verificar janela de 24h: precisa de inbound recente nesse contato
    let lastInbound: string | null = null;
    if (ticket_id) {
      const { data } = await supabase
        .from("whatsapp_tickets")
        .select("last_inbound_at")
        .eq("id", ticket_id)
        .maybeSingle();
      lastInbound = data?.last_inbound_at ?? null;
    } else {
      const { data: contact } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (contact?.id) {
        const { data } = await supabase
          .from("whatsapp_tickets")
          .select("last_inbound_at")
          .eq("contact_id", contact.id)
          .order("last_inbound_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        lastInbound = data?.last_inbound_at ?? null;
      }
    }

     const now = Date.now();
     const lastInboundTime = lastInbound ? new Date(lastInbound).getTime() : 0;
     const diffMs = now - lastInboundTime;
     const windowOpen = lastInboundTime > 0 && diffMs < WINDOW_HOURS * 3600 * 1000;
 
     console.log(`[meta-send-text] Phone: ${phone}, Last Inbound: ${lastInbound}, Diff: ${Math.round(diffMs/1000/60)}min, Window Open: ${windowOpen}`);

    if (!windowOpen) {
      return new Response(
        JSON.stringify({
          error: "WINDOW_CLOSED",
          message:
            "Janela de 24h fechada. Para reabrir o atendimento, envie um template aprovado primeiro.",
          last_inbound_at: lastInbound,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    };

    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const json = await res.json();

    if (!res.ok) {
      console.error("[meta-send-text] Meta error:", json);
      return new Response(
        JSON.stringify({ error: "Falha no envio Meta", meta: json }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messageId = json.messages?.[0]?.id ?? null;

    if (ticket_id) {
      await supabase.from("whatsapp_ticket_messages").insert({
        ticket_id,
        sender_type: "operator",
        message_type: "text",
        content: text,
        metadata: { meta_message_id: messageId },
      });
      await supabase
        .from("whatsapp_tickets")
        .update({ last_message_at: new Date().toISOString(), last_message: text })
        .eq("id", ticket_id);
    }

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[meta-send-text] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
