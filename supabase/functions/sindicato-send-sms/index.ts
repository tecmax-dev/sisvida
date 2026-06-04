import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  ApiBrasilSmsService,
  buildBrazilianPhoneCandidates,
  sanitizeApiBrasilError,
} from "../_shared/apibrasil-sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Recipient {
  phone: string;
  vars?: Record<string, string>;
  name?: string;
}

interface Payload {
  template_id?: string;
  body?: string; // se template_id não informado, usa body livre
  recipients: Recipient[];
}

function renderBody(body: string, vars: Record<string, string> = {}): string {
  return body.replace(/\{(\d+)\}/g, (_m, idx) => vars[idx] ?? vars[`var${idx}`] ?? `{${idx}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const payload = (await req.json()) as Payload;
    if (!Array.isArray(payload?.recipients) || payload.recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum destinatário informado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bodyTemplate = payload.body ?? "";
    let templateId: string | null = null;
    if (payload.template_id) {
      const { data: tpl, error } = await admin
        .from("sms_templates")
        .select("id, body")
        .eq("id", payload.template_id)
        .maybeSingle();
      if (error || !tpl) {
        return new Response(JSON.stringify({ error: "Modelo não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      bodyTemplate = tpl.body;
      templateId = tpl.id;
    }

    if (!bodyTemplate || bodyTemplate.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Texto do SMS vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sms = ApiBrasilSmsService.fromEnv();
    const results: any[] = [];

    for (const rcpt of payload.recipients) {
      const rendered = renderBody(bodyTemplate, rcpt.vars ?? {});
      const candidates = buildBrazilianPhoneCandidates(rcpt.phone);
      let lastResult: any = null;
      let success = false;

      for (const number of candidates) {
        const r = await sms.send({ number, message: rendered });
        lastResult = r;
        if (r.ok) { success = true; break; }
      }

      const status = success ? "sent" : "error";
      const errorMsg = success ? null : sanitizeApiBrasilError(lastResult?.error?.message);

      await admin.from("sms_send_logs").insert({
        template_id: templateId,
        recipient: rcpt.phone,
        rendered_body: rendered,
        status,
        provider_response: lastResult,
        error: errorMsg,
        sent_by: userData.user.id,
      });

      results.push({ phone: rcpt.phone, status, error: errorMsg });
    }

    const sent = results.filter((r) => r.status === "sent").length;
    return new Response(JSON.stringify({ ok: true, sent, total: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-sms error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});