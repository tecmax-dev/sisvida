import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
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

// Cliente IMAP mínimo usando Deno.connectTls (imapflow não funciona no edge runtime)
class SimpleImap {
  private conn: Deno.TlsConn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer = "";
  private tagCounter = 0;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  async connect(host: string, port: number) {
    // Wrap TLS connect with our own timeout — Deno.connectTls can hang silently
    const CONNECT_TIMEOUT_MS = 20000;
    this.conn = await Promise.race([
      Deno.connectTls({ hostname: host, port }),
      new Promise<Deno.TlsConn>((_, reject) =>
        setTimeout(() => reject(new Error(`TLS connect timeout after ${CONNECT_TIMEOUT_MS}ms to ${host}:${port}`)), CONNECT_TIMEOUT_MS),
      ),
    ]);
    this.reader = this.conn.readable.getReader();
    this.writer = this.conn.writable.getWriter();
    // greeting — alguns servidores IMAP (Locaweb/cPanel) podem nunca enviar
    // o banner para certos clients. Tentamos lê-lo em ATÉ 8s; se não vier,
    // seguimos em frente e deixamos o LOGIN provocar a resposta do servidor.
    try {
      await this.readUntil(/^\* OK/m, 8000);
    } catch (e) {
      const msg = (e as Error).message || "";
      if (!msg.includes("IMAP read timeout")) throw e;
      // segue sem banner
    }
  }

