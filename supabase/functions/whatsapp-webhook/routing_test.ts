 import "https://deno.land/std@0.224.0/dotenv/load.ts";
 import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
 
 const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
 const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || "";
 const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
 
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
   const lastStatus = res.status;
   const lastBodyText = await res.text();
   let body: WebhookResult["body"] = {};
   try { body = JSON.parse(lastBodyText); } catch { body = { raw: lastBodyText } as never; }
   return { status: lastStatus, body };
 }
 
 function metaMessage(text: string, phoneId: string = "1110151302179856") {
   return {
     instance: "meta",
     metadata: { phone_number_id: phoneId },
     data: {
       key: { remoteJid: "557332311784@s.whatsapp.net", fromMe: false },
       message: { conversation: text }
     }
   };
 }
 
 function evolutionMessage(text: string, instanceName: string = "secmi") {
   return {
     instance: instanceName,
     data: {
       key: { remoteJid: "557332311784@s.whatsapp.net", fromMe: false },
       message: { conversation: text }
     }
   };
 }
 
 Deno.test("Routing: instance 'meta' should trigger Sindicato flow", async () => {
   const { status, body } = await callWebhook(metaMessage("Olá"));
   assertEquals(status, 200);
   assertEquals(body.success, true);
   const reply = String(body.reply ?? "");
   // Sindicato main menu keywords
   assert(/associado/i.test(reply), "Sindicato flow (meta) should show 'Associado'");
   assert(/contabilidade/i.test(reply), "Sindicato flow (meta) should show 'Contabilidade'");
 });
 
 Deno.test("Routing: instance 'secmi' should trigger Clinic/Sindicato flow (Evolution)", async () => {
   const { status, body } = await callWebhook(evolutionMessage("Olá", "secmi"));
   assertEquals(status, 200);
   assertEquals(body.success, true);
   const reply = String(body.reply ?? "");
   // Evolution instance 'secmi' is currently mapped to Sindicato clinic too in evolution_configs
   assert(/associado/i.test(reply), "Evolution flow (secmi) should show 'Associado'");
 });
 
 Deno.test("Routing: unknown instance should fallback to AI or fail gracefully", async () => {
   const { status, body } = await callWebhook(evolutionMessage("Olá", "unknown_instance"));
   // If no config found, it might return 200 but without specific menu if fallback fails
   assertEquals(status, 200);
   console.log("Unknown instance reply:", body.reply);
 });