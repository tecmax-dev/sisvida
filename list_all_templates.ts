const TOKEN = process.env.META_WHATSAPP_TOKEN;
const WABA_ID = "2080967275794470";

async function list() {
  const url = `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?fields=name,status,category&limit=100`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await r.json();
  console.log(JSON.stringify(data, null, 2));
}

list();
