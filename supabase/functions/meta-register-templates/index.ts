import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

type Component =
  | { type: "BODY"; text?: string; add_security_recommendation?: boolean; example?: { body_text: string[][] } }
  | { type: "FOOTER"; text?: string; code_expiration_minutes?: number }
  | {
      type: "BUTTONS";
      buttons: Array<
        | { type: "OTP"; otp_type: "COPY_CODE"; text: string }
        | { type: "QUICK_REPLY"; text: string }
        | { type: "URL"; text: string; url: string; example?: string[] }
      >;
    };

interface TemplatePayload {
  name: string;
  language: string;
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  components: Component[];
}

const LANG = "pt_BR";

const templates: TemplatePayload[] = [
  {
    name: "boleto_mensalidade",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua mensalidade do Sindicato dos Comerciários referente a {{2}} está disponível.\n\nValor: R$ {{3}}\nVencimento: {{4}}\n\nAcesse o boleto e o código PIX em: {{5}} (link individual).",
        example: { body_text: [["João da Silva", "03/2026", "45,00", "10/03/2026", "https://app.sindicato.com.br/b/abc123"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "lembrete_consulta",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Lembrete da sua consulta no Sindicato dos Comerciários.\n\nProfissional: {{2}}\nEspecialidade: {{3}}\nData: {{4}} às {{5}}\nLocal: {{6}}\n\nEm caso de imprevisto, reagende em: https://app.sindicato.com.br",
        example: { body_text: [["Maria Santos", "Dr. Carlos Mendes", "Cardiologia", "15/03/2026", "14:30", "Sede Central - Rua Principal, 100"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "confirmacao_agendamento",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua consulta foi agendada com sucesso.\n\nProfissional: {{2}}\nEspecialidade: {{3}}\nData: {{4}} às {{5}}\nLocal: {{6}}\n\nPara reagendar ou cancelar, acesse: https://app.sindicato.com.br",
        example: { body_text: [["Maria Santos", "Dr. Carlos Mendes", "Cardiologia", "15/03/2026", "14:30", "Sede Central - Rua Principal, 100"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "aviso_vencimento_carteira",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Aviso de Atualização: Olá, {{1}}. Notificamos que o prazo de validade da sua carteira de associado encerra em {{2}}.\n\nPara orientações sobre o procedimento de renovação e continuidade do seu registro, consulte o aplicativo oficial do Sindicato dos Comerciários.",
        example: { body_text: [["João da Silva", "30/03/2026"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "aviso_carteira_vencida",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Notificação de Registro: Olá, {{1}}. Identificamos que sua carteira de associado atingiu o prazo de validade em {{2}}.\n\nPara regularizar seu cadastro e manter as informações atualizadas, acesse o aplicativo oficial ou entre em contato com nossa secretaria.",
        example: { body_text: [["João da Silva", "28/02/2026"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "boleto_vencido",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Identificamos que sua mensalidade referente a {{2}} está em aberto.\n\nValor original: R$ {{3}}\nVencimento original: {{4}}\n\nPara regularizar com a 2ª via atualizada, acesse: {{5}} (link individual).",
        example: { body_text: [["João da Silva", "02/2026", "45,00", "10/02/2026", "https://app.sindicato.com.br/b/abc123"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "autorizacao_pronta",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua autorização para {{2}} está pronta.\n\nProfissional: {{3}}\nValidade: {{4}}\n\nAcesse o documento em: https://app.sindicato.com.br",
        example: { body_text: [["Maria Santos", "Consulta de Cardiologia", "Dr. Carlos Mendes", "30/04/2026"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "codigo_acesso",
    language: LANG,
    category: "AUTHENTICATION",
    components: [
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 10 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
    ],
  },
  {
    name: "recuperacao_senha",
    language: LANG,
    category: "AUTHENTICATION",
    components: [
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 10 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
    ],
  },
  {
    name: "filiacao_aprovada",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua filiação ao Sindicato dos Comerciários foi aprovada.\n\nNúmero de matrícula: {{2}}\nPlano: {{3}}\n\nAcesse o app para visualizar sua carteira digital e benefícios em: https://app.sindicato.com.br",
        example: { body_text: [["João da Silva", "2026-00123", "Plano Família"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "homologacao_lembrete",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "🔔 Lembrete de {{1}}\n\nOlá, {{2}}. Você tem um agendamento de {{1}}.\n\nFuncionário: {{3}}\nEmpresa: {{4}}\nData: {{5}} às {{6}}\nProfissional: {{7}}\nLocal: Rua Coronel Paiva, 99, Centro - Ilhéus/BA (ao lado da Sorveteria Chiquinho)\n\nPor favor, compareça no horário agendado com toda a documentação necessária.",
        example: {
          body_text: [[
            "Homologação",
            "Empresa ABC",
            "João da Silva",
            "Comércio ABC Ltda",
            "15/03/2026",
            "14:30",
            "Dr. Carlos Mendes",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "homologacao_lembrete_profissional",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "🔔 Lembrete de {{1}}\n\nPrezado(a) {{2}}, você possui um atendimento de {{1}} agendado.\n\nFuncionário: {{3}}\nEmpresa: {{4}}\nData: {{5}} às {{6}}\nLocal: Rua Coronel Paiva, 99, Centro - Ilhéus/BA",
        example: {
          body_text: [[
            "Homologação",
            "Dr. Carlos Mendes",
            "João da Silva",
            "Comércio ABC Ltda",
            "15/03/2026",
            "14:30",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    // v2 com botões: Confirmar (QR), Cancelar (QR), Reagendar (URL dinâmica)
    // Body var {{8}} reservada para o slug do profissional usado no botão URL
    name: "homologacao_lembrete_v2",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "🔔 Lembrete de {{1}}\n\nOlá, {{2}}. Você tem um agendamento de {{1}}.\n\nFuncionário: {{3}}\nEmpresa: {{4}}\nData: {{5}} às {{6}}\nProfissional: {{7}}\nLocal: Rua Coronel Paiva, 99, Centro - Ilhéus/BA (ao lado da Sorveteria Chiquinho)\n\nPor favor, confirme sua presença abaixo ou reagende se necessário.",
        example: {
          body_text: [[
            "Homologação",
            "Empresa ABC",
            "João da Silva",
            "Comércio ABC Ltda",
            "15/03/2026",
            "14:30",
            "Dr. Carlos Mendes",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmar" },
          { type: "QUICK_REPLY", text: "Cancelar" },
          {
            type: "URL",
            text: "Reagendar",
            url: "https://prosindweb.com.br/agendamento/profissional/{{1}}",
            example: ["ione-atos-1"],
          },
        ],
      },
    ],
  },
  {
    // v2 com botões para o profissional
    name: "homologacao_lembrete_profissional_v2",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "🔔 Lembrete de {{1}}\n\nPrezado(a) {{2}}, você possui um atendimento de {{1}} agendado.\n\nFuncionário: {{3}}\nEmpresa: {{4}}\nData: {{5}} às {{6}}\nLocal: Rua Coronel Paiva, 99, Centro - Ilhéus/BA\n\nConfirme sua presença ou cancele caso haja imprevisto.",
        example: {
          body_text: [[
            "Homologação",
            "Dr. Carlos Mendes",
            "João da Silva",
            "Comércio ABC Ltda",
            "15/03/2026",
            "14:30",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmar" },
          { type: "QUICK_REPLY", text: "Cancelar" },
        ],
      },
    ],
  },
  {
    // v3 EMPRESA: texto fixo no início, sem repetição de variável, slug real no exemplo da URL.
    // Body vars: {{1}}=destinatário, {{2}}=funcionário, {{3}}=empresa, {{4}}=data, {{5}}=hora, {{6}}=profissional
    // URL var: slug do profissional
    name: "homologacao_lembrete_v3",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Lembrete de Homologação do Sindicato dos Comerciários.\n\nOlá, {{1}}. Segue o resumo do agendamento:\n\nFuncionário: {{2}}\nEmpresa: {{3}}\nData: {{4}} às {{5}}\nProfissional: {{6}}\nLocal: Rua Coronel Paiva, 99, Centro - Ilhéus/BA (ao lado da Sorveteria Chiquinho).\n\nPor favor, confirme sua presença abaixo ou reagende caso necessário.",
        example: {
          body_text: [[
            "Comércio ABC Ltda",
            "João da Silva",
            "Comércio ABC Ltda",
            "15/03/2026",
            "14:30",
            "Dra. Andrea Matos",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmar" },
          { type: "QUICK_REPLY", text: "Cancelar" },
          {
            type: "URL",
            text: "Reagendar",
            url: "https://prosindweb.com.br/agendamento/profissional/{{1}}",
            example: ["andrea-matos"],
          },
        ],
      },
    ],
  },
  {
    // v3 PROFISSIONAL: texto fixo no início, sem repetição de variável.
    // Body vars: {{1}}=profissional, {{2}}=funcionário, {{3}}=empresa, {{4}}=data, {{5}}=hora
    name: "homologacao_lembrete_profissional_v3",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Lembrete de Homologação do Sindicato dos Comerciários.\n\nPrezado(a) {{1}}, você possui um atendimento agendado:\n\nFuncionário: {{2}}\nEmpresa: {{3}}\nData: {{4}} às {{5}}\nLocal: Rua Coronel Paiva, 99, Centro - Ilhéus/BA.\n\nConfirme sua presença ou cancele caso haja imprevisto.",
        example: {
          body_text: [[
            "Dra. Andrea Matos",
            "João da Silva",
            "Comércio ABC Ltda",
            "15/03/2026",
            "14:30",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmar" },
          { type: "QUICK_REPLY", text: "Cancelar" },
        ],
      },
    ],
  },
  {
    name: "homologacao_confirmacao",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "✅ Confirmação de {{1}}\n\nSeu agendamento de {{1}} foi confirmado com sucesso.\n\nFuncionário: {{2}}\nEmpresa: {{3}}\nData: {{4}} às {{5}}\nProfissional: {{6}}\nLocal: Rua Coronel Paiva, 99, Centro - Ilhéus/BA (ao lado da Sorveteria Chiquinho)\n\nPor favor, compareça no horário agendado com toda a documentação necessária.",
        example: {
          body_text: [[
            "Homologação",
            "João da Silva",
            "Comércio ABC Ltda",
            "15/03/2026",
            "14:30",
            "Dr. Carlos Mendes",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
   {
     name: "homologacao_protocolo",
     language: LANG,
     category: "UTILITY",
     components: [
       {
         type: "BODY",
         text:
           "✅ Protocolo de {{1}}\n\nO processo de {{1}} foi concluído com sucesso.\n\nFuncionário: {{2}}\nEmpresa: {{3}}\nData: {{4}}\nProtocolo: {{5}}\n\nGuarde este protocolo para seus registros. Este é um comprovante oficial.",
         example: {
           body_text: [[
             "Homologação",
             "João da Silva",
             "Comércio ABC Ltda",
             "15/03/2026",
             "HOM-20260315-0001",
           ]],
         },
       },
       { type: "FOOTER", text: "Sindicato dos Comerciários" },
     ],
   },
   {
     name: "contracheque_aprovado",
     language: LANG,
     category: "UTILITY",
     components: [
       {
         type: "BODY",
         text:
           "✅ Olá, {{1}}!\n\nSeu contracheque foi *aprovado* com sucesso! 🎉\n\nSua carteirinha de associado(a) está renovada. Agora você pode continuar utilizando todos os benefícios e serviços do sindicato normalmente.\n\nObrigado pela confiança!",
         example: { body_text: [["João"]] },
       },
       { type: "FOOTER", text: "Sindicato dos Comerciários" },
     ],
   },
   {
     name: "carteirinha_atualizada",
     language: LANG,
     category: "UTILITY",
     components: [
       {
         type: "BODY",
         text:
           "✅ Olá, {{1}}!\n\nSeu contracheque foi aprovado e sua carteirinha foi atualizada! 🎉\n\nValidade: {{2}}\n\nAgora você pode continuar utilizando todos os benefícios do sindicato normalmente.\n\nObrigado pela confiança!",
         example: { body_text: [["João", "31/12/2026"]] },
       },
       { type: "FOOTER", text: "Sindicato dos Comerciários" },
     ],
   },
   {
     name: "agendamento_consulta",
     language: LANG,
     category: "UTILITY",
     components: [
       {
         type: "BODY",
         text:
           "Olá, {{1}}. Sua consulta foi agendada com sucesso.\n\nProfissional: {{2}}\nEspecialidade: {{3}}\nData: {{4}} às {{5}}\nLocal: {{6}}\n\nPara reagendar ou cancelar, acesse: https://app.sindicato.com.br",
         example: {
           body_text: [[
             "Maria Santos",
             "Dr. Carlos Mendes",
             "Cardiologia",
             "15/03/2026",
             "14:30",
             "Sede Central - Rua Principal, 100",
           ]],
         },
       },
       { type: "FOOTER", text: "Sindicato dos Comerciários" },
     ],
   },
    {
      name: "informativo_agenda_medica",
      language: LANG,
      category: "UTILITY",
      components: [
         {
           type: "BODY",
           text:
             "Informativo: A agenda de atendimentos médicos para o período de {{1}} já está disponível para consultas.\n\nOs horários podem ser visualizados e agendados diretamente através do aplicativo oficial do Sindicato dos Comerciários.",
           example: { body_text: [["Maio/2026"]] },
         },
        { type: "FOOTER", text: "Sindicato dos Comerciários" },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Acessar Aplicativo",
              url: "https://app.sindicato.com.br",
            },
          ],
        },
      ],
    },
  {
    name: "agenda_disponivel",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! 😊\n\nA agenda médica de {{2}} já está disponível para agendamentos!\n\n📲 O agendamento é feito exclusivamente pelo nosso aplicativo. Acesse agora e garanta seu horário com praticidade!\n\nCuide da sua saúde! 💙",
        example: { body_text: [["Maria", "Maio/2026"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Abrir Aplicativo",
            url: "https://app.sindicato.com.br/",
          },
        ],
      },
    ],
  },
  {
    name: "lembrete_consulta_v2",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Lembrete da sua consulta no Sindicato dos Comerciários.\n\nProfissional: {{2}}\nEspecialidade: {{3}}\nData: {{4}} às {{5}}\nLocal: {{6}}\n\nPor favor, confirme sua presença abaixo.",
        example: {
          body_text: [[
            "Maria Santos",
            "Dr. Carlos Mendes",
            "Cardiologia",
            "15/03/2026",
            "14:30",
            "Sede Central - Rua Principal, 100",
          ]],
        },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmar" },
          { type: "QUICK_REPLY", text: "Cancelar" },
        ],
      },
    ],
  },
 ];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const WABA_ID = url.searchParams.get("waba_id") || Deno.env.get("META_WABA_ID");
  const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");

  if (!WABA_ID || !TOKEN) {
    return new Response(
      JSON.stringify({ error: "WABA ID ou META_WHATSAPP_TOKEN não configurados" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Optional: filter by ?only=name1,name2
  const only = url.searchParams.get("only");
  const onlySet = only ? new Set(only.split(",").map((s) => s.trim())) : null;

  // GET ?action=list -> list templates from Meta
  const action = url.searchParams.get("action");
  if (action === "list") {
    const names = url.searchParams.get("names");
    const filter = names ? `&name=${encodeURIComponent(names)}` : "";
    const listUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates?fields=name,status,category,language,components&limit=200${filter}`;
    const r = await fetch(listUrl, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const data = await r.json();
    return new Response(JSON.stringify(data, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GET ?action=delete&name=lembrete_consulta -> delete template by name
  if (action === "delete") {
    const name = url.searchParams.get("name");
    if (!name) {
      return new Response(JSON.stringify({ error: "name param required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const delUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates?name=${encodeURIComponent(name)}`;
    const r = await fetch(delUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await r.json();
    return new Response(JSON.stringify({ name, status: r.status, ok: r.ok, response: data }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GET ?action=register-with-buttons&name=lembrete_consulta
  // Recreates a template with QUICK_REPLY buttons matching the active flow
  if (action === "register-with-buttons") {
    const name = url.searchParams.get("name");
    const templatesWithButtons: Record<string, Record<string, unknown>> = {
      lembrete_consulta: {
        name: "lembrete_consulta",
        language: "pt_BR",
        category: "UTILITY",
        components: [
          {
            type: "BODY",
            text: "Olá, {{1}}. Lembrete da sua consulta no Sindicato dos Comerciários.\n\nProfissional: {{2}}\nEspecialidade: {{3}}\nData: {{4}} às {{5}}\nLocal: {{6}}\n\nPor favor, confirme sua presença abaixo.",
            example: {
              body_text: [[
                "Maria Santos",
                "Dr. Carlos Mendes",
                "Cardiologia",
                "15/03/2026",
                "14:30",
                "Sede Central - Rua Principal, 100",
              ]],
            },
          },
          { type: "FOOTER", text: "Sindicato dos Comerciários" },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Confirmar" },
              { type: "QUICK_REPLY", text: "Cancelar" },
            ],
          },
        ],
      },
    };
    // Allow alternate name via ?as=lembrete_consulta_v2 (when Meta still locks original name)
    const overrideName = url.searchParams.get("as");
    if (overrideName && name && templatesWithButtons[name]) {
      templatesWithButtons[name] = { ...templatesWithButtons[name], name: overrideName };
    }
    if (!name || !templatesWithButtons[name]) {
      return new Response(JSON.stringify({ error: "valid name param required", available: Object.keys(templatesWithButtons) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(templatesWithButtons[name]),
    });
    const data = await r.json();
    return new Response(JSON.stringify({ name, status: r.status, ok: r.ok, response: data }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targets = onlySet ? templates.filter((t) => onlySet.has(t.name)) : templates;
  const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates`;

  const results: Array<Record<string, unknown>> = [];

  for (const tpl of targets) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tpl),
      });
      const data = await r.json();
      results.push({
        name: tpl.name,
        status: r.status,
        ok: r.ok,
        response: data,
      });
      console.log(`[meta-register] ${tpl.name} -> ${r.status} ${r.ok ? "OK" : "FAIL"}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: tpl.name, ok: false, error: msg });
      console.error(`[meta-register] ${tpl.name} EXCEPTION:`, msg);
    }
    // Small delay to avoid rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  const summary = {
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