  private async readChunk(timeoutMs = 30000): Promise<void> {
    if (timeoutMs <= 0) throw new Error("IMAP read timeout");
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; try { this.conn?.close(); } catch {} }, timeoutMs);
    try {
      const { value, done } = await this.reader!.read();
      if (done || !value) {
        if (timedOut) throw new Error("IMAP read timeout");
        throw new Error("connection closed");
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    } catch (e) {
      if (timedOut) throw new Error("IMAP read timeout");
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  private async readUntil(re: RegExp, timeoutMs = 30000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (!re.test(this.buffer)) {
      if (Date.now() > deadline) throw new Error("IMAP read timeout");
      await this.readChunk(deadline - Date.now());
    }
    return this.buffer;
  }

  // Reads until we see the tagged response "TAG OK|NO|BAD ..."
  private async readTagged(tag: string, timeoutMs = 60000): Promise<string> {
    const re = new RegExp(`^${tag} (OK|NO|BAD)[^\\r\\n]*\\r?\\n`, "m");
    await this.readUntil(re, timeoutMs);
    const m = this.buffer.match(re)!;
    const endIdx = this.buffer.indexOf(m[0]) + m[0].length;
    const block = this.buffer.slice(0, endIdx);
    this.buffer = this.buffer.slice(endIdx);
    if (m[1] !== "OK") throw new Error(`IMAP ${tag} ${m[1]}: ${m[0]}`);
    return block;
  }

  // Reads bytes-exact literal {N} content + final tagged response.
  // For FETCH BODY[] we need to handle {N} literals. We keep reading until tagged response found.
  private async readFetchResponse(tag: string, timeoutMs = 120000): Promise<string> {
    const re = new RegExp(`\\r\\n${tag} (OK|NO|BAD)[^\\r\\n]*\\r?\\n`);
    const deadline = Date.now() + timeoutMs;
    while (!re.test(this.buffer)) {
      if (Date.now() > deadline) throw new Error("IMAP fetch timeout");
      await this.readChunk(deadline - Date.now());
    }
    const m = this.buffer.match(re)!;
    const endIdx = this.buffer.indexOf(m[0]) + m[0].length;
    const block = this.buffer.slice(0, endIdx);
    this.buffer = this.buffer.slice(endIdx);
    if (m[1] !== "OK") throw new Error(`IMAP ${tag} ${m[1]}`);
    return block;
  }

  async send(cmd: string): Promise<string> {
    const tag = `A${++this.tagCounter}`;
    await this.writer!.write(this.encoder.encode(`${tag} ${cmd}\r\n`));
    return tag;
  }

  async login(user: string, pass: string) {
    const tag = await this.send(`LOGIN "${user.replace(/"/g, '\\"')}" "${pass.replace(/"/g, '\\"')}"`);
    await this.readTagged(tag, 30000);
  }

  async select(mailbox: string): Promise<number> {
    const tag = await this.send(`SELECT "${mailbox}"`);
    const resp = await this.readTagged(tag, 30000);
    const m = resp.match(/\*\s+(\d+)\s+EXISTS/i);
    return m ? Number(m[1]) : 0;
  }

  async uidSearchSince(lastUid: number): Promise<number[]> {
    const tag = await this.send(`UID SEARCH UID ${lastUid + 1}:*`);
    const resp = await this.readTagged(tag, 30000);
    const line = resp.split(/\r?\n/).find((l) => /^\* SEARCH/i.test(l)) || "";
    const nums = line.replace(/^\* SEARCH/i, "").trim().split(/\s+/).filter(Boolean).map(Number).filter((n) => !isNaN(n) && n > lastUid);
    return nums;
  }

  // Returns raw RFC822 source for a UID
  async fetchSource(uid: number): Promise<Uint8Array> {
    const tag = await this.send(`UID FETCH ${uid} BODY.PEEK[]`);
    const block = await this.readFetchResponse(tag, 120000);
    // Find {N} literal size
    const m = block.match(/\{(\d+)\}\r\n/);
    if (!m) return new Uint8Array();
    const start = block.indexOf(m[0]) + m[0].length;
    const size = Number(m[1]);
    const raw = block.slice(start, start + size);
    return this.encoder.encode(raw);
  }

  async logout() {
    try {
      const tag = await this.send("LOGOUT");
      await this.readTagged(tag, 5000).catch(() => {});
    } catch {}
    try { this.conn?.close(); } catch {}
  }
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

  if (!host || !user || !pass) {
    return new Response(
      JSON.stringify({ ok: false, error: "IMAP secrets não configurados (IMAP_REPLIES_HOST/USER/PASSWORD)" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let imported = 0;
  let errors: string[] = [];

  const client = new SimpleImap();

  try {
    await client.connect(host, port);
    await client.login(user, pass);
    await client.select("INBOX");

      const { data: stateRow } = await supabase
        .from("email_inbox_state")
        .select("last_uid")
        .eq("id", 1)
        .maybeSingle();
      const lastUid = Number(stateRow?.last_uid || 0);

      const uids = await client.uidSearchSince(lastUid);
      // limitar para evitar timeout do edge
      const MAX = 20;
      const batch = uids.slice(0, MAX);
      let maxUid = lastUid;

      for (const uid of batch) {
        if (uid > maxUid) maxUid = uid;

        try {
          const source = await client.fetchSource(uid);
          if (!source.length) continue;
          const parsed = await simpleParser(source);
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
              imap_uid: uid,
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
              size_bytes: source.length || null,
              campaign_id: campaignId,
              raw_headers: parsed.headers ? Object.fromEntries(parsed.headers as any) : null,
            });
          if (insErr && !insErr.message.includes("duplicate key")) {
            errors.push(`uid ${uid}: ${insErr.message}`);
          } else if (!insErr) {
            imported++;
          }
        } catch (e) {
          errors.push(`uid ${uid}: ${(e as Error).message}`);
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

    await client.logout();
  } catch (e) {
    console.error("IMAP error:", e);
    const diag = ` [host=${host}:${port} user=${user ? user.replace(/(.{2}).+(@.+)/, "$1***$2") : "?"}]`;
    const msg = (e as Error).message + diag;
    await supabase
      .from("email_inbox_state")
      .update({ last_run_at: new Date().toISOString(), last_error: msg })
      .eq("id", 1);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, imported, errors, scanned: imported + errors.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});