import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logo padrão do sistema Eclini para cabeçalho de mensagens WhatsApp
const DEFAULT_SYSTEM_LOGO = 'https://eclini.lovable.app/eclini-whatsapp-header.jpg';

interface WhatsAppRequest {
  phone: string;
  message: string;
  clinicId: string;
  type?: 'reminder' | 'confirmation' | 'custom' | 'document';
  imageUrl?: string; // URL da imagem para enviar como cabeçalho
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Verify Authorization header exists
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[send-whatsapp] Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create client with user's auth to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('[send-whatsapp] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request body
    const { phone, message, clinicId, type = 'custom' }: WhatsAppRequest = await req.json();

    if (!phone || !message || !clinicId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Telefone, mensagem e ID da clínica são obrigatórios' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate phone format
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato de telefone inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validate message length
    if (message.length > 4096) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mensagem muito longa (máx 4096 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Create service role client for RPC call
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 7. Verify user has access to this clinic (or is super admin)
    const { data: hasAccess, error: accessError } = await supabase.rpc('has_clinic_access', {
      _user_id: user.id,
      _clinic_id: clinicId
    });

    // Super-admin bypass (admin panel can message any clinic)
    let isSuperAdmin = false;
    if (!accessError && !hasAccess) {
      const { data: superAdminRow, error: superAdminError } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (superAdminError) {
        console.error('[send-whatsapp] Error checking super admin:', superAdminError);
      }
      isSuperAdmin = !!superAdminRow;
    }

    if (accessError || (!hasAccess && !isSuperAdmin)) {
      console.error(`[send-whatsapp] User ${user.id} denied access to clinic ${clinicId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado a esta clínica' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isSuperAdmin) {
      console.log(`[send-whatsapp] Super admin override for clinic ${clinicId}`);
    }

    // 8. Check message limit for the clinic
    const monthYear = new Date().toISOString().slice(0, 7);
    const { data: usageData, error: usageError } = await supabase.rpc('get_clinic_message_usage', {
      _clinic_id: clinicId,
      _month_year: monthYear
    });

    if (usageError) {
      console.error('[send-whatsapp] Error checking message usage:', usageError);
    } else if (usageData && usageData.length > 0) {
      const usage = usageData[0];
      console.log(`[Clinic ${clinicId}] Message usage: ${usage.used}/${usage.max_allowed} (remaining: ${usage.remaining})`);
      
      if (usage.max_allowed > 0 && usage.remaining <= 0) {
        console.log(`[Clinic ${clinicId}] Message limit reached`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Limite de mensagens do mês atingido. Faça upgrade do plano para enviar mais.',
            usage: usage
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 9. Check which WhatsApp provider to use
    const { data: clinicProviderData } = await supabase
      .from('clinics')
      .select('whatsapp_provider, logo_url, whatsapp_header_image_url')
      .eq('id', clinicId)
      .single();

    const whatsappProvider = clinicProviderData?.whatsapp_provider || 'evolution';
    const logoUrl = clinicProviderData?.whatsapp_header_image_url || clinicProviderData?.logo_url || DEFAULT_SYSTEM_LOGO;

    console.log(`[Clinic ${clinicId}] Using WhatsApp provider: ${whatsappProvider}`);

    // ========== TWILIO PROVIDER ==========
    if (whatsappProvider === 'twilio') {
      const { data: twilioConfig, error: twilioError } = await supabase
        .from('twilio_configs')
        .select('account_sid, auth_token, phone_number, is_connected')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (twilioError || !twilioConfig) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Twilio não configurado. Configure em Configurações > Integrações > Twilio.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { account_sid, auth_token, phone_number } = twilioConfig;
      const twilioAuth = btoa(`${account_sid}:${auth_token}`);

      // Format phone number
      let formattedPhone = cleanPhone;
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }
      const toNumber = `whatsapp:+${formattedPhone}`;

      console.log(`[Clinic ${clinicId}] Sending via Twilio to ${toNumber}`);

      const params = new URLSearchParams();
      params.append('To', toNumber);
      params.append('From', phone_number);
      params.append('Body', message);
      
      // Add image if available
      if (logoUrl && logoUrl !== DEFAULT_SYSTEM_LOGO) {
        params.append('MediaUrl', logoUrl);
      }

      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      const twilioResult = await twilioResponse.json();

      if (!twilioResponse.ok) {
        console.error('[Twilio] Send failed:', twilioResult);
        return new Response(
          JSON.stringify({ success: false, error: twilioResult.message || 'Erro ao enviar via Twilio' }),
          { status: twilioResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Twilio] Message sent successfully: ${twilioResult.sid}`);

      // Log message
      await supabase.from('message_logs').insert({
        clinic_id: clinicId,
        message_type: type,
        phone: formattedPhone,
        month_year: monthYear,
      });

      return new Response(
        JSON.stringify({ success: true, data: twilioResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== EVOLUTION API PROVIDER (default) ==========
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching evolution config:', configError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao buscar configuração da Evolution API' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!evolutionConfig) {
      console.log(`No Evolution API configured for clinic ${clinicId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não configurado. Configure a Evolution API em Configurações > Integrações.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { api_url, api_key, instance_name } = evolutionConfig as EvolutionConfig;

    // 10. CHECK REAL CONNECTION STATUS with Evolution API
    console.log(`[Clinic ${clinicId}] Checking real connection status for instance ${instance_name}`);
    
    let reallyConnected = false;
    try {
      const stateUrl = `${api_url}/instance/connectionState/${instance_name}`;
      const stateResponse = await fetch(stateUrl, {
        method: 'GET',
        headers: {
          'apikey': api_key,
        },
      });

      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        console.log(`[Clinic ${clinicId}] Evolution state response:`, JSON.stringify(stateData));
        
        // Check various possible response formats from Evolution API
        reallyConnected = 
          stateData?.instance?.state === "open" ||
          stateData?.state === "open" ||
          stateData?.status === "CONNECTED" ||
          stateData?.instance?.status === "CONNECTED";
      } else {
        console.error(`[Clinic ${clinicId}] Failed to check Evolution state: ${stateResponse.status}`);
      }
    } catch (stateError) {
      console.error(`[Clinic ${clinicId}] Error checking Evolution connection state:`, stateError);
    }

    // 11. Update database if status differs
    if (reallyConnected !== evolutionConfig.is_connected) {
      console.log(`[Clinic ${clinicId}] Updating connection status: ${evolutionConfig.is_connected} -> ${reallyConnected}`);
      await supabase
        .from('evolution_configs')
        .update({ 
          is_connected: reallyConnected,
          connected_at: reallyConnected ? new Date().toISOString() : null,
          phone_number: reallyConnected ? evolutionConfig.is_connected : null,
        })
        .eq('clinic_id', clinicId);
    }

    // 12. If not really connected, return specific error
    if (!reallyConnected) {
      console.log(`[Clinic ${clinicId}] WhatsApp not really connected`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp desconectado. Escaneie o QR Code novamente em Configurações > Integrações > WhatsApp.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove non-digits and add country code if needed)
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }
    
    // Add missing 9 for mobile numbers (Brazilian mobiles have 9 after DDD)
    // Pattern: 55 + DDD(2) + 9 + number(8) = 13 digits
    // If we have 12 digits (55 + DDD + 8 digits), add the 9
    if (formattedPhone.length === 12) {
      const countryCode = formattedPhone.substring(0, 2); // 55
      const ddd = formattedPhone.substring(2, 4); // 73, 71, etc.
      const number = formattedPhone.substring(4); // 88633535
      // Check if it looks like a mobile (starts with 8 or 9 after adding the 9)
      if (number.startsWith('8') || number.startsWith('9')) {
        formattedPhone = `${countryCode}${ddd}9${number}`;
        console.log(`[Clinic ${clinicId}] Added missing 9 to mobile number: ${formattedPhone}`);
      }
    }

    console.log(`[Clinic ${clinicId}] User ${user.id} sending WhatsApp message to ${formattedPhone} via instance ${instance_name} with logo`);

    // Envia mensagem com imagem (logo) no cabeçalho
    const response = await fetch(`${api_url}/message/sendMedia/${instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: 'image',
        media: logoUrl,
        caption: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Evolution API error:', result);
      
      // Check if error indicates disconnection
      const errorMessage = result?.message || result?.error || '';
      if (
        errorMessage.includes('disconnected') || 
        errorMessage.includes('not connected') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('QR')
      ) {
        // Update database to reflect disconnection
        await supabase
          .from('evolution_configs')
          .update({ 
            is_connected: false,
            connected_at: null,
          })
          .eq('clinic_id', clinicId);
          
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'WhatsApp desconectado. Escaneie o QR Code novamente em Configurações > Integrações.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: result.message || 'Erro ao enviar mensagem' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 13. Log message sent successfully
    console.log(`[Clinic ${clinicId}] Message sent successfully by user ${user.id}, logging to message_logs`);
    const { error: logError } = await supabase
      .from('message_logs')
      .insert({
        clinic_id: clinicId,
        message_type: type,
        phone: formattedPhone,
        month_year: monthYear
      });

    if (logError) {
      console.error('[send-whatsapp] Error logging message:', logError);
      // Don't fail the request, just log the error
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error sending WhatsApp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
