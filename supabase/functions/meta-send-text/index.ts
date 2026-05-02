import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const WINDOW_HOURS = 24;

interface SendBody {
  to: string;
  text: string;
  ticket_id?: string;
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
    let PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID");

    // Fallback para o ID real do número 73 3231 1784 caso esteja usando o ID de teste
    if (!PHONE_ID || PHONE_ID === "1077266392140414") {
      console.log("[meta-send-text] Utilizando ID real do número 73 3231 1784 (937233212814035)");
      PHONE_ID = "937233212814035";
    }

    const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!PHONE_ID || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "Credenciais Meta ausentes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: SendBody = await req.json();
    const { to, text, ticket_id } = body;

    if (!to || !text?.trim()) {
      return new Response(
        JSON.stringify({ error: "to e text são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const phone = normalizePhone(to);

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

    const windowOpen = lastInbound
      ? Date.now() - new Date(lastInbound).getTime() < WINDOW_HOURS * 3600 * 1000
      : false;

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
