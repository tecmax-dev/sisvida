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

    // 7. Verify user has access to this clinic
    const { data: hasAccess, error: accessError } = await supabase.rpc('has_clinic_access', {
      _user_id: user.id,
      _clinic_id: clinicId
    });

    if (accessError || !hasAccess) {
      console.error(`[send-whatsapp] User ${user.id} denied access to clinic ${clinicId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado a esta clínica' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // 9. Fetch clinic's Evolution API configuration and logo
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    // Fetch clinic logo
    const { data: clinicData } = await supabase
      .from('clinics')
      .select('logo_url')
      .eq('id', clinicId)
      .maybeSingle();

    const logoUrl = clinicData?.logo_url || DEFAULT_SYSTEM_LOGO;

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
