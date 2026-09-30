import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireStaff, authErrorResponse, getAuthContext } from "../_shared/authGuard.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUILD_ID = "TEMPLATE-URL-2026-08-11-02-FORCE-WABA";
const GRAPH = "https://graph.facebook.com/v21.0";

// Template NOVO (não altera o antigo carteirinha_atualizacao_necessaria)
const NEW_TEMPLATE_NAME = "carteirinha_atualizacao_link";
const LANGUAGE = "pt_BR";
const CATEGORY = "UTILITY";
const PUBLIC_BASE_URL = Deno.env.get("PUBLIC_APP_BASE_URL") || "https://sindexa.com.br";
const SECURE_ROUTE = "/atualizar-carteirinha";

const BODY_TEXT =
  "Olá, {{1}}. Identificamos que sua carteirinha de associado precisa ser atualizada.\n\n" +
  "Para iniciar a atualização, toque no botão abaixo.";

// URL dinâmica: base controlada pelo backend, variável carrega SOMENTE o token efêmero
const BUTTON_URL_BASE = `${PUBLIC_BASE_URL}${SECURE_ROUTE}?t={{1}}`;

const TEMPLATE_COMPONENTS = [
  {
    type: "BODY",
    text: BODY_TEXT,
    example: { body_text: [["João"]] },
  },
  {
    type: "BUTTONS",
    buttons: [
      {
        type: "URL",
        text: "Atualizar carteirinha",
        url: BUTTON_URL_BASE,
        example: [`${PUBLIC_BASE_URL}${SECURE_ROUTE}?t=exemplotoken00000000000000000000`],
      },
    ],
  },
];

const SIGNATURE_TEMPLATE_NAME = "assinatura_filiacao_v1";
const SIGNATURE_COMPONENTS = [
  {
    type: "BODY",
    text: "Olá, {{1}}. A autorização de desconto em folha da sua filiação ao sindicato está disponível para assinatura digital.\n\nAcesse o link seguro pelo botão abaixo para conferir e assinar o documento. O link é individual e válido por 24 horas. Se você não solicitou esta assinatura, desconsidere esta mensagem.",
    example: { body_text: [["Maria"]] },
  },
  {
    type: "BUTTONS",
    buttons: [{ type: "URL", text: "Acessar assinatura", url: "https://sindexa.com.br/assinar/{{1}}", example: ["https://sindexa.com.br/assinar/00000000-0000-4000-8000-000000000000"] }],
  },
];

