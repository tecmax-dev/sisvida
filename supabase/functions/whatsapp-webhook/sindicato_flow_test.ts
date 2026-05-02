// Regression test for the /sindicato Evolution flow (instance "secmi").
//
// Calls the deployed whatsapp-webhook edge function in TEST MODE
// (`test: true` in the payload) so replies are collected synchronously
// in the HTTP response (`reply` field) instead of being dispatched to
// the Evolution API. This validates routing and button payloads
// end-to-end without sending real WhatsApp messages.
//
// Run locally with the Supabase test runner. Requires VITE_SUPABASE_URL
// and VITE_SUPABASE_PUBLISHABLE_KEY in .env.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

const SINDICATO_INSTANCE = "secmi";
// Fake test phone (Bahia DDD 73). Not used to deliver – test mode short-circuits.
const TEST_PHONE = "5573988880000";
const REMOTE_JID = `${TEST_PHONE}@s.whatsapp.net`;

interface WebhookResult {
  status: number;
  body: { success?: boolean; reply?: string; error?: string; [k: string]: unknown };
}

async function callWebhook(payload: Record<string, unknown>): Promise<WebhookResult> {
  // Retry once on cold-start / idle-timeout (504) — the first invocation of
  // whatsapp-webhook can take >2 min to boot if it has been cold for a while.
  let lastStatus = 0;
  let lastBodyText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ ...payload, test: true }),
    });
    lastStatus = res.status;
    lastBodyText = await res.text();
    if (res.status !== 504 && res.status !== 502) break;
    // brief backoff before retry so the function has a chance to warm up
    await new Promise((r) => setTimeout(r, 1500));
  }
  let body: WebhookResult["body"] = {};
  try { body = JSON.parse(lastBodyText); } catch { body = { raw: lastBodyText } as never; }
  return { status: lastStatus, body };
}

function textMessage(text: string, idSuffix: string) {
  return {
    event: "messages.upsert",
    instance: SINDICATO_INSTANCE,
    data: {
      key: { remoteJid: REMOTE_JID, fromMe: false, id: `test_${idSuffix}_${Date.now()}` },
      message: { conversation: text },
      pushName: "Teste Regressão",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };
}

function buttonResponse(buttonId: string, displayText: string, idSuffix: string) {
  return {
    event: "messages.upsert",
    instance: SINDICATO_INSTANCE,
    data: {
      key: { remoteJid: REMOTE_JID, fromMe: false, id: `test_${idSuffix}_${Date.now()}` },
      message: {
        buttonsResponseMessage: {
          selectedButtonId: buttonId,
          selectedDisplayText: displayText,
        },
      },
      pushName: "Teste Regressão",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };
}

Deno.test("sindicato flow: greeting renders main menu (Associado/Empresa/Contabilidade)", async () => {
  const { status, body } = await callWebhook(textMessage("Olá", "greet"));
  assertEquals(status, 200, `unexpected status ${status}: ${JSON.stringify(body)}`);
  assertEquals(body.success, true);
  const reply = String(body.reply ?? "");
  assert(reply.length > 0, "expected a reply for greeting");
  // Main menu must offer the three top-level categories
  assert(/associado/i.test(reply), `missing "Associado" in reply: ${reply}`);
  assert(/empresa/i.test(reply), `missing "Empresa" in reply: ${reply}`);
  assert(/contabilidade/i.test(reply), `missing "Contabilidade" in reply: ${reply}`);
});

Deno.test("sindicato flow: associado button opens submenu", async () => {
  // Reset: greet first to ensure session starts at MAIN_MENU
  await callWebhook(textMessage("Menu", "reset_assoc"));
  const { status, body } = await callWebhook(
    buttonResponse("whazing_associado", "Sou Associado", "btn_assoc"),
  );
  assertEquals(status, 200, `unexpected status ${status}: ${JSON.stringify(body)}`);
  assertEquals(body.success, true);
  const reply = String(body.reply ?? "");
  // Submenu real do webhook (index.ts ~L903):
  //   "Você selecionou *Sou Associado*.\n\nEscolha o que deseja (digite o número):"
  //   + botões: "Atualizar Carteirinha", "Convenções Coletivas", "Outros Assuntos"
  // Os títulos dos botões são truncados em 20 chars por sendWhatsAppButtons,
  // então "Convenções Coletivas" pode aparecer como "Convenções Coletiva".
  assert(
    /você selecionou.*sou associado/i.test(reply),
    `missing confirmation "Você selecionou Sou Associado": ${reply}`,
  );
   // "Atualizar Carteirinha" (21 chars) is truncated to 20 chars by the bot: "Atualizar Carteirinh"
   assert(/atualizar carteirinh/i.test(reply), `missing "Atualizar Carteirinha" button: ${reply}`);
   // The bot code trims emojis and truncates to 20 chars.
   // "Convenções Coletivas" is exactly 20 chars, but depending on how emojis/spacing 
   // were handled in the actual reply string, we check for a flexible match.
   assert(/conven/i.test(reply) && /coletiv/i.test(reply), `missing "Convenções Coletivas" button: ${reply}`);
  assert(/outros assuntos/i.test(reply), `missing "Outros Assuntos" button: ${reply}`);
});

Deno.test("sindicato flow: carteirinha submenu shows follow-up options", async () => {
  await callWebhook(textMessage("Menu", "reset_cart"));
  await callWebhook(buttonResponse("whazing_associado", "Sou Associado", "pre_cart"));
  const { status, body } = await callWebhook(
    buttonResponse("whazing_sub_carteirinha", "Atualizar Carteirinha", "btn_cart"),
  );
  assertEquals(status, 200);
  assertEquals(body.success, true);
  const reply = String(body.reply ?? "");
  // O texto longo de orientação ("Atualização de Carteirinha…") é despachado
  // direto pela Whazing API, fora do coletor síncrono. Já o prompt de
  // follow-up usa sendWhatsAppButtons → cai no coletor.
  // Esperado (index.ts ~L8310): "Posso ajudar com mais alguma coisa?"
  // + botões "Falar c/ Atendente", "Voltar", "Menu Principal".
  assert(
    /posso ajudar com mais alguma coisa/i.test(reply),
    `missing follow-up prompt "Posso ajudar com mais alguma coisa?": ${reply}`,
  );
  assert(/falar c\/?\s*atendente/i.test(reply), `missing "Falar c/ Atendente" button: ${reply}`);
  assert(/\bvoltar\b/i.test(reply), `missing "Voltar" button: ${reply}`);
  assert(/menu principal/i.test(reply), `missing "Menu Principal" button: ${reply}`);
});

Deno.test("sindicato flow: empresa → 2ª via boleto routes to boleto handler", async () => {
  await callWebhook(textMessage("Menu", "reset_emp"));
  await callWebhook(buttonResponse("whazing_empresa", "Sou Empresa", "pre_emp"));
  const { status, body } = await callWebhook(
    buttonResponse("whazing_sub_boleto", "2ª Via Boleto", "btn_boleto"),
  );
  assertEquals(status, 200);
  assertEquals(body.success, true);
  // O fluxo de boleto é delegado à edge function `boleto-whatsapp-flow`, que
  // envia mensagens diretamente via Evolution (fora do coletor síncrono).
  // Em modo teste, o webhook responde com sucesso assim que o roteamento
  // ocorre. Validamos apenas: (1) status 200, (2) success=true,
  // (3) ausência de erro no payload — i.e. o roteador reconheceu o botão e
  // não caiu no fallback de IA/menu.
  assert(
    !("error" in body) || !body.error,
    `boleto routing returned an error: ${JSON.stringify(body)}`,
  );
});

Deno.test("sindicato flow: numeric fallback '1' behaves like first menu button", async () => {
  await callWebhook(textMessage("Menu", "reset_num"));
  const { status, body } = await callWebhook(textMessage("1", "num_one"));
  assertEquals(status, 200);
  assertEquals(body.success, true);
  const reply = String(body.reply ?? "");
  // "1" no MAIN_MENU é remapeado para `whazing_associado`, então deve
  // produzir a mesma resposta do botão Associado: confirmação
  // "Você selecionou Sou Associado" + submenu com Atualizar Carteirinha.
  assert(
    /você selecionou.*sou associado/i.test(reply) ||
      /atualizar carteirinha/i.test(reply),
    `numeric fallback "1" did not open associado submenu: ${reply}`,
  );
});