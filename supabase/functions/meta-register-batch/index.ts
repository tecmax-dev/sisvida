// =============================================================================
// meta-register-batch — Bridge administrativa RC1 para registro CONTROLADO de
// templates Meta usando META_WHATSAPP_TOKEN das Secrets do Lovable Cloud.
//
// REGRAS:
//  - Aceita apenas batch 1|2|3
//  - dry_run=true por padrão; exige confirm_register=true para POST real
//  - Apenas templates do TEMPLATE_CATALOG (catálogo espelhado abaixo)
//  - Bloqueia _v2/_v3/teste/temp/novo e duplicidades
//  - Para no primeiro erro crítico
//  - Protegida por role admin/owner do chamador
//  - NUNCA envia mensagens a usuários — apenas registra templates
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v21.0";
const WABA_IDS = ["2080967275794470", "998516322649692", "1030747186799321"];

const CANONICAL_NAMES = new Set([
  "consulta_confirmacao","consulta_lembrete","consulta_cancelamento",
  "carteirinha_vencendo","carteirinha_vencida","boleto_disponivel",
  "homologacao_confirmada","assembleia_aviso","recuperacao_senha",
  "agenda_medica_disponivel","comunicado_marketing",
]);
const CANONICAL_CATEGORY: Record<string,string> = {
  consulta_confirmacao: "UTILITY", consulta_lembrete: "UTILITY",
  consulta_cancelamento: "UTILITY", carteirinha_vencendo: "UTILITY",
  carteirinha_vencida: "UTILITY", boleto_disponivel: "UTILITY",
  homologacao_confirmada: "UTILITY", assembleia_aviso: "UTILITY",
  agenda_medica_disponivel: "UTILITY", recuperacao_senha: "AUTHENTICATION",
  comunicado_marketing: "MARKETING",
};
const FORBIDDEN_SUFFIX = /(_v\d+|teste|temp|novo)/i;
const PROMOTIONAL = /\b(promo(ç|c)?ão|desconto|oferta|aproveite|imperd(í|i)vel|gr(á|a)tis|cupom|black friday|liquida(ç|c)ão)\b/i;

const OPTOUT  = "Para parar de receber este aviso, responda PARAR.";
const INSTIT  = "Sindicato dos Comerciários";

const TEMPLATES: any[] = [
  // ---- Lote 1
  { name: "consulta_confirmacao", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. Sua consulta está agendada para {{2}} às {{3}} com {{4}}.",
        example: { body_text: [["Maria","10/06/2026","14:30","Dr. João"]] } },
      { type: "FOOTER", text: OPTOUT },
    ] },
  { name: "consulta_lembrete", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. Lembramos que sua consulta está marcada para {{2}} às {{3}}.",
        example: { body_text: [["Maria","amanhã","14:30"]] } },
      { type: "FOOTER", text: OPTOUT },
    ] },
  { name: "consulta_cancelamento", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. Sua consulta de {{2}} às {{3}} foi cancelada. Acesse o aplicativo para reagendar.",
        example: { body_text: [["Maria","10/06/2026","14:30"]] } },
      { type: "FOOTER", text: INSTIT },
    ] },
  { name: "carteirinha_vencendo", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. Sua carteirinha de associado vence em {{2}}. Acesse o aplicativo para iniciar a renovação.",
        example: { body_text: [["João da Silva","30/03/2026"]] } },
      { type: "FOOTER", text: OPTOUT },
    ] },
  { name: "carteirinha_vencida", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. Sua carteirinha de associado venceu em {{2}}. Para renovar, acesse o aplicativo do Sindicato.",
        example: { body_text: [["João da Silva","28/02/2026"]] } },
      { type: "FOOTER", text: OPTOUT },
    ] },
  { name: "boleto_disponivel", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. Seu boleto referente a {{2}} está disponível. Vencimento em {{3}}.",
        example: { body_text: [["João","Mensalidade Maio/2026","10/06/2026"]] } },
      { type: "FOOTER", text: OPTOUT },
    ] },
  { name: "homologacao_confirmada", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. Sua homologação está confirmada para {{2}} às {{3}}, no Sindicato.",
        example: { body_text: [["Maria","12/06/2026","10:00"]] } },
      { type: "FOOTER", text: INSTIT },
    ] },
  { name: "agenda_medica_disponivel", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá, {{1}}. A agenda de atendimentos médicos do período {{2}} está disponível no aplicativo.",
        example: { body_text: [["Maria","Junho/2026"]] } },
      { type: "FOOTER", text: OPTOUT },
    ] },

  // ---- Lote 2
  { name: "recuperacao_senha", language: "pt_BR", category: "AUTHENTICATION",
    message_send_ttl_seconds: 600,
    components: [
      { type: "BODY", add_security_recommendation: true, example: { body_text: [["123456"]] } },
      { type: "FOOTER", code_expiration_minutes: 10 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
    ] },

  // ---- Lote 3
  { name: "assembleia_aviso", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Como associado ativo do Sindicato dos Comerciários, você está formalmente convocado(a) para a assembleia prevista no estatuto, no dia {{2}} às {{3}}, em {{4}}. Sua participação contribui para as decisões da categoria.",
        example: { body_text: [["João da Silva","20/06/2026","18:00","sede do Sindicato"]] } },
      { type: "FOOTER", text: "Sindicato dos Comerciários · Comunicado institucional obrigatório." },
    ] },
  { name: "comunicado_marketing", language: "pt_BR", category: "MARKETING",
    components: [
      { type: "HEADER", format: "TEXT", text: "Comunicado do Sindicato" },
      { type: "BODY",
        text: "Olá, {{1}}. O Sindicato dos Comerciários informa: {{2}}. Acesse o aplicativo para conferir os detalhes e demais comunicados oficiais.",
        example: { body_text: [["Maria","haverá assembleia geral na próxima sexta-feira"]] } },
      { type: "FOOTER", text: "Sindicato dos Comerciários · Para parar, responda PARAR." },
    ] },
];

