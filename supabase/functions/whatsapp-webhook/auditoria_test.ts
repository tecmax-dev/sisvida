import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const TEST_PHONE = "55739" + Math.floor(10000000 + Math.random() * 90000000);
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

  assertEquals(res.status, 200);
  
  // Aguarda processamento assíncrono do banco
  await new Promise(r => setTimeout(r, 2000));

  // Verifica se o log foi criado na tabela de auditoria (whatsapp_ticket_messages)
  const { data: contact } = await supabase.from('whatsapp_contacts').select('id, phone').eq('phone', TEST_PHONE).maybeSingle();
  if (!contact) {
    const { data: all } = await supabase.from('whatsapp_contacts').select('phone').order('created_at', { ascending: false }).limit(10);
    console.log("Últimos contatos:", all);
    assert(contact, `Contato ${TEST_PHONE} não encontrado.`);
  }

  const { data: ticket } = await supabase.from('whatsapp_tickets').select('id').eq('contact_id', contact?.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  assert(ticket, `Ticket para ${TEST_PHONE} não encontrado.`);

  const { data: messages } = await supabase
    .from('whatsapp_ticket_messages')
    .select('*')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: false });

  assert(messages && messages.length > 0, "Deveria haver mensagens registradas na auditoria");
  const hasContent = messages.some((m: any) => m.content && m.content.includes("Teste Auditoria Webhook"));
  assert(hasContent, "A mensagem enviada não foi encontrada na tabela de auditoria");
});

Deno.test("Auditoria: zapresponder-webhook deve normalizar e registrar", async () => {
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

  assertEquals(res.status, 200);
  
  await new Promise(r => setTimeout(r, 2000));

  const { data: contact } = await supabase.from('whatsapp_contacts').select('id').eq('phone', TEST_PHONE).maybeSingle();
  const { data: ticket } = await supabase.from('whatsapp_tickets').select('id').eq('contact_id', contact?.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  
  const { data: messages } = await supabase
    .from('whatsapp_ticket_messages')
    .select('*')
    .eq('ticket_id', ticket?.id)
    .order('created_at', { ascending: false });

  const hasZapContent = messages?.some((m: any) => m.content && m.content.includes("Teste ZapResponder Auditoria"));
  assert(hasZapContent, "A mensagem do ZapResponder não foi registrada corretamente");
});