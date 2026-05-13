const WABA_IDS = ["998516322649692", "1030747186799321"];
const TOKEN = process.env.META_WHATSAPP_TOKEN;
const GRAPH_VERSION = "v21.0";

const templates = [
  {
    name: "agenda_disponivel",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! 😊\n\nA agenda médica de {{2}} já está disponível para agendamentos!\n\n📲 O agendamento é feito exclusivamente pelo nosso aplicativo. Acesse agora e garanta seu horário com praticidade!\n\nCuide da sua saúde! 💙",
        example: { body_text: [["Maria", "Maio/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Abrir Aplicativo",
            url: "https://app.sindicato.com.br/"
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
        text: "Informativo: A agenda de atendimentos médicos para o período de {{1}} já está disponível para consultas.\n\nOs horários podem ser visualizados e agendados diretamente através do aplicativo oficial do Sindicato dos Comerciários.",
        example: { body_text: [["Maio/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Acessar Aplicativo",
            url: "https://app.sindicato.com.br/"
          }
        ]
      }
    ]
  },
  {
    name: "carteira_vencida_util",
    language: "pt_BR",
    category: "MARKETING",
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
    category: "MARKETING",
  {
    name: "agenda_disponivel_util",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! 😊\n\nA agenda médica de {{2}} já está disponível para agendamentos!\n\n📲 O agendamento é feito exclusivamente pelo nosso aplicativo. Acesse agora e garanta seu horário com praticidade!\n\nCuide da sua saúde! 💙",
        example: { body_text: [["Maria", "Maio/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Abrir Aplicativo",
            url: "https://app.sindicato.com.br/"
          }
        ]
      }
    ]
  }
    components: [
      {
        type: "BODY",
        text: "Aviso de Atualização: Olá, {{1}}. Notificamos que o prazo de validade da sua carteira de associado encerra em {{2}}.\n\nPara orientações sobre o procedimento de renovação e continuidade do seu registro, consulte o aplicativo oficial do Sindicato dos Comerciários.",
        example: { body_text: [["João da Silva", "30/03/2026"]] }
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" }
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
