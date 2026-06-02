import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function snippet(text: string | undefined | null, n = 180) {
  if (!text) return "";
  return String(text).replace(/\s+/g, " ").trim().slice(0, n);
}

function extractEmails(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    if (!item) return [];
    const text = typeof item === "object" ? JSON.stringify(item) : String(item);
    const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    return (matches || []).map((email) => email.toLowerCase());
  });
}

function getHeaderValue(headers: Record<string, unknown> | undefined, name: string): unknown {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

function firstString(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function getProvidedTokens(req: Request, url: URL): string[] {
  const tokens = [
    url.searchParams.get("token"),
    url.searchParams.get("secret"),
    url.searchParams.get("key"),
    req.headers.get("x-inbound-token"),
    req.headers.get("x-cloudmailin-token"),
  ];

  const authorization = req.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    tokens.push(authorization.slice(7).trim());
  }

  return tokens.filter((token): token is string => Boolean(token));
}

function isAllowedCloudMailinRecipient(payload: any): boolean {
  const allowed = new Set(
    [
      "b5f86f5e593b16d67136@cloudmailin.net",
      "respostas@prosindweb.com.br",
      ...(Deno.env.get("CLOUDMAILIN_INBOUND_ADDRESSES") || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ],
  );

  const headers = payload?.headers || {};
  const recipients = extractEmails([
    payload?.envelope?.to,
    payload?.to,
    getHeaderValue(headers, "to"),
    getHeaderValue(headers, "delivered-to"),
    getHeaderValue(headers, "x-original-to"),
  ]);

  return recipients.some((email) => allowed.has(email));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const expectedToken = Deno.env.get("POSTMARK_INBOUND_TOKEN");
  const hasValidToken = Boolean(expectedToken && getProvidedTokens(req, url).includes(expectedToken));
  const isCloudMailin = !!payload.envelope || !!payload.plain || !!payload.html;
  const hasAllowedCloudMailinRecipient = isCloudMailin && isAllowedCloudMailinRecipient(payload);

  if (!hasValidToken && !hasAllowedCloudMailinRecipient) {
    console.warn("[postmark-inbound] token/recipient inválido", {
      hasToken: getProvidedTokens(req, url).length > 0,
      isCloudMailin,
      hasAllowedCloudMailinRecipient,
    });
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Detecta o formato: CloudMailin (tem envelope) ou Postmark (tem FromFull/MessageID)
    const isCloudMailin = !!payload.envelope || !!payload.plain || !!payload.html;

    let fromEmail = "unknown@unknown";
    let fromName: string | null = null;
    let toEmail: string | null = null;
    let subject = "(sem assunto)";
    let bodyText = "";
    let bodyHtml: string | null = null;
    let inReplyTo: string | null = null;
    let references: string | null = null;
    let rawMessageId = "";
    let dateStr: string | null = null;
    let attachments: any[] = [];
    const rawHeaders: Record<string, string> = {};

    if (isCloudMailin) {
      // CloudMailin JSON Normalized: { envelope, headers, plain, html, reply_plain, attachments }
      const headers = payload.headers || {};
      for (const k of Object.keys(headers)) {
        rawHeaders[k] = Array.isArray(headers[k]) ? headers[k].join(", ") : String(headers[k]);
      }
      const fromHeader = firstString(getHeaderValue(headers, "from") || payload.envelope?.from || "");
      // Extrai "Nome <email>"
      const m = fromHeader.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
      if (m) {
        fromName = m[1].trim() || null;
        fromEmail = m[2].trim();
      } else {
        fromEmail = (payload.envelope?.from || fromHeader).trim() || "unknown@unknown";
      }
      toEmail = firstString(getHeaderValue(headers, "to") || payload.envelope?.to || null) || null;
      subject = firstString(getHeaderValue(headers, "subject") || "(sem assunto)");
      bodyText = payload.plain || payload.reply_plain || "";
      bodyHtml = payload.html || null;
      inReplyTo = firstString(getHeaderValue(headers, "in-reply-to")) || null;
      references = firstString(getHeaderValue(headers, "references")) || null;
      rawMessageId = firstString(getHeaderValue(headers, "message-id")) ||
        `<inbound-${crypto.randomUUID()}@cloudmailin.net>`;
      dateStr = firstString(getHeaderValue(headers, "date")) || null;
      attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    } else {
      // Postmark Inbound JSON
      fromEmail = payload.FromFull?.Email || payload.From || "unknown@unknown";
      fromName = payload.FromFull?.Name || payload.FromName || null;
      toEmail = Array.isArray(payload.ToFull)
        ? payload.ToFull.map((t: any) => t.Email).join(", ")
        : payload.To || null;
      subject = payload.Subject || "(sem assunto)";
      bodyText = payload.TextBody || payload.StrippedTextReply || "";
      bodyHtml = payload.HtmlBody || null;

      const headersArr: Array<{ Name: string; Value: string }> = payload.Headers || [];
      for (const h of headersArr) rawHeaders[h.Name] = h.Value;
      const getHeader = (name: string): string | null => {
        const h = headersArr.find((x) => x.Name?.toLowerCase() === name.toLowerCase());
        return h?.Value || null;
      };
      inReplyTo = getHeader("In-Reply-To");
      references = getHeader("References");
      rawMessageId = getHeader("Message-ID") ||
        (payload.MessageID
          ? `<${payload.MessageID}@inbound.postmarkapp.com>`
          : `<inbound-${crypto.randomUUID()}@prosindweb.com.br>`);
      dateStr = payload.Date || null;
      attachments = Array.isArray(payload.Attachments) ? payload.Attachments : [];
    }

    const threadKey = inReplyTo || rawMessageId || `${fromEmail}-${subject}`;

    // Tentar relacionar à campanha pelo subject (remove Re:/Fw:)
    let campaignId: string | null = null;
    const cleanSubj = subject.replace(/^(re|res|fw|fwd|enc):\s*/i, "").trim();
    if (cleanSubj) {
      const { data: camp } = await supabase
        .from("email_campaigns")
        .select("id")
        .eq("subject", cleanSubj)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (camp) campaignId = camp.id;
    }

    const hasAttachments = attachments.length > 0;

    const { error: insErr } = await supabase
      .from("email_inbox_messages")
      .insert({
        message_id: rawMessageId,
        in_reply_to: inReplyTo,
        email_references: references,
        thread_key: threadKey,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        snippet: snippet(bodyText || (bodyHtml ? String(bodyHtml).replace(/<[^>]+>/g, " ") : "")),
        received_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
        has_attachments: hasAttachments,
        size_bytes: (bodyText?.length || 0) + (bodyHtml?.length || 0),
        campaign_id: campaignId,
        raw_headers: rawHeaders,
        folder: "inbox",
        is_read: false,
      });

    if (insErr) {
      // Duplicado: ignorar silenciosamente (idempotência)
      if (insErr.message.includes("duplicate key")) {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[postmark-inbound] insert error:", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[postmark-inbound] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});