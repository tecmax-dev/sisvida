// =============================================================================
// register_templates.ts — Registro CONTROLADO de templates Meta (RC1).
//
// FONTE DA VERDADE do catálogo: supabase/functions/_shared/template-catalog.ts
// Este script é Node puro (CLI) e NÃO importa TS/Deno do projeto. As categorias
// e nomes abaixo DEVEM permanecer sincronizados manualmente com o catálogo
// canônico. A auditoria (meta-compliance-audit) detecta divergências pós-deploy.
//
// Execução exige SEMPRE:
//   - TEMPLATE_BATCH=1|2|3   OU   TEMPLATE_NAMES=a,b,c
//   - CONFIRM_REGISTER=true  (caso contrário roda em DRY RUN)
// =============================================================================

const WABA_IDS = ["2080967275794470", "998516322649692", "1030747186799321"];
const TOKEN = process.env.META_WHATSAPP_TOKEN;
const GRAPH_VERSION = "v21.0";

// ---------- Governança espelhada (alinhada com template-governance.ts) -------
const CANONICAL_NAMES = new Set([
  "consulta_confirmacao","consulta_lembrete","consulta_cancelamento",
  "carteirinha_vencendo","carteirinha_vencida","boleto_disponivel",
  "homologacao_confirmada","assembleia_aviso","recuperacao_senha",
  "agenda_medica_disponivel","comunicado_marketing",
]);
const CANONICAL_CATEGORY: Record<string,string> = {
  consulta_confirmacao: "UTILITY",
  consulta_lembrete: "UTILITY",
  consulta_cancelamento: "UTILITY",
  carteirinha_vencendo: "UTILITY",
  carteirinha_vencida: "UTILITY",
  boleto_disponivel: "UTILITY",
  homologacao_confirmada: "UTILITY",
  assembleia_aviso: "UTILITY",
  agenda_medica_disponivel: "UTILITY",
  recuperacao_senha: "AUTHENTICATION",
  comunicado_marketing: "MARKETING",
};
const PROMOTIONAL_REGEX = /\b(promo(ç|c)?ão|desconto|oferta|aproveite|imperd(í|i)vel|gr(á|a)tis|cupom|black friday|liquida(ç|c)ão)\b/i;

function validateTemplate(tpl: any): string[] {
  const errors: string[] = [];
  if (!CANONICAL_NAMES.has(tpl.name)) errors.push(`'${tpl.name}' fora do catálogo canônico.`);
  if (CANONICAL_CATEGORY[tpl.name] && CANONICAL_CATEGORY[tpl.name] !== tpl.category) {
    errors.push(`Categoria inconsistente: catálogo=${CANONICAL_CATEGORY[tpl.name]} vs script=${tpl.category}.`);
  }
  const body = (tpl.components || []).find((c: any) => c.type === "BODY")?.text ?? "";
  if (tpl.category === "UTILITY" && PROMOTIONAL_REGEX.test(body)) {
    errors.push("UTILITY com vocabulário promocional.");
  }
  // AUTHENTICATION oficial: BODY sem texto livre — Meta gera automaticamente.
  if (tpl.category === "AUTHENTICATION") {
    const bodyComp = (tpl.components || []).find((c: any) => c.type === "BODY");
    if (bodyComp?.text) errors.push("AUTHENTICATION não deve ter texto livre no BODY.");
    if (!bodyComp?.add_security_recommendation) errors.push("AUTHENTICATION exige add_security_recommendation=true.");
  }
  // Variáveis sequenciais
  const vars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
  for (let i = 0; i < vars.length; i++) {
    if (vars[i] !== i + 1) { errors.push(`Variáveis fora de sequência em ${tpl.name}.`); break; }
  }
  return errors;
}

// ---------- Catálogo de payloads ---------------------------------------------
const OPTOUT_FOOTER = "Para parar de receber este aviso, responda PARAR.";
const INSTITUTIONAL_FOOTER = "Sindicato dos Comerciários";

