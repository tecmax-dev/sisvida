import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.6.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function snippet(text: string | undefined, n = 180) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, n);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const host = Deno.env.get("IMAP_REPLIES_HOST")!;
  const port = Number(Deno.env.get("IMAP_REPLIES_PORT") || "993");
  const user = Deno.env.get("IMAP_REPLIES_USER")!;
  const pass = Deno.env.get("IMAP_REPLIES_PASSWORD")!;

  let imported = 0;
  let errors: string[] = [];

  const client = new ImapFlow({
    host, port, secure: port === 993,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const { data: stateRow } = await supabase
        .from("email_inbox_state")
        .select("last_uid")
        .eq("id", 1)
        .maybeSingle();
      const lastUid = Number(stateRow?.last_uid || 0);

      // Fetch novos UIDs maiores que lastUid
      const range = `${lastUid + 1}:*`;
      let maxUid = lastUid;

      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
        size: true,
        flags: true,
      }, { uid: true })) {
        if (!msg.uid || msg.uid <= lastUid) continue;
        if (msg.uid > maxUid) maxUid = msg.uid;

        try {
          const parsed = await simpleParser(msg.source as Uint8Array);
          const fromAddr = parsed.from?.value?.[0];
          const toAddrs = parsed.to as any;
          const fromEmail = fromAddr?.address || "unknown@unknown";
          const fromName = fromAddr?.name || null;
          const toEmail =
            (Array.isArray(toAddrs?.value) ? toAddrs.value : toAddrs?.value)
              ?.map((a: any) => a.address)
              .join(", ") || null;
          const inReplyTo = parsed.inReplyTo || null;
          const refs = Array.isArray(parsed.references)
            ? parsed.references.join(" ")
            : (parsed.references as string | undefined) || null;
          const threadKey = inReplyTo || parsed.messageId || `${fromEmail}-${parsed.subject || ""}`;

          // Tentar relacionar à campanha pelo subject (Re: ...)
          let campaignId: string | null = null;
          const cleanSubj = (parsed.subject || "").replace(/^(re|res|fw|fwd|enc):\s*/i, "").trim();
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

          const bodyText = parsed.text || "";
          const bodyHtml = (parsed.html as string) || null;

          const { error: insErr } = await supabase
            .from("email_inbox_messages")
            .insert({
              imap_uid: msg.uid,
              message_id: parsed.messageId || null,
              in_reply_to: inReplyTo,
              email_references: refs,
              thread_key: threadKey,
              from_email: fromEmail,
              from_name: fromName,
              to_email: toEmail,
              subject: parsed.subject || "(sem assunto)",
              body_text: bodyText,
              body_html: bodyHtml,
              snippet: snippet(bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ") : "")),
              received_at: parsed.date?.toISOString() || new Date().toISOString(),
              has_attachments: (parsed.attachments?.length || 0) > 0,
              size_bytes: msg.size || null,
              campaign_id: campaignId,
              raw_headers: parsed.headers ? Object.fromEntries(parsed.headers as any) : null,
            });
          if (insErr && !insErr.message.includes("duplicate key")) {
            errors.push(`uid ${msg.uid}: ${insErr.message}`);
          } else if (!insErr) {
            imported++;
          }
        } catch (e) {
          errors.push(`uid ${msg.uid}: ${(e as Error).message}`);
        }
      }

      await supabase
        .from("email_inbox_state")
        .update({
          last_uid: maxUid,
          last_run_at: new Date().toISOString(),
          last_error: errors.length ? errors.slice(0, 5).join(" | ") : null,
        })
        .eq("id", 1);
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    console.error("IMAP error:", e);
    await supabase
      .from("email_inbox_state")
      .update({ last_run_at: new Date().toISOString(), last_error: (e as Error).message })
      .eq("id", 1);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, imported, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});