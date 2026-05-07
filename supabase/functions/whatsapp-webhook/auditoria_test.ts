import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const TEST_PHONE = "5573" + Math.floor(10000000 + Math.random() * 90000000);
const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

Deno.test("Auditoria: whatsapp-webhook deve registrar mensagem no banco", async () => {
  // Payload simulando mensagem da Meta via Evolution/Roteamento
  const payload = {
    event: "messages.upsert",
    instance: "meta",
    test: true,
    data: {
      key: { remoteJid: `${TEST_PHONE}@s.whatsapp.net`, fromMe: false, id: `test_auditoria_${Date.now()}` },
      message: { conversation: "Teste Auditoria Webhook" },
      pushName: "Tester Auditoria",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  assertEquals(res.status, 200, "O webhook deveria retornar 200 OK");
  const body = await res.json();
  assertEquals(body.success, true, "O corpo da resposta deveria indicar sucesso");
});

Deno.test("Auditoria: zapresponder-webhook deve normalizar e responder recebido", async () => {
  const payload = {
    raw_message: {
      from: TEST_PHONE,
      content: "Teste ZapResponder Auditoria",
      id: `zap_test_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000)
    },
    pushName: "Tester Zap",
    is_test: true
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/zapresponder-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  assertEquals(res.status, 200, "O zapresponder-webhook deveria retornar 200 OK");
  const body = await res.json();
  assert(body.received, "O zapresponder-webhook deveria confirmar o recebimento");
});