const templates: any[] = [
  // ---- LOTE 1 — UTILITY baixo risco -----------------------------------------
  { name: "consulta_confirmacao", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Sua consulta está agendada para {{2}} às {{3}} com {{4}}.",
        example: { body_text: [["Maria","10/06/2026","14:30","Dr. João"]] } },
      { type: "FOOTER", text: OPTOUT_FOOTER },
    ] },
  { name: "consulta_lembrete", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Lembramos que sua consulta está marcada para {{2}} às {{3}}.",
        example: { body_text: [["Maria","amanhã","14:30"]] } },
      { type: "FOOTER", text: OPTOUT_FOOTER },
    ] },
  { name: "consulta_cancelamento", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Sua consulta de {{2}} às {{3}} foi cancelada. Acesse o aplicativo para reagendar.",
        example: { body_text: [["Maria","10/06/2026","14:30"]] } },
      { type: "FOOTER", text: INSTITUTIONAL_FOOTER },
    ] },
  { name: "carteirinha_vencendo", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Sua carteirinha de associado vence em {{2}}. Acesse o aplicativo para iniciar a renovação.",
        example: { body_text: [["João da Silva","30/03/2026"]] } },
      { type: "FOOTER", text: OPTOUT_FOOTER },
    ] },
  { name: "carteirinha_vencida", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Sua carteirinha de associado venceu em {{2}}. Para renovar, acesse o aplicativo do Sindicato.",
        example: { body_text: [["João da Silva","28/02/2026"]] } },
      { type: "FOOTER", text: OPTOUT_FOOTER },
    ] },
  { name: "boleto_disponivel", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Seu boleto referente a {{2}} está disponível. Vencimento em {{3}}.",
        example: { body_text: [["João","Mensalidade Maio/2026","10/06/2026"]] } },
      { type: "FOOTER", text: OPTOUT_FOOTER },
    ] },
  { name: "homologacao_confirmada", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. Sua homologação está confirmada para {{2}} às {{3}}, no Sindicato.",
        example: { body_text: [["Maria","12/06/2026","10:00"]] } },
      { type: "FOOTER", text: INSTITUTIONAL_FOOTER },
    ] },
  { name: "agenda_medica_disponivel", language: "pt_BR", category: "UTILITY",
    components: [
      { type: "BODY",
        text: "Olá, {{1}}. A agenda de atendimentos médicos do período {{2}} está disponível no aplicativo.",
        example: { body_text: [["Maria","Junho/2026"]] } },
      { type: "FOOTER", text: OPTOUT_FOOTER },
    ] },

  // ---- LOTE 2 — AUTHENTICATION (OTP oficial) --------------------------------
  { name: "recuperacao_senha", language: "pt_BR", category: "AUTHENTICATION",
    message_send_ttl_seconds: 600,
    components: [
      { type: "BODY", add_security_recommendation: true,
        example: { body_text: [["123456"]] } },
      { type: "FOOTER", code_expiration_minutes: 10 },
      { type: "BUTTONS", buttons: [
        { type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" },
      ] },
    ] },

  // ---- LOTE 3 — textos revisados --------------------------------------------
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

// ---- Definição dos lotes ----------------------------------------------------
const BATCHES: Record<string,string[]> = {
  "1": [
    "consulta_confirmacao","consulta_lembrete","consulta_cancelamento",
    "carteirinha_vencendo","carteirinha_vencida","boleto_disponivel",
    "homologacao_confirmada","agenda_medica_disponivel",
  ],
  "2": ["recuperacao_senha"],
  "3": ["assembleia_aviso","comunicado_marketing"],
};

function resolveSelection(): string[] {
  const batch = (process.env.TEMPLATE_BATCH || "").trim();
  const names = (process.env.TEMPLATE_NAMES || "").trim();
  if (batch && names) {
    throw new Error("Defina TEMPLATE_BATCH OU TEMPLATE_NAMES — nunca os dois.");
  }
  if (batch) {
    if (!BATCHES[batch]) throw new Error(`TEMPLATE_BATCH inválido: ${batch}. Use 1, 2 ou 3.`);
    return BATCHES[batch];
  }
  if (names) {
    return names.split(",").map(s => s.trim()).filter(Boolean);
  }
  throw new Error(
    "Nenhum lote informado. Defina TEMPLATE_BATCH=1|2|3 ou TEMPLATE_NAMES=a,b,c.\n" +
    "Registro automático completo está PROIBIDO em RC1."
  );
}

async function register() {
  let selection: string[];
  try {
    selection = resolveSelection();
  } catch (e: any) {
    console.error(`⛔ ${e.message}`);
    process.exit(1);
  }

  const confirm = process.env.CONFIRM_REGISTER === "true";
  const dryRun = !confirm;

  // Resolver payloads e detectar duplicidade dentro do lote
  const seen = new Set<string>();
  const lot: any[] = [];
  for (const name of selection) {
    if (seen.has(name)) { console.error(`⛔ Duplicidade no lote: ${name}`); process.exit(1); }
    seen.add(name);
    const tpl = templates.find(t => t.name === name);
    if (!tpl) { console.error(`⛔ Template não encontrado no script: ${name}`); process.exit(1); }
    const errs = validateTemplate(tpl);
    if (errs.length) { console.error(`⛔ Validação falhou em ${name}: ${errs.join(" | ")}`); process.exit(1); }
    lot.push(tpl);
  }

  // Resumo
  console.log("\n===== RESUMO DO LOTE =====");
  for (const t of lot) {
    const vars = (((t.components || []).find((c:any)=>c.type==="BODY")?.text) || "")
      .match(/\{\{\d+\}\}/g)?.length ?? 0;
    console.log(`• ${t.name.padEnd(28)} ${t.category.padEnd(15)} vars=${vars}`);
  }
  console.log(`Total: ${lot.length} template(s) | WABA IDs: ${WABA_IDS.length} | Modo: ${dryRun ? "DRY RUN" : "REGISTRO REAL"}`);
  console.log("==========================\n");

  if (dryRun) {
    console.log("✅ DRY RUN — nenhum template registrado.");
    console.log("   Para registrar de fato: rerode com CONFIRM_REGISTER=true");
    return;
  }

  if (!TOKEN) {
    console.error("⛔ META_WHATSAPP_TOKEN ausente — abortando registro real.");
    process.exit(1);
  }

  for (const wabaId of WABA_IDS) {
    console.log(`\n→ WABA ID: ${wabaId}`);
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`;
    for (const tpl of lot) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Authorization": `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(tpl),
        });
        const data = await response.json();
        if (response.ok) console.log(`  ✅ ${tpl.name} → ${data.status || "OK"}`);
        else            console.log(`  ❌ ${tpl.name} → ${JSON.stringify(data)}`);
      } catch (err) {
        console.error(`  💥 ${tpl.name}`, err);
      }
      await new Promise(r => setTimeout(r, 1000)); // rate-limit
    }
  }
}

register();