const WELCOME_TEMPLATE_NAME = "boas_vindas_filiacao_v1";
const WELCOME_COMPONENTS = [{
  type: "BODY",
  text: "Olá, {{1}}. Seja bem-vindo(a) ao SECMI! Sua filiação foi aprovada.\n\nSeu cadastro de associado está ativo. Para acessar sua carteirinha digital, consultar seus atendimentos e documentos e gerenciar seus dados, acesse o aplicativo oficial: https://prosinge.com.br/app/baixar-app\n\nEsta é uma comunicação referente à aprovação da sua filiação.\nEquipe SECMI.",
  example: { body_text: [["Maria"]] },
}];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    await requireStaff(req);
  } catch (authErr) {
    const denied = authErrorResponse(authErr, corsHeaders);
    if (denied) return denied;
    throw authErr;
  }


  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const getToken = async (): Promise<string | null> => {
    const { data } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
    if (data) return String(data);
    return Deno.env.get("META_WHATSAPP_TOKEN_V2") || Deno.env.get("META_WHATSAPP_TOKEN") || null;
  };
  const wabaId = () => "2063797207822998"; // Fix ID que respondeu com HTTP 200 no diagnóstico

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action === "submit-welcome-template" || action === "welcome-template-status") {
      const actor = await getAuthContext(req);
      if (!actor?.isSuperAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const token = await getToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 503);
      const headers = { Authorization: `Bearer ${token}` };
      const read = await fetch(`${GRAPH}/${wabaId()}/message_templates?name=${WELCOME_TEMPLATE_NAME}&limit=50`, { headers });
      const readBody: any = await read.json().catch(() => ({}));
      if (!read.ok) return json({ success: false, error: "META_LOOKUP_FAILED", http: read.status, details: readBody?.error?.message ?? null }, 502);
      const existing = (readBody?.data ?? []).find((t: any) => t.name === WELCOME_TEMPLATE_NAME && t.language === LANGUAGE);
      if (existing || action === "welcome-template-status") {
        return json({ success: true, name: WELCOME_TEMPLATE_NAME, created: false, status: existing?.status ?? "NOT_FOUND", id: existing?.id ?? null, category: existing?.category ?? null });
      }
      // Uma submissão autorizada, sem repetição automática.
      const submitted = await fetch(`${GRAPH}/${wabaId()}/message_templates`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: WELCOME_TEMPLATE_NAME, language: LANGUAGE, category: CATEGORY, components: WELCOME_COMPONENTS }),
      });
      const submittedBody: any = await submitted.json().catch(() => ({}));
      await admin.from("whatsapp_compliance_logs").insert({
        intent: "TEMPLATE_SUBMIT", decision: submitted.ok && submittedBody?.id ? "SUBMITTED" : "FAILED",
        metadata: { template: WELCOME_TEMPLATE_NAME, http: submitted.status, id: submittedBody?.id ?? null, error: submittedBody?.error?.message ?? null },
      });
      if (!submitted.ok || !submittedBody?.id) return json({ success: false, error: "META_SUBMISSION_FAILED", http: submitted.status, details: submittedBody?.error?.message ?? null }, 502);
      await admin.from("whatsapp_meta_templates").insert({ name: WELCOME_TEMPLATE_NAME, language: LANGUAGE, category: submittedBody?.category ?? CATEGORY, status: submittedBody?.status ?? "PENDING", meta_template_id: submittedBody.id, components: WELCOME_COMPONENTS, variables_count: 1, last_synced_at: new Date().toISOString() });
      return json({ success: true, name: WELCOME_TEMPLATE_NAME, created: true, id: submittedBody.id, status: submittedBody?.status ?? "PENDING", category: submittedBody?.category ?? CATEGORY });
    }
    if (action === "submit-signature-template" || action === "signature-template-status") {
      const actor = await getAuthContext(req);
      if (!actor?.isSuperAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const token = await getToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 503);
      const headers = { Authorization: `Bearer ${token}` };
      const read = await fetch(`${GRAPH}/${wabaId()}/message_templates?name=${SIGNATURE_TEMPLATE_NAME}&limit=50`, { headers });
      const readBody: any = await read.json().catch(() => ({}));
      if (!read.ok) return json({ success: false, error: "META_LOOKUP_FAILED", http: read.status, details: readBody?.error?.message ?? null }, 502);
      const existing = (readBody?.data ?? []).find((t: any) => t.name === SIGNATURE_TEMPLATE_NAME && t.language === LANGUAGE);
      if (existing || action === "signature-template-status") {
        return json({ success: true, name: SIGNATURE_TEMPLATE_NAME, created: false, status: existing?.status ?? "NOT_FOUND", id: existing?.id ?? null });
      }
      // One authorized submission; do not retry a failed request automatically.
      const submitted = await fetch(`${GRAPH}/${wabaId()}/message_templates`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: SIGNATURE_TEMPLATE_NAME, language: LANGUAGE, category: CATEGORY, components: SIGNATURE_COMPONENTS }),
      });
      const submittedBody: any = await submitted.json().catch(() => ({}));
      await admin.from("whatsapp_compliance_logs").insert({
        intent: "TEMPLATE_SUBMIT", decision: submitted.ok && submittedBody?.id ? "SUBMITTED" : "FAILED",
        metadata: { template: SIGNATURE_TEMPLATE_NAME, http: submitted.status, id: submittedBody?.id ?? null, error: submittedBody?.error?.message ?? null },
      });
      if (!submitted.ok || !submittedBody?.id) return json({ success: false, error: "META_SUBMISSION_FAILED", http: submitted.status, details: submittedBody?.error?.message ?? null }, 502);
      await admin.from("whatsapp_meta_templates").insert({ name: SIGNATURE_TEMPLATE_NAME, language: LANGUAGE, category: CATEGORY, status: submittedBody?.status ?? "PENDING", meta_template_id: submittedBody.id, components: SIGNATURE_COMPONENTS, variables_count: 2, last_synced_at: new Date().toISOString() });
      return json({ success: true, name: SIGNATURE_TEMPLATE_NAME, created: true, id: submittedBody.id, status: submittedBody?.status ?? "PENDING", category: submittedBody?.category ?? CATEGORY });
    }

    if (action === "diagnose") {
      const token = await getToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" });
      const candidates = [
        { label: "META_WABA_ID_V2", id: Deno.env.get("META_WABA_ID_V2") || null },
        { label: "META_WABA_ID", id: Deno.env.get("META_WABA_ID") || null },
        { label: "FALLBACK", id: "2063797207822998" },
      ];
      // Testa também os demais tokens configurados para achar um com permissão de gestão
      const tokenCandidates: { label: string; value: string | null }[] = [
        { label: "VAULT/META_WHATSAPP_TOKEN_V2", value: token },
        { label: "META_SYSTEM_USER_TOKEN", value: Deno.env.get("META_SYSTEM_USER_TOKEN") || null },
        { label: "META_WHATSAPP_TOKEN", value: Deno.env.get("META_WHATSAPP_TOKEN") || null },
      ];
      const tokenProbe: unknown[] = [];
      for (const tk of tokenCandidates) {
        if (!tk.value) { tokenProbe.push({ label: tk.label, configured: false }); continue; }
        const me = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${tk.value}` } });
        const meB = await me.json().catch(() => ({}));
        const wabas = await fetch(`${GRAPH}/me/businesses?limit=5`, { headers: { Authorization: `Bearer ${tk.value}` } });
        const wabasB = await wabas.json().catch(() => ({}));
        tokenProbe.push({
          label: tk.label,
          configured: true,
          me_http: me.status,
          me_error: (meB as any)?.error?.message ?? null,
          businesses_http: wabas.status,
          businesses_count: ((wabasB as any)?.data ?? []).length,
          businesses_error: (wabasB as any)?.error?.message ?? null,
        });
      }

      const results: unknown[] = [];
      for (const cand of candidates) {
        if (!cand.id) { results.push({ label: cand.label, configured: false }); continue; }
        const r = await fetch(`${GRAPH}/${cand.id}/message_templates?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
        const b = await r.json().catch(() => ({}));
        results.push({
          label: cand.label,
          id_tail: String(cand.id).slice(-6),
          read_http: r.status,
          read_ok: r.ok,
          error: (b as any)?.error?.message ?? null,
        });
      }
      return json({ success: true, build_id: BUILD_ID, token_probe: tokenProbe, waba_candidates: results });
    }

    if (action === "remote-spec") {
      const token = await getToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" });
      if (body.what === "phones") {
        const pr = await fetch(`${GRAPH}/${wabaId()}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pb = await pr.json().catch(() => ({}));
        return json({ success: pr.ok, http: pr.status, data: pb });
      }
      const r = await fetch(`${GRAPH}/${wabaId()}/message_templates?name=${NEW_TEMPLATE_NAME}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const b = await r.json().catch(() => ({}));
      return json({ success: r.ok, http: r.status, build_id: BUILD_ID, data: b });
    }

    if (action === "spec") {
      return json({
        build_id: BUILD_ID,
        template_name: NEW_TEMPLATE_NAME,
        language: LANGUAGE,
        category: CATEGORY,
        components: TEMPLATE_COMPONENTS,
        button_type: "URL",
        dynamic_url: true,
        url_base: `${PUBLIC_BASE_URL}${SECURE_ROUTE}`,
      });
    }

    if (action === "manual-submit-authorized-v2") {
      const token = await getToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 200);
      const WABA = "2063797207822998";

      // --- 2. VALIDAR TOKEN ---
      const meRes = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${token}` } });
      const tokenValid = meRes.ok;

      // --- 1. PRE-CHECK READ-ONLY ---
      const check = await fetch(`${GRAPH}/${WABA}/message_templates?name=${NEW_TEMPLATE_NAME}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const checkBody: any = await check.json().catch(() => ({}));
      const wabaAccess = check.ok;
      const existing = (checkBody?.data ?? []).find(
        (t: any) => t.name === NEW_TEMPLATE_NAME && t.language === LANGUAGE,
      );

      const persist = async (record: Record<string, unknown>) => {
        const { data: local } = await admin
          .from("whatsapp_meta_templates")
          .select("id")
          .eq("name", NEW_TEMPLATE_NAME)
          .eq("language", LANGUAGE)
          .maybeSingle();
        if (local) await admin.from("whatsapp_meta_templates").update(record).eq("id", local.id);
        else await admin.from("whatsapp_meta_templates").insert({ name: NEW_TEMPLATE_NAME, language: LANGUAGE, category: CATEGORY, ...record });
      };

      if (!tokenValid || !wabaAccess) {
        return json({
          success: false,
          build_id: BUILD_ID,
          precheck_template_exists: !!existing,
          token_valid: tokenValid,
          waba_access: wabaAccess,
          graph_post_executed: false,
          graph_post_count: 0,
          waba_error: checkBody?.error?.message ?? null,
          whatsapp_sent: 0,
          status: "SUBMISSION_ABORTED_PRECHECK",
        });
      }

      if (existing) {
        await persist({
          status: String(existing.status).toUpperCase(),
          meta_template_id: existing.id,
          last_synced_at: new Date().toISOString(),
        });
        return json({
          success: true,
          build_id: BUILD_ID,
          precheck_template_exists: true,
          token_valid: true,
          waba_access: true,
          graph_post_executed: false,
          graph_post_count: 0,
          meta_template_id: existing.id,
          meta_status: existing.status,
          local_status: String(existing.status).toUpperCase(),
          whatsapp_sent: 0,
          status: "ALREADY_EXISTED",
        });
      }

      // --- 4. UM ÚNICO POST ---
      const res = await fetch(`${GRAPH}/${WABA}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: NEW_TEMPLATE_NAME,
          language: LANGUAGE,
          category: CATEGORY,
          components: TEMPLATE_COMPONENTS,
        }),
      });
      const resBody: any = await res.json().catch(() => ({}));
      const metaId: string | null = resBody?.id ?? null;
      const err: any = resBody?.error ?? null;

      // --- 5. PERSISTÊNCIA SOMENTE COM PROVA REAL ---
      if (!res.ok || !metaId) {
        await persist({
          status: "SUBMISSION_FAILED",
          meta_template_id: null,
          last_synced_at: new Date().toISOString(),
          raw_payload: {
            build_id: BUILD_ID,
            graph_http: res.status,
            error_code: err?.code ?? null,
            error_subcode: err?.error_subcode ?? null,
            error_type: err?.type ?? null,
            error_message: err?.message ?? null,
            fbtrace_id: err?.fbtrace_id ?? null,
          },
        });
        return json({
          success: false,
          build_id: BUILD_ID,
          precheck_template_exists: false,
          token_valid: true,
          waba_access: true,
          graph_post_executed: true,
          graph_post_count: 1,
          graph_http: res.status,
          graph_response: {
            error_code: err?.code ?? null,
            error_subcode: err?.error_subcode ?? null,
            error_type: err?.type ?? null,
            message: err?.message ?? null,
            fbtrace_id: err?.fbtrace_id ?? null,
          },
          meta_template_id: null,
          read_after_write: "NAO_EXECUTADA",
          local_status: "SUBMISSION_FAILED",
          whatsapp_sent: 0,
          status: "SUBMISSION_FAILED",
        });
      }

      // --- 6. READ-AFTER-WRITE ---
      const verify = await fetch(`${GRAPH}/${WABA}/message_templates?name=${NEW_TEMPLATE_NAME}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const verifyBody: any = await verify.json().catch(() => ({}));
      const found = (verifyBody?.data ?? []).find(
        (t: any) => t.name === NEW_TEMPLATE_NAME && t.language === LANGUAGE,
      );
      const metaStatus = found?.status ?? resBody?.status ?? null;
      const confirmed = !!found && !!metaId;

      await persist({
        status: confirmed ? String(metaStatus || "PENDING").toUpperCase() : "SUBMISSION_UNCONFIRMED",
        meta_template_id: metaId,
        components: TEMPLATE_COMPONENTS,
        variables_count: 1,
        last_synced_at: new Date().toISOString(),
        raw_payload: { build_id: BUILD_ID, button_type: "URL", dynamic_url: true, url_base: `${PUBLIC_BASE_URL}${SECURE_ROUTE}`, graph_http: res.status },
      });

      return json({
        success: true,
        build_id: BUILD_ID,
        precheck_template_exists: false,
        token_valid: true,
        waba_access: true,
        graph_post_executed: true,
        graph_post_count: 1,
        graph_http: res.status,
        graph_response: { id: metaId, status: resBody?.status ?? null, category: resBody?.category ?? null },
        meta_template_id: metaId,
        read_after_write: "EXECUTADA",
        template_found_on_meta: !!found,
        meta_status: metaStatus,
        local_status: confirmed ? String(metaStatus || "PENDING").toUpperCase() : "SUBMISSION_UNCONFIRMED",
        whatsapp_sent: 0,
        status: confirmed ? "SUBMISSION_CONFIRMED" : "SUBMISSION_UNCONFIRMED",
      });
    }

    // -----------------------------------------------------------------
    // SYNC: lê o status real na Meta e reflete no catálogo local
    // -----------------------------------------------------------------
    if (action === "sync") {
      const name = String(body.template_name || NEW_TEMPLATE_NAME);
      const token = await getToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 200);

      const r = await fetch(`${GRAPH}/${wabaId()}/message_templates?name=${name}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const b = await r.json().catch(() => ({}));
      const tpl = ((b as any)?.data ?? []).find((t: any) => t.name === name && t.language === LANGUAGE);

      if (!tpl) {
        return json({ success: true, template_name: name, found_in_meta: false, meta_error: (b as any)?.error?.message ?? null, http: r.status });
      }

      await admin
        .from("whatsapp_meta_templates")
        .update({ status: String(tpl.status).toUpperCase(), meta_template_id: tpl.id, last_synced_at: new Date().toISOString() })
        .eq("name", name)
        .eq("language", LANGUAGE);

      return json({ success: true, template_name: name, found_in_meta: true, meta_status: tpl.status, meta_template_id: tpl.id });
    }

    return json({ success: false, error: `UNKNOWN_ACTION:${action}` }, 400);
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
