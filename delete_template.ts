const TOKEN = process.env.META_WHATSAPP_TOKEN;
const WABA_ID = "2080967275794470";
const name = "recuperacao_senha_link_v2";

async function del() {
  const url = `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=${name}`;
  const r = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await r.json();
  console.log(JSON.stringify(data, null, 2));
}

del();
