import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BATCH_SIZE = 20;
const DELAY_MS = 400; // between sends (Locaweb tolera ~3/s)
const MAX_RUNTIME_MS = 45000; // self-recurse before timeout

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderTemplate(tpl: string, vars: Record<string, any>): string {
  return tpl.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, k) => {
    const v = vars?.[k];
    return v == null ? "" : String(v);
  });
}

function htmlToText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function appendUnsubscribeFooter(html: string, unsubUrl: string): string {
  const footer = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;text-align:center;">
      Você está recebendo este e-mail porque está cadastrado no sindicato.<br/>
      <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Não desejo mais receber e-mails</a>
    </div>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }
  return `${html}${footer}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const { campaignId } = await req.json();
    if (!campaignId || typeof campaignId !== "string") {
      return new Response(JSON.stringify({ error: "campaignId obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load campaign
    const { data: campaign, error: cErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (campaign.status === "completed" || campaign.status === "cancelled") {
      return new Response(JSON.stringify({ ok: true, message: "Campanha já finalizada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark sending
    if (campaign.status !== "sending") {
      await supabase.from("email_campaigns").update({
        status: "sending",
        started_at: campaign.started_at ?? new Date().toISOString(),
      }).eq("id", campaignId);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      await supabase.from("email_campaigns").update({
        status: "failed",
        error_message: "Configuração SMTP incompleta",
        completed_at: new Date().toISOString(),
      }).eq("id", campaignId);
      return new Response(JSON.stringify({ error: "SMTP não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-load unsubscribed emails for this clinic
    const { data: unsubs } = await supabase
      .from("email_unsubscribes")
      .select("email")
      .eq("clinic_id", campaign.clinic_id);
    const unsubSet = new Set((unsubs || []).map((u) => (u.email || "").toLowerCase()));

    let totalSent = 0, totalFailed = 0, totalSkipped = 0;
    let hasMore = true;

    while (hasMore && Date.now() - startedAt < MAX_RUNTIME_MS) {
      const { data: recipients } = await supabase
        .from("email_campaign_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (!recipients || recipients.length === 0) {
        hasMore = false;
        break;
      }

      const client = new SMTPClient({
        connection: {
          hostname: smtpHost, port: smtpPort, tls: true,
          auth: { username: smtpUser, password: smtpPassword },
        },
      });

      for (const r of recipients) {
        const email = (r.recipient_email || "").trim();
        if (!email || !emailRegex.test(email)) {
          await supabase.from("email_campaign_recipients").update({
            status: "skipped", error_message: "Email inválido ou ausente",
          }).eq("id", r.id);
          totalSkipped++;
          continue;
        }
        if (unsubSet.has(email.toLowerCase())) {
          await supabase.from("email_campaign_recipients").update({
            status: "unsubscribed", error_message: "Descadastrado",
          }).eq("id", r.id);
          totalSkipped++;
          continue;
        }

        try {
          const vars = { ...(r.variables || {}), nome: r.recipient_name || "" };
          const subject = renderTemplate(campaign.subject, vars);
          let html = renderTemplate(campaign.body_html, vars);
          const unsubToken = btoa(`${campaign.clinic_id}:${email}`).replace(/=+$/, "");
          const unsubUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bulk-email-unsubscribe?token=${encodeURIComponent(unsubToken)}&cid=${campaignId}`;
          html = appendUnsubscribeFooter(html, unsubUrl);

          await client.send({
            from: smtpFrom,
            to: email,
            subject,
            html,
            content: htmlToText(html),
          });

          await supabase.from("email_campaign_recipients").update({
            status: "sent", sent_at: new Date().toISOString(),
          }).eq("id", r.id);
          totalSent++;
        } catch (err: any) {
          console.error(`[${requestId}] erro envio para ${email}:`, err?.message);
          await supabase.from("email_campaign_recipients").update({
            status: "failed", error_message: String(err?.message || err).slice(0, 500),
          }).eq("id", r.id);
          totalFailed++;
        }

        if (DELAY_MS > 0) await new Promise((res) => setTimeout(res, DELAY_MS));
        if (Date.now() - startedAt >= MAX_RUNTIME_MS) break;
      }

      try { await client.close(); } catch (_) {}
    }

    // Update counters
    const { data: counts } = await supabase
      .from("email_campaign_recipients")
      .select("status", { count: "exact" })
      .eq("campaign_id", campaignId);
    const c = { sent: 0, failed: 0, skipped: 0, pending: 0 };
    for (const row of counts || []) {
      if (row.status === "sent") c.sent++;
      else if (row.status === "failed") c.failed++;
      else if (row.status === "skipped" || row.status === "unsubscribed") c.skipped++;
      else if (row.status === "pending") c.pending++;
    }

    if (c.pending === 0) {
      await supabase.from("email_campaigns").update({
        status: "completed",
        sent_count: c.sent,
        failed_count: c.failed,
        skipped_count: c.skipped,
        completed_at: new Date().toISOString(),
      }).eq("id", campaignId);
      return new Response(JSON.stringify({
        ok: true, completed: true, sent: c.sent, failed: c.failed, skipped: c.skipped,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update partial counters and re-invoke
    await supabase.from("email_campaigns").update({
      sent_count: c.sent, failed_count: c.failed, skipped_count: c.skipped,
    }).eq("id", campaignId);

    // Fire-and-forget recursive invocation
    EdgeRuntime.waitUntil((async () => {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-bulk-email-campaign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ campaignId }),
        });
      } catch (e) {
        console.error(`[${requestId}] re-invoke error:`, e);
      }
    })());

    return new Response(JSON.stringify({
      ok: true, completed: false, pending: c.pending,
      sentThisRun: totalSent, failedThisRun: totalFailed, skippedThisRun: totalSkipped,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(`[${requestId}] erro geral:`, err?.message, err?.stack);
    return new Response(JSON.stringify({ error: err?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// @ts-ignore Deno runtime global
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };