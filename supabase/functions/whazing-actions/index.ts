import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ticketId, message, queueId, userId } = await req.json();
    
    const whazingApiUrl = Deno.env.get('WHAZING_API_URL')!;
    const whazingApiToken = Deno.env.get('WHAZING_API_TOKEN')!;

    console.log(`[whazing-actions] Action: ${action}, Ticket: ${ticketId}`);

    let endpoint = '';
    let method = 'POST';
    let body: any = {};

    switch (action) {
      case 'send_message': {
        // Send message via Whazing API
        endpoint = `${whazingApiUrl}/sendText`;
        body = {
          ticketId: Number(ticketId),
          body: message,
        };
        break;
      }
      case 'close_ticket': {
        endpoint = `${whazingApiUrl}/closeTicket`;
        body = { ticketId: Number(ticketId) };
        break;
      }
      case 'transfer_queue': {
        endpoint = `${whazingApiUrl}/transferTicket`;
        body = { 
          ticketId: Number(ticketId),
          queueId: Number(queueId),
        };
        break;
      }
      case 'transfer_user': {
        endpoint = `${whazingApiUrl}/transferTicket`;
        body = {
          ticketId: Number(ticketId),
          userId: Number(userId),
        };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`[whazing-actions] ${method} ${endpoint}`);

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingApiToken}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log(`[whazing-actions] Response: ${response.status} ${responseText.slice(0, 500)}`);

    let responseData;
    try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

    if (!response.ok) {
      return new Response(JSON.stringify({ ok: false, error: `API returned ${response.status}`, details: responseData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[whazing-actions] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