const BATCHES: Record<string, string[]> = {
  "1": ["consulta_confirmacao","consulta_lembrete","consulta_cancelamento",
        "carteirinha_vencendo","carteirinha_vencida","boleto_disponivel",
        "homologacao_confirmada","agenda_medica_disponivel"],
  "2": ["recuperacao_senha"],
  "3": ["assembleia_aviso","comunicado_marketing"],
};

function preflight(tpl: any): string[] {
  const errors: string[] = [];
  if (!CANONICAL_NAMES.has(tpl.name)) errors.push(`'${tpl.name}' fora do catálogo`);
  if (FORBIDDEN_SUFFIX.test(tpl.name)) errors.push(`'${tpl.name}' usa sufixo proibido`);
  if (CANONICAL_CATEGORY[tpl.name] !== tpl.category)
    errors.push(`categoria divergente do catálogo (${tpl.category} vs ${CANONICAL_CATEGORY[tpl.name]})`);
  const body = (tpl.components || []).find((c: any) => c.type === "BODY");
  const bodyText: string = body?.text ?? "";
  if (tpl.category === "UTILITY" && PROMOTIONAL.test(bodyText)) errors.push("UTILITY com vocabulário promocional");
  if (tpl.category === "AUTHENTICATION") {
    if (body?.text) errors.push("AUTHENTICATION não pode ter texto livre no BODY");
    if (!body?.add_security_recommendation) errors.push("AUTHENTICATION exige add_security_recommendation");
  }
  const vars = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
  for (let i = 0; i < vars.length; i++) {
    if (vars[i] !== i + 1) { errors.push("variáveis fora de sequência"); break; }
  }
  return errors;
}

