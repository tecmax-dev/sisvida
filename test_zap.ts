const ZAP_TOKEN = Deno.env.get("ZAPRESPONDER_API_TOKEN") || Deno.env.get("ZAPSTER_API_TOKEN");
const BASE_URL = "https://api.zapresponder.com.br";

const endpoints = [
  "/whatsapp/messages/send",
  "/messages/send",
  "/api/v1/messages/send",
  "/api/messages/send",
  "/webhook",
  "/api/webhook"
];

for (const ep of endpoints) {
  try {
    const res = await fetch(`${BASE_URL}${ep}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZAP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone: "5573988000000", // dummy
        message: "test"
      })
    });
    console.log(`Endpoint: ${ep} | Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`Endpoint: ${ep} | Error: ${e.message}`);
  }
}
