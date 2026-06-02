import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SMTPLW_URL = "https://api.smtplw.com.br/v1/messages";
const FROM_EMAIL = "respostas@prosindweb.com.br";
const FROM_NAME = "ProsindWeb";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { message_id, to, subject, html, text } = body;

    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: to, subject, html|text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar mensagem original para threading (In-Reply-To / References)
    let inReplyTo: string | null = null;
    let references: string | null = null;
    let threadKey: string | null = null;
    let campaignId: string | null = null;
    if (message_id) {
      const { data: orig } = await supabase
        .from("email_inbox_messages")
        .select("message_id, email_references, thread_key, campaign_id")
        .eq("id", message_id)
        .maybeSingle();
      if (orig?.message_id) {
        inReplyTo = orig.message_id;
        references = [orig.email_references, orig.message_id].filter(Boolean).join(" ");
        threadKey = orig.thread_key || orig.message_id;
        campaignId = orig.campaign_id || null;
      }
    }

    const token = Deno.env.get("LOCAWEB_SMTPLW_API_TOKEN")!;
    const headers: Record<string, string> = {};
    if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
    if (references) headers["References"] = references;

    const payload: any = {
      subject,
      body: html || text,
      from: FROM_EMAIL,
      from_name: FROM_NAME,
      to,
      reply_to: FROM_EMAIL,
      headers,
    };
    if (text && html) payload.text = text;

    const resp = await fetch(SMTPLW_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth-token": token },
      body: JSON.stringify(payload),
    });
    const respText = await resp.text();
    if (!resp.ok) {
      console.error("SMTPLW err:", resp.status, respText);
      return new Response(JSON.stringify({ error: respText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salvar a resposta também na inbox (pasta 'sent') para histórico
    await supabase.from("email_inbox_messages").insert({
      message_id: `outbound-${crypto.randomUUID()}@prosindweb.com.br`,
      in_reply_to: inReplyTo,
      email_references: references,
      thread_key: threadKey,
      from_email: FROM_EMAIL,
      from_name: FROM_NAME,
      to_email: to,
      subject,
      body_html: html || null,
      body_text: text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""),
      snippet: (text || html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
      received_at: new Date().toISOString(),
      is_read: true,
      folder: "sent",
      campaign_id: campaignId,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});