async function authorizeAdmin(req: Request) {
  // Caminho 1: token interno via header x-rc1-token (token administrativo RC1)
  const rc1Token = req.headers.get("x-rc1-token");
  const expected = Deno.env.get("META_VERIFY_TOKEN");
  if (expected && rc1Token && rc1Token === expected) {
    return { ok: true, uid: "internal-rc1-token" };
  }
  // Caminho 2: JWT de admin/owner
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return { ok: false, reason: "missing_authorization" };
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData?.user) return { ok: false, reason: "invalid_jwt" };
  const uid = userData.user.id;
  // Aceita admin OU owner
  const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
    client.rpc("has_role", { _user_id: uid, _role: "admin" }),
    client.rpc("has_role", { _user_id: uid, _role: "owner" }),
  ]);
  if (!isAdmin && !isOwner) return { ok: false, reason: "not_admin_or_owner", uid };
  return { ok: true, uid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "forbidden", reason: auth.reason }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const batch = String(body.batch ?? "");
  const confirm = body.confirm_register === true;
  const dryRun = !confirm;
  const probe = body.probe === true;

  // ---- PROBE (somente leitura): GET no endpoint message_templates de cada WABA
  // Não registra, não envia mensagens. Diagnostica token/permissão/WABA.
  if (probe) {
    const token = Deno.env.get("META_WHATSAPP_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "META_WHATSAPP_TOKEN_missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const probes: any[] = [];
    for (const wabaId of WABA_IDS) {
      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?limit=1`;
      try {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json().catch(() => ({}));
        probes.push({
          waba_id: wabaId,
          http_status: r.status,
          ok: r.ok,
          error: data?.error ?? null,
          sample_count: Array.isArray(data?.data) ? data.data.length : null,
        });
      } catch (e) {
        probes.push({ waba_id: wabaId, exception: String(e) });
      }
    }
    return new Response(JSON.stringify({ mode: "PROBE", probes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!BATCHES[batch]) {
    return new Response(JSON.stringify({ error: "invalid_batch", allowed: ["1","2","3"] }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Resolver e validar lote
  const names = BATCHES[batch];
  const seen = new Set<string>();
  const lot: any[] = [];
  for (const n of names) {
    if (seen.has(n)) return new Response(JSON.stringify({ error: "duplicate_in_batch", name: n }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    seen.add(n);
    const tpl = TEMPLATES.find(t => t.name === n);
    if (!tpl) return new Response(JSON.stringify({ error: "template_not_defined", name: n }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const errs = preflight(tpl);
    if (errs.length) return new Response(JSON.stringify({ error: "preflight_failed", name: n, errors: errs }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    lot.push(tpl);
  }

  const summary = lot.map(t => ({
    name: t.name, category: t.category, language: t.language,
    vars: (((t.components||[]).find((c:any)=>c.type==="BODY")?.text)||"").match(/\{\{\d+\}\}/g)?.length ?? 0,
  }));

  if (dryRun) {
    return new Response(JSON.stringify({
      mode: "DRY_RUN", batch, waba_ids: WABA_IDS, preflight: "OK",
      lot: summary, note: "Nenhum POST enviado à Graph API.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = Deno.env.get("META_WHATSAPP_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "META_WHATSAPP_TOKEN_missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // REGISTRO REAL — para no primeiro erro crítico
  const results: any[] = [];
  let aborted = false;
  outer: for (const wabaId of WABA_IDS) {
    for (const tpl of lot) {
      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`;
      let status: string = "ERROR";
      let detail: any = null;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(tpl),
        });
        const rawText = await r.text();
        let data: any = {};
        try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
        console.log(`[register] waba=${wabaId} tpl=${tpl.name} http=${r.status} body=${rawText.slice(0,2000)}`);
        if (r.ok) {
          status = (data.status as string) || "CREATED";
          detail = { id: data.id, status: data.status, category: data.category };
        } else {
          const code = data?.error?.code;
          const msg = data?.error?.message || "";
          if (code === 100 && /already exists/i.test(msg)) {
            status = "ALREADY_EXISTS"; detail = { message: msg };
          } else {
            status = "ERROR";
            detail = {
              http_status: r.status,
              error: data?.error ?? null,
              raw: data?.error ? undefined : rawText.slice(0, 2000),
              sent_payload: tpl,
            };
          }
        }
      } catch (e) {
        status = "ERROR"; detail = { exception: String(e), sent_payload: tpl };
        console.error(`[register] exception waba=${wabaId} tpl=${tpl.name}`, e);
      }
      results.push({ waba_id: wabaId, name: tpl.name, status, detail });
      if (status === "ERROR") { aborted = true; break outer; }
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return new Response(JSON.stringify({
    mode: "REGISTER", batch, waba_ids: WABA_IDS, aborted, results,
  }), { status: aborted ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});