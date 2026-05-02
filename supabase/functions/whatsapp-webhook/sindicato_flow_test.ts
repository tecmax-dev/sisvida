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
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ ...payload, test: true }),
  });
  const text = await res.text();
  let body: WebhookResult["body"] = {};
  try { body = JSON.parse(text); } catch { body = { raw: text } as never; }
  return { status: res.status, body };
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
  // Associado submenu should expose Carteirinha + Convenções + Outros
  assert(/carteirinha/i.test(reply), `missing "Carteirinha" in submenu: ${reply}`);
  assert(/conven/i.test(reply), `missing "Convenções" in submenu: ${reply}`);
  assert(/outros/i.test(reply), `missing "Outros" in submenu: ${reply}`);
});

Deno.test("sindicato flow: carteirinha submenu redirects to app", async () => {
  await callWebhook(textMessage("Menu", "reset_cart"));
  await callWebhook(buttonResponse("whazing_associado", "Sou Associado", "pre_cart"));
  const { status, body } = await callWebhook(
    buttonResponse("whazing_sub_carteirinha", "Atualizar Carteirinha", "btn_cart"),
  );
  assertEquals(status, 200);
  assertEquals(body.success, true);
  const reply = String(body.reply ?? "");
  // Final action must instruct to use the app and link to the install page
  assert(/aplicativo|app/i.test(reply), `missing app instruction: ${reply}`);
  assert(
    /prosindweb\.com\.br\/sindicato\/instalar/i.test(reply),
    `missing install link: ${reply}`,
  );
});

Deno.test("sindicato flow: empresa → 2ª via boleto routes to boleto handler", async () => {
  await callWebhook(textMessage("Menu", "reset_emp"));
  await callWebhook(buttonResponse("whazing_empresa", "Sou Empresa", "pre_emp"));
  const { status, body } = await callWebhook(
    buttonResponse("whazing_sub_boleto", "2ª Via Boleto", "btn_boleto"),
  );
  assertEquals(status, 200);
  assertEquals(body.success, true);
  const reply = String(body.reply ?? "");
  // Boleto handler asks for CPF/CNPJ identification or returns boletos.
  // Either way the response must be non-empty and reference boleto or CNPJ.
  assert(reply.length > 0, "expected non-empty boleto reply");
  assert(
    /boleto|cnpj|cpf|identifica/i.test(reply),
    `boleto reply did not match expected keywords: ${reply}`,
  );
});

Deno.test("sindicato flow: numeric fallback '1' behaves like first menu button", async () => {
  await callWebhook(textMessage("Menu", "reset_num"));
  const { status, body } = await callWebhook(textMessage("1", "num_one"));
  assertEquals(status, 200);
  assertEquals(body.success, true);
  const reply = String(body.reply ?? "");
  // "1" should map to the Associado submenu (carteirinha/convenções/outros)
  assert(
    /carteirinha|conven|outros/i.test(reply),
    `numeric fallback did not open associado submenu: ${reply}`,
  );
});