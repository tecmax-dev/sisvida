// external-integration v1.0
// Receives HTTP requests from external systems (Whaticket, etc.)
// and routes actions to eCLINI's AI assistant or booking flow.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ExternalRequest {
  phone: string;          // Phone number of the user (with country code, e.g. 5573999999999)
  action: string;         // Action/selection from external menu (e.g. "associado", "empresa", "agendamento", "boleto", "atendente", "custom")
  message?: string;       // Optional: free-text message from user
  context?: string;       // Optional: additional context (e.g. "menu_path: 1-2", "selected: Sou associado")
  instance_name?: string; // Optional: Evolution API instance name (defaults to lookup by phone)
  clinic_id?: string;     // Optional: clinic ID (auto-resolved if not provided)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ExternalRequest = await req.json();
    const { phone, action, message, context, instance_name, clinic_id } = body;

    if (!phone || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'phone and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

    console.log(`[external-integration] Received: action="${action}", phone="${normalizedPhone}", context="${context || ''}"`);

    // Resolve clinic and Evolution config
    let resolvedClinicId = clinic_id;
    let evolutionConfig: { api_url: string; api_key: string; instance_name: string; booking_enabled?: boolean } | null = null;

    if (instance_name) {
      const { data: config } = await supabase
        .from('evolution_configs')
        .select('clinic_id, api_url, api_key, instance_name, booking_enabled')
        .eq('instance_name', instance_name)
        .maybeSingle();
      if (config) {
        resolvedClinicId = config.clinic_id;
        evolutionConfig = config;
      }
    }

    if (!resolvedClinicId && !instance_name) {
      // Try to find by first active config (single-instance setups)
      const { data: configs } = await supabase
        .from('evolution_configs')
        .select('clinic_id, api_url, api_key, instance_name, booking_enabled')
        .limit(1);
      if (configs && configs.length > 0) {
        resolvedClinicId = configs[0].clinic_id;
        evolutionConfig = configs[0];
      }
    }

    if (!resolvedClinicId || !evolutionConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not resolve clinic. Provide clinic_id or instance_name.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!evolutionConfig && resolvedClinicId) {
      const { data: config } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name, booking_enabled')
        .eq('clinic_id', resolvedClinicId)
        .maybeSingle();
      evolutionConfig = config;
    }

    if (!evolutionConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API not configured for this clinic' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map external action to AI message
    const actionMap: Record<string, string> = {
      'associado': 'Sou associado(a) e preciso de ajuda.',
      'empresa': 'Sou empresa e preciso de informações.',
      'contador': 'Sou contador/escritório contábil.',
      'comerciario': 'Gostaria de informações sobre o Dia do Comerciário.',
      'atendente': 'Gostaria de falar com um atendente.',
      'agendamento': 'Quero agendar uma consulta.',
      'boleto': 'Preciso de segunda via de boleto.',
      'carteirinha': 'Preciso atualizar minha carteirinha.',
      'juridico': 'Preciso de atendimento jurídico.',
      'cct': 'Quero informações sobre a convenção coletiva.',
      'piso': 'Qual o piso salarial atual?',
      'endereco': 'Qual o endereço do sindicato?',
      'homologacao': 'Preciso de informações sobre homologação.',
    };

    // Build the message to send to AI assistant
    let aiMessage = message || actionMap[action.toLowerCase()] || action;

    // If context is provided, prepend it
    if (context) {
      aiMessage = `[Contexto do sistema externo: ${context}] ${aiMessage}`;
    }

    console.log(`[external-integration] Routing to AI assistant: clinic=${resolvedClinicId}, message="${aiMessage}"`);

    // Call the AI assistant edge function
    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        clinic_id: resolvedClinicId,
        phone: normalizedPhone,
        message: aiMessage,
        evolution_config: {
          api_url: evolutionConfig.api_url,
          api_key: evolutionConfig.api_key,
          instance_name: evolutionConfig.instance_name,
        },
        suppress_internal_menu: true,
        external_menu_mode: true,
      }),
    });

    const aiResult = await aiResponse.json();
    console.log(`[external-integration] AI response:`, JSON.stringify(aiResult).substring(0, 500));

    // Handle special handoff responses
    if (aiResult.response === 'HANDOFF_BOOKING' && aiResult.handoff_to_booking) {
      // The AI wants to hand off to booking - send a message and let the booking flow handle it
      const dest = normalizedPhone.includes('@') ? normalizedPhone : `${normalizedPhone}@s.whatsapp.net`;
      await fetch(`${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionConfig.api_key },
        body: JSON.stringify({
          number: dest,
          text: 'Para agendar sua consulta, por favor informe seu *CPF* ou *número da carteirinha* (apenas números).',
        }),
      });

      return new Response(
        JSON.stringify({ success: true, action: 'handoff_booking', message: 'Booking flow initiated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aiResult.response === 'HANDOFF_BOLETO') {
      return new Response(
        JSON.stringify({ success: true, action: 'handoff_boleto', message: 'Boleto flow initiated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the interaction
    await supabase.from('whatsapp_incoming_logs').insert({
      clinic_id: resolvedClinicId,
      phone: normalizedPhone,
      message_text: `[external-integration] action=${action} | ${aiMessage}`,
      raw_payload: body,
      processed: true,
      processed_action: 'external_integration',
    }).catch((e: Error) => console.error('[external-integration] Log error:', e));

    return new Response(
      JSON.stringify({
        success: true,
        action: aiResult.action || 'ai_response',
        response: aiResult.response || null,
        message: 'Message processed and sent via WhatsApp',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[external-integration] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
