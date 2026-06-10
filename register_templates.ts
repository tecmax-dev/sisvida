const WABA_IDS = ["2080967275794470", "998516322649692", "1030747186799321"];
const TOKEN = process.env.META_WHATSAPP_TOKEN;
const GRAPH_VERSION = "v21.0";

// Governança: valida cada template contra o catálogo canônico ANTES de chamar
// a Graph API. Reutiliza a mesma regra usada em runtime
// (supabase/functions/_shared/template-governance.ts) — espelhada aqui para
// permitir execução como script Node puro, sem alterar a assinatura.
const CANONICAL_NAMES = new Set([
  "consulta_confirmacao","consulta_lembrete","consulta_cancelamento",
  "carteirinha_vencendo","carteirinha_vencida","boleto_disponivel",
  "homologacao_confirmada","assembleia_aviso","recuperacao_senha",
  "agenda_medica_disponivel","comunicado_marketing",
]);
const PROMOTIONAL_REGEX = /\b(promo(ç|c)?ão|desconto|oferta|aproveite|imperd(í|i)vel|gr(á|a)tis|cupom|black friday|liquida(ç|c)ão)\b/i;
const AUTH_ALLOWED_WORDS = /(c(ó|o)digo|verifica(ç|c)(ã|a)o|login|autentica(ç|c)(ã|a)o|senha|otp|2fa|acesso)/i;

function validateTemplate(tpl) {
  const errors = [];
  if (!CANONICAL_NAMES.has(tpl.name)) errors.push(`Template '${tpl.name}' fora do catálogo canônico.`);
  const body = (tpl.components || []).find((c) => c.type === "BODY")?.text ?? "";
  if (tpl.category === "UTILITY" && PROMOTIONAL_REGEX.test(body)) errors.push("UTILITY com vocabulário promocional.");
  if (tpl.category === "AUTHENTICATION") {
    if (!AUTH_ALLOWED_WORDS.test(body)) errors.push("AUTHENTICATION fora de OTP/senha/login.");
    if (PROMOTIONAL_REGEX.test(body)) errors.push("AUTHENTICATION com texto promocional.");
  }
  return errors;
}

// CATÁLOGO CANÔNICO — conjunto permanente e único de templates.
// NÃO criar versões _v2/_v3/_vN automáticas. Reaproveitar SEMPRE o mesmo nome.
// Textos: linguagem institucional, neutra, objetiva. Sem palavras-gatilho.
// Todo UTILITY recorrente tem footer de opt-out conforme diretriz Meta.
const OPTOUT_FOOTER = "Para parar de receber este aviso, responda PARAR.";
const INSTITUTIONAL_FOOTER = "Sindicato dos Comerciários";

const templates = [
  // ---- Agendamento (consultas) -------------------------------------------
  {
    name: "consulta_confirmacao",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Sua consulta está agendada para {{2}} às {{3}} com {{4}}.",
        example: { body_text: [["Maria", "10/06/2026", "14:30", "Dr. João"]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  {
    name: "consulta_lembrete",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Lembramos que sua consulta está marcada para {{2}} às {{3}}.",
        example: { body_text: [["Maria", "amanhã", "14:30"]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  {
    name: "consulta_cancelamento",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Sua consulta de {{2}} às {{3}} foi cancelada. Acesse o aplicativo para reagendar.",
        example: { body_text: [["Maria", "10/06/2026", "14:30"]] }
      },
      { type: "FOOTER", text: INSTITUTIONAL_FOOTER }
    ]
  },
  // ---- Carteirinha --------------------------------------------------------
  {
    name: "carteirinha_vencendo",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Sua carteirinha de associado vence em {{2}}. Acesse o aplicativo para iniciar a renovação.",
        example: { body_text: [["João da Silva", "30/03/2026"]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  {
    name: "carteirinha_vencida",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Sua carteirinha de associado venceu em {{2}}. Para regularizar, acesse o aplicativo do Sindicato.",
        example: { body_text: [["João da Silva", "28/02/2026"]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  // ---- Boleto -------------------------------------------------------------
  {
    name: "boleto_disponivel",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Seu boleto referente a {{2}} está disponível. Vencimento em {{3}}.",
        example: { body_text: [["João", "Mensalidade Maio/2026", "10/06/2026"]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  // ---- Homologação --------------------------------------------------------
  {
    name: "homologacao_confirmada",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Sua homologação está confirmada para {{2}} às {{3}}, no Sindicato.",
        example: { body_text: [["Maria", "12/06/2026", "10:00"]] }
      },
      { type: "FOOTER", text: INSTITUTIONAL_FOOTER }
    ]
  },
  // ---- Institucional ------------------------------------------------------
  {
    name: "assembleia_aviso",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Convocamos para a assembleia no dia {{2}} às {{3}}, em {{4}}.",
        example: { body_text: [["Associado", "20/06/2026", "18:00", "sede do Sindicato"]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  {
    name: "agenda_medica_disponivel",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. A agenda de atendimentos médicos do período {{2}} está disponível no aplicativo.",
        example: { body_text: [["Maria", "Junho/2026"]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  // ---- Autenticação (crítico) --------------------------------------------
  {
    name: "recuperacao_senha",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Você solicitou a recuperação de acesso. Toque no link abaixo para definir uma nova senha.",
        example: { body_text: [["Associado"]] }
      },
      { type: "FOOTER", text: INSTITUTIONAL_FOOTER },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Recuperar Senha",
            url: "https://prosindweb.com.br/sindicato/recuperar-senha?{{1}}",
            example: ["email=teste@exemplo.com&code=123456"]
          }
        ]
      }
    ]
  },
  // ---- Marketing (único — exige opt-in digital comprovável) --------------
  {
    name: "comunicado_marketing",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. {{2}}",
        example: { body_text: [["Associado", "Confira a programação do Dia do Comerciário."]] }
      },
      { type: "FOOTER", text: OPTOUT_FOOTER }
    ]
  },
  // REMOVIDO definitivamente: ia_prontuario_informativo, agenda_disponivel,
  // agenda_disponivel_util, informativo_agenda_medica, carteira_vencida_util,
  // carteira_vencendo_util, recuperacao_senha_link_v3 — substituídos pelos
  // nomes canônicos acima. NÃO reintroduzir.
];

async function register() {
  if (!TOKEN) {
    console.error("META_WHATSAPP_TOKEN is missing");
    return;
  }

  for (const wabaId of WABA_IDS) {
    console.log(`\nRegistering templates for WABA ID: ${wabaId}`);
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`;

    for (const tpl of templates) {
      console.log(`Creating template: ${tpl.name}...`);
      const govErrors = validateTemplate(tpl);
      if (govErrors.length > 0) {
        console.log(`⛔ Governance rejeitou ${tpl.name}: ${govErrors.join(" | ")}`);
        continue;
      }
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(tpl)
        });
        const data = await response.json();
        if (response.ok) {
          console.log(`✅ Success: ${tpl.name}`);
        } else {
          console.log(`❌ Error: ${tpl.name} - ${JSON.stringify(data)}`);
        }
      } catch (err) {
        console.error(`💥 Exception: ${tpl.name}`, err);
      }
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

register();
