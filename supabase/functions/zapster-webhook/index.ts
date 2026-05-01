// zapster-webhook v1.0
// Recebe eventos da Zapster (Zap Responder) e os converte em payloads no formato
// Evolution API, repassando para a edge function `whatsapp-webhook` existente
// (que já implementa todo o fluxo LIA, atendimento humano, botões, etc.).
//
// Eventos suportados (Zapster docs):
//   - message.received  → vira "messages.upsert" Evolution-like
//   - instance.connected / instance.disconnected → atualiza zapster_configs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

interface ZapsterEvent {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, unknown> & {
    id?: string;
    sender?: { id?: string; name?: string; profile_picture?: string };
    recipient?: { id?: string; name?: string; type?: string };
    sent_at?: string;
    type?: string;
    content?: {
      text?: string;
      media?: { url?: string; metadata?: Record<string, unknown> };
      location?: Record<string, unknown>;
      view_once?: boolean;
      quoted?: unknown;
    };
    reason?: { code?: string; message?: string };
    profile_picture?: string;
    name?: string;
  };
  instance?: { id?: string };
}

function digitsOnly(v?: string): string {
  return (v || "").replace(/\D/g, "");
}

/**
 * Converte um evento `message.received` do Zapster no shape mínimo que o
 * `whatsapp-webhook` (formato Evolution API) consome.
 */
