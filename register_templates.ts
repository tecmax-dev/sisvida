const WABA_IDS = ["2080967275794470", "998516322649692", "1030747186799321"];
const TOKEN = process.env.META_WHATSAPP_TOKEN;
const GRAPH_VERSION = "v21.0";

const templates = [
  {
    name: "agenda_disponivel",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Notificação de Atendimento Social: Olá, {{1}}. Informamos que o cronograma de atendimentos médicos na sede do Sindicato para o período de {{2}} já está disponível.\n\nPara consultar horários e realizar seu agendamento, acesse o aplicativo oficial.",
        example: { body_text: [["Maria", "Maio/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Acessar Aplicativo",
            url: "https://prosindweb.com.br/app"
          }
        ]
      }
    ]
  },
  {
    name: "informativo_agenda_medica",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Atualização de Serviço Social: A agenda de atendimentos médicos na sede do Sindicato para o período de {{1}} já está disponível para consulta.\n\nOs horários podem ser visualizados e agendados diretamente através do aplicativo oficial.",
        example: { body_text: [["Maio/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Acessar Aplicativo",
            url: "https://prosindweb.com.br/app"
          }
        ]
      }
    ]
  },
  {
    name: "carteira_vencida_util",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Notificação de Registro: Olá, {{1}}. Identificamos que sua carteira de associado atingiu o prazo de validade em {{2}}.\n\nPara regularizar seu cadastro e manter as informações atualizadas, acesse o aplicativo oficial ou entre em contato com nossa secretaria.",
        example: { body_text: [["João da Silva", "28/02/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" }
    ]
  },
  {
    name: "carteira_vencendo_util",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Aviso de Atualização: Olá, {{1}}. Notificamos que o prazo de validade da sua carteira de associado encerra em {{2}}.\n\nPara orientações sobre o procedimento de renovação e continuidade do seu registro, consulte o aplicativo oficial do Sindicato dos Comerciários.",
        example: { body_text: [["João da Silva", "30/03/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" }
    ]
  },
  {
    name: "agenda_disponivel_util",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Notificação de Atendimento Social: Olá, {{1}}. Informamos que o cronograma de atendimentos médicos na sede do Sindicato para o período de {{2}} já está disponível.\n\nPara consultar horários e realizar seu agendamento, acesse o aplicativo oficial.",
        example: { body_text: [["Maria", "Maio/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Acessar Aplicativo",
            url: "https://prosindweb.com.br/app"
          }
        ]
      }
    ]
  },
  {
    name: "recuperacao_senha_link_v3",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}. Você solicitou a recuperação de acesso ao aplicativo do Sindicato dos Comerciários.\n\nPara continuar e definir sua nova senha, toque no link abaixo:",
        example: { body_text: [["Associado"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
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
  {
    name: "ia_prontuario_informativo",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Informação de Serviço: Olá, {{1}}. Comunicamos que uma nova funcionalidade está disponível em nosso sistema de prontuários: a transcrição de voz para texto durante o registro de atendimentos.\n\nEste recurso permite que os profissionais de saúde registrem informações de forma mais ágil, convertendo a fala em texto automaticamente.\n\nPara conhecer a funcionalidade, acesse o aplicativo oficial.",
        example: { body_text: [["Maria Silva"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Acessar Aplicativo",
            url: "https://prosindweb.com.br/app"
          }
        ]
      }
    ]
  }
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
