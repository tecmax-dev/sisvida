const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action = 'send', to, template = 'hello_world', language = 'en_US', pin } = body;

    const token = Deno.env.get('META_WHATSAPP_TOKEN');
    const phoneId = Deno.env.get('META_PHONE_NUMBER_ID');

    if (!token || !phoneId) {
      return new Response(
        JSON.stringify({ error: 'META_WHATSAPP_TOKEN ou META_PHONE_NUMBER_ID não configurados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let url: string;
    let payload: Record<string, unknown>;

    if (action === 'register') {
      if (!pin || !/^\d{6}$/.test(String(pin))) {
        return new Response(
          JSON.stringify({ error: 'PIN de 6 dígitos obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      url = `https://graph.facebook.com/v21.0/${phoneId}/register`;
      payload = { messaging_product: 'whatsapp', pin: String(pin) };
    } else {
      if (!to || typeof to !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Campo "to" obrigatório (ex: 5573999999999)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const cleanedTo = to.replace(/\D/g, '');
      url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      payload = {
        messaging_product: 'whatsapp',
        to: cleanedTo,
        type: 'template',
        template: { name: template, language: { code: language } },
      };
    }

    console.log('[meta-whatsapp-test] POST', url, JSON.stringify(payload));

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log('[meta-whatsapp-test] response', res.status, JSON.stringify(data));

    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, response: data }),
      { status: res.ok ? 200 : res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[meta-whatsapp-test] error', err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});