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
    // ── Authentication: require API key or internal Supabase call ──
    const apiKey = req.headers.get('x-api-key');
    const authHeader = req.headers.get('authorization');
    const expectedApiKey = Deno.env.get('EXTERNAL_INTEGRATION_API_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Allow if: valid API key, or called internally with anon/service key in auth header
    const isInternalCall = authHeader?.includes(supabaseAnonKey) || authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const isValidApiKey = expectedApiKey && apiKey === expectedApiKey;
    
    if (!isInternalCall && !isValidApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const sendWhatsAppReply = async (text: string): Promise<boolean> => {
      const dest = normalizedPhone.includes('@') ? normalizedPhone : `${normalizedPhone}@s.whatsapp.net`;
      const response = await fetch(`${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionConfig.api_key },
        body: JSON.stringify({
          number: dest,
          text,
        }),
      });

      const responseText = await response.text();
      console.log(`[external-integration] WhatsApp send status=${response.status}: ${responseText.substring(0, 300)}`);
      return response.ok;
    };

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

    // Special-case: when the external menu sends action="atendente", we should
    // NOT route to the AI assistant. Instead we ask the user for the subject
    // and create the "awaiting_handoff_subject" session so the webhook
    // captures the next reply, classifies it into a Whazing queue and freezes
    // the bot for human handoff. This guarantees the subject capture step
    // works even when the AI assistant has its own handoff tool.
    if (action.toLowerCase() === 'atendente') {
      // Notify Zap Responder via internal helper function if possible
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-zapresponder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            clinicId: resolvedClinicId,
            phone: normalizedPhone,
            message: "🔔 *SOLICITAÇÃO DE ATENDIMENTO HUMANO*\n\nO usuário escolheu falar com um atendente pelo menu externo.",
          }),
        });
      } catch (err) {
        console.error('[external-integration] Failed to notify Zap Responder:', err);
      }

      const askSubjectText = `Claro! Para que eu possa te encaminhar para a equipe certa, *qual é o assunto* que você gostaria de tratar com nosso atendimento? 📝\n\nPode descrever em poucas palavras (ex: dúvida sobre boleto, questão jurídica, contribuição da empresa, etc.).`;

      try {
        // Expire any previous AI sessions for this phone in this clinic so the
        // webhook does not get confused by older "atendente" rows.
        await supabase
          .from('whatsapp_ai_conversations')
          .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
          .eq('clinic_id', resolvedClinicId)
          .eq('phone', normalizedPhone)
          .gt('expires_at', new Date().toISOString());

        await supabase.from('whatsapp_ai_conversations').insert({
          clinic_id: resolvedClinicId,
          phone: normalizedPhone,
          messages: {
            source: 'external_integration',
            action: 'awaiting_handoff_subject',
            support_stage: 'awaiting_subject',
            original_action: action,
            context: context || null,
          },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        });
        console.log(`[external-integration] Created awaiting_handoff_subject session for ${normalizedPhone}`);
      } catch (sessionErr) {
        console.error('[external-integration] Failed to create awaiting_handoff_subject session:', sessionErr);
      }

      const delivered = await sendWhatsAppReply(askSubjectText);
      if (!delivered) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to deliver subject prompt via WhatsApp' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        await supabase.from('whatsapp_incoming_logs').insert({
          clinic_id: resolvedClinicId,
          phone: normalizedPhone,
          message_text: `[external-integration] action=atendente → asked for subject`,
          raw_payload: body,
          processed: true,
          processed_action: 'external_integration_ask_subject',
        });
      } catch (_logErr) { /* ignore */ }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'ask_subject',
          response: askSubjectText,
          message: 'Asked user for subject before human handoff',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create/update an AI conversation session so the webhook knows there's an active
    // session and does NOT re-trigger the initial menu (which causes a loop).
    try {
      await supabase.from('whatsapp_ai_conversations').insert({
        clinic_id: resolvedClinicId,
        phone: normalizedPhone,
        messages: {
          source: 'external_integration',
          action,
          context: context || null,
          support_stage: action.toLowerCase() === 'atendente' ? 'awaiting_subject' : null,
        },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      console.log(`[external-integration] Created AI conversation session for ${normalizedPhone}`);
    } catch (sessionErr) {
      console.error('[external-integration] Failed to create AI session:', sessionErr);
    }

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
        deliver_response_via_caller: true,
      }),
    });

    const aiResult = await aiResponse.json();
    console.log(`[external-integration] AI response:`, JSON.stringify(aiResult).substring(0, 500));

    // Handle special handoff responses
    if (aiResult.response === 'HANDOFF_BOOKING' && aiResult.handoff_to_booking) {
      // The AI wants to hand off to booking - send a message and let the booking flow handle it
      await sendWhatsAppReply('Para agendar sua consulta, por favor informe seu *CPF* ou *número da carteirinha* (apenas números).');

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

    if (typeof aiResult.response === 'string' && aiResult.response.trim()) {
      const delivered = await sendWhatsAppReply(aiResult.response);
      if (!delivered) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to deliver WhatsApp response' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log the interaction
    try {
      await supabase.from('whatsapp_incoming_logs').insert({
        clinic_id: resolvedClinicId,
        phone: normalizedPhone,
        message_text: `[external-integration] action=${action} | ${aiMessage}`,
        raw_payload: body,
        processed: true,
        processed_action: 'external_integration',
      });
    } catch (logErr) {
      console.error('[external-integration] Log error:', logErr);
    }

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