function zapsterMessageToEvolution(
  body: any,
  instanceName: string
): Record<string, unknown> {
  // Tenta extrair dados tanto do formato estruturado v1 quanto do novo formato detectado
  const rawMsg = body.raw_message || {};
  const msgData = body.data || {};
  
  // Mapeamento de campos (Zap Responder usa raw_message.from para o telefone do remetente)
  const senderId = digitsOnly(rawMsg.from || msgData.sender?.id || body.chatId);
  const remoteJid = `${senderId}@s.whatsapp.net`;
  const pushName = rawMsg.pushName || msgData.sender?.name || "";
  const messageId = rawMsg.id || msgData.id || body.id;
  
  // Conteúdo da mensagem
  const text = body.message?.mensagem || msgData.content?.text || "";
  const msgType = body.message?.type || msgData.type || "text";
  const mediaUrl = msgData.content?.media?.url;

  // Constrói message Evolution-like
  const message: Record<string, unknown> = {};
  if (msgType === "text") {
    message.conversation = text;
  } else if (msgType === "image") {
    message.imageMessage = { caption: text, url: mediaUrl };
  } else if (msgType === "audio") {
    message.audioMessage = { url: mediaUrl };
  } else if (msgType === "video") {
    message.videoMessage = { caption: text, url: mediaUrl };
  } else if (msgType === "document") {
    message.documentMessage = { caption: text, url: mediaUrl };
  } else {
    // fallback
    message.conversation = text || `[${msgType}]`;
  }

  return {
    event: "messages.upsert",
    instance: instanceName,
    data: {
      key: {
        remoteJid,
        fromMe: false,
        id: messageId,
      },
      message,
      messageTimestamp: rawMsg.timestamp || Math.floor(Date.now() / 1000),
      pushName,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const event = body as ZapsterEvent;
    const eventType = event.type || body.event_type;
    console.log(`[zapster-webhook] event type=${eventType} id=${event.id}`);

    // Resolve instance_id
    // Zapster pode enviar em múltiplos lugares: event.instance.id, data.instance_id, body.instance_id ou raw_message.device
    const instanceId =
      event.instance?.id ||
      (event.data as { instance_id?: string })?.instance_id ||
      body.instance_id ||
      body.raw_message?.device ||
      null;

    // Helper para logar evento
    const logEvent = async (entry: Record<string, unknown>) => {
      try {
        await supabase.from("zapster_webhook_logs").insert({
          clinic_id: entry.clinic_id ?? null,
          instance_id: instanceId,
          event_type: event.type,
          event_id: event.id,
          status: entry.status,
          summary: entry.summary,
          sender: entry.sender ?? null,
          message_preview: entry.message_preview ?? null,
          payload: event,
          forwarded_status: entry.forwarded_status ?? null,
          forwarded_response: entry.forwarded_response ?? null,
          error_message: entry.error_message ?? null,
        });
      } catch (err) {
        console.error("[zapster-webhook] failed to insert log", err);
      }
    };

    if (!instanceId) {
      console.warn("[zapster-webhook] no instance_id in payload, ignoring");
      await logEvent({ status: "ignored", summary: "Sem instance_id no payload" });
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Localiza clínica pelo instance_id
    const { data: cfg } = await supabase
      .from("zapster_configs")
      .select("clinic_id")
      .eq("instance_id", instanceId)
      .maybeSingle();

    if (!cfg) {
      console.warn(`[zapster-webhook] no clinic mapped to instance ${instanceId}`);
      await logEvent({ status: "ignored", summary: `Instância ${instanceId} não mapeada a nenhuma clínica` });
      return new Response(JSON.stringify({ ok: true, mapped: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trata eventos de status da instância
    if (event.type === "instance.connected") {
      await supabase
        .from("zapster_configs")
        .update({
          is_connected: true,
          connected_at: new Date().toISOString(),
          phone_number: digitsOnly((event.data as { id?: string }).id),
          last_status_check: new Date().toISOString(),
        })
        .eq("instance_id", instanceId);
      await logEvent({ clinic_id: cfg.clinic_id, status: "received", summary: "Instância conectada" });
      return new Response(JSON.stringify({ ok: true, status: "connected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "instance.disconnected") {
      await supabase
        .from("zapster_configs")
        .update({
          is_connected: false,
          last_status_check: new Date().toISOString(),
          notes: event.data?.reason?.message || null,
        })
        .eq("instance_id", instanceId);
      await logEvent({
        clinic_id: cfg.clinic_id,
        status: "received",
        summary: `Instância desconectada${event.data?.reason?.message ? ` — ${event.data.reason.message}` : ""}`,
      });
      return new Response(JSON.stringify({ ok: true, status: "disconnected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mensagem recebida → traduz e encaminha para whatsapp-webhook
    if (eventType === "message.received" || eventType === "message.upsert" || eventType === "message_received") {
      const evolutionLike: any = zapsterMessageToEvolution(body, instanceId);
      // Passa clinic_id explicitamente para facilitar o roteamento no whatsapp-webhook
      evolutionLike.clinic_id = cfg.clinic_id;
      console.log(`[zapster-webhook] forwarding message to whatsapp-webhook for clinic ${cfg.clinic_id}`);
      const senderId = digitsOnly(event.data.sender?.id);
      const senderName = event.data.sender?.name || "";
      const preview = (event.data.content?.text || `[${event.data.type || "media"}]`).substring(0, 200);

      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/whatsapp-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(evolutionLike),
        });
        const txt = await r.text();
        console.log(`[zapster-webhook] whatsapp-webhook responded ${r.status}: ${txt.substring(0, 200)}`);

        await logEvent({
          clinic_id: cfg.clinic_id,
          status: r.ok ? "forwarded" : "error",
          summary: r.ok ? "Mensagem encaminhada ao pipeline" : `Falha ao encaminhar (HTTP ${r.status})`,
          sender: senderName ? `${senderName} (${senderId})` : senderId,
          message_preview: preview,
          forwarded_status: r.status,
          forwarded_response: txt.substring(0, 500),
        });

        return new Response(JSON.stringify({ ok: true, forwarded: r.status }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        await logEvent({
          clinic_id: cfg.clinic_id,
          status: "error",
          summary: "Exceção ao encaminhar para whatsapp-webhook",
          sender: senderName ? `${senderName} (${senderId})` : senderId,
          message_preview: preview,
          error_message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    // Outros tipos: apenas log
    console.log(`[zapster-webhook] event ${event.type} not handled, acknowledged`);
    await logEvent({
      clinic_id: cfg.clinic_id,
      status: "ignored",
      summary: `Evento '${event.type}' não tratado`,
    });
    return new Response(JSON.stringify({ ok: true, handled: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[zapster-webhook] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
