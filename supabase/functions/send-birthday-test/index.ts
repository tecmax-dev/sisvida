import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logo padrão do sistema Eclini para cabeçalho de mensagens WhatsApp
const DEFAULT_SYSTEM_LOGO = 'https://app.eclini.com.br/birthday-header.webp';

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

// Format birthday message with placeholders
function formatBirthdayMessage(template: string, patientName: string, clinicName: string): string {
  return template
    .replace(/{nome}/gi, patientName)
    .replace(/{clinica}/gi, clinicName)
    .replace(/{paciente}/gi, patientName);
}

async function sendWhatsAppWithImage(
  config: EvolutionConfig,
  phone: string,
  imageUrl: string,
  caption: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[TEST] Sending birthday WhatsApp with image to ${formattedPhone}`);
    console.log(`[TEST] Image URL: ${imageUrl}`);
    console.log(`[TEST] Caption: ${caption.substring(0, 50)}...`);

    const response = await fetch(`${config.api_url}/message/sendMedia/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: 'image',
        media: imageUrl,
        caption: caption,
      }),
    });

    const responseText = await response.text();
    console.log(`[TEST] Evolution API response status: ${response.status}`);
    console.log(`[TEST] Evolution API response body: ${responseText}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (!response.ok) {
      return { 
        success: false, 
        error: `API error ${response.status}: ${responseText}`,
        response: responseData 
      };
    }

    // Check if the response indicates success
    // Evolution API may return 200 but with error in body
    const msg = responseData?.message;
    const msgText = typeof msg === 'string' ? msg : (msg ? JSON.stringify(msg) : '');
    if (responseData?.error || (typeof msgText === 'string' && msgText.toLowerCase().includes('error'))) {
      return {
        success: false,
        error: responseData?.error || msgText || 'Unknown error',
        response: responseData,
      };
    }

    return { success: true, response: responseData };
  } catch (error) {
    console.error('[TEST] Error sending WhatsApp with image:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication (we validate manually; platform JWT verification is disabled)
    const rawAuthHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    console.log('[send-birthday-test] Authorization header present:', !!rawAuthHeader);

    if (!rawAuthHeader) {
      return new Response(
        JSON.stringify({ success: false, code: 401, error: 'Missing authorization header' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept both "Bearer <token>" and "<token>" (some clients pass raw JWT)
    const token = rawAuthHeader.toLowerCase().startsWith('bearer ')
      ? rawAuthHeader.slice(7).trim()
      : rawAuthHeader.trim();

    console.log('[send-birthday-test] Auth header is bearer:', rawAuthHeader.toLowerCase().startsWith('bearer '));
    console.log('[send-birthday-test] Token length:', token.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get user session (pass token explicitly to avoid relying on implicit header handling)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.log('[send-birthday-test] getUser error:', userError.message);
    }
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, code: 401, error: 'Sessão inválida' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { clinicId, testPhone } = await req.json();

    if (!clinicId || !testPhone) {
      return new Response(
        JSON.stringify({ success: false, code: 400, error: 'clinicId e testPhone são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user has access to clinic
    const { data: hasAccess } = await supabase.rpc('has_clinic_access', {
      _user_id: user.id,
      _clinic_id: clinicId
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ success: false, code: 403, error: 'Sem acesso a esta clínica' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service_role to bypass RLS for configs
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch clinic data using admin client
    const { data: clinic, error: clinicError } = await adminClient
      .from('clinics')
      .select('id, name, birthday_message, logo_url, whatsapp_header_image_url')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ success: false, code: 404, error: 'Clínica não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Evolution API config using admin client (bypasses RLS)
    const { data: evolutionConfig, error: configError } = await adminClient
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (configError || !evolutionConfig) {
      console.log('[send-birthday-test] Evolution config error:', configError?.message);
      return new Response(
        JSON.stringify({ success: false, code: 400, error: 'WhatsApp não configurado para esta clínica' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!evolutionConfig.is_connected) {
      return new Response(
        JSON.stringify({ success: false, code: 400, error: 'WhatsApp desconectado. Reconecte nas Configurações.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check message limit
    const monthYear = new Date().toISOString().slice(0, 7);
    const { data: usageData } = await supabase.rpc('get_clinic_message_usage', {
      _clinic_id: clinicId,
      _month_year: monthYear
    });

    const usage = usageData && usageData.length > 0 ? usageData[0] : null;
    if (usage && usage.max_allowed > 0 && usage.remaining <= 0) {
      return new Response(
        JSON.stringify({ success: false, code: 429, error: 'Limite mensal de mensagens atingido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar imagem personalizada da clínica, ou logo da clínica, ou imagem padrão do sistema
    const headerImageUrl = clinic.whatsapp_header_image_url || clinic.logo_url || DEFAULT_SYSTEM_LOGO;

    // Format message
    const defaultMessage = `Olá {nome}! 🎂🎉

A equipe da {clinica} deseja a você um feliz aniversário!

Que este dia seja repleto de alegrias e realizações.

Com carinho,
Equipe {clinica}`;

    const message = formatBirthdayMessage(
      clinic.birthday_message || defaultMessage,
      'Paciente Teste',
      clinic.name
    );

    console.log(`[TEST] Sending test birthday message to ${testPhone}`);
    console.log(`[TEST] Using header image: ${clinic.whatsapp_header_image_url ? 'custom' : clinic.logo_url ? 'logo' : 'system default'}`);

    // Send test message
    const result = await sendWhatsAppWithImage(
      evolutionConfig as EvolutionConfig,
      testPhone,
      headerImageUrl,
      message
    );

    if (result.success) {
      // NÃO registrar em message_logs (não consumir créditos do sistema)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Mensagem de teste enviada com sucesso!',
          details: result.response,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          code: 400,
          error: result.error || 'Falha ao enviar mensagem',
          details: result.response,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('[TEST] Error in send-birthday-test:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
      return new Response(
        JSON.stringify({ success: false, code: 500, error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});
