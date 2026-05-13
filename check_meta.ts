const TOKEN = process.env.META_WHATSAPP_TOKEN;
const WABA_ID = process.env.META_WABA_ID;

async function check() {
  console.log("WABA_ID starting with:", WABA_ID?.substring(0, 4));
  const url = `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=recuperacao_senha_link_v2`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await r.json();
  console.log(JSON.stringify(data, null, 2));
}

check();
