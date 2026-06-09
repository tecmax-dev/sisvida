import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { blockedByOptOut } from "../_shared/opt-out.ts";
import { blockedByWindow } from "../_shared/session-window.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Logo padrão do sistema ProSindWeb para cabeçalho de mensagens WhatsApp
const DEFAULT_SYSTEM_LOGO = 'https://prosindweb.com.br/prosindweb-whatsapp-header.jpg';

interface WhatsAppRequest {
  phone: string;
  message: string;
  clinicId: string;
  type?: 'reminder' | 'confirmation' | 'custom' | 'document' | 'reminder_direct_reply';
  imageUrl?: string; // URL da imagem para enviar como cabeçalho
  appointmentId?: string;
  sendAsTextOnly?: boolean;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: any[];
}

 interface EvolutionConfig {
   api_url: string;
   api_key: string;
   instance_name: string;
   is_connected: boolean;
   direct_reply_enabled?: boolean | null;
   zapi_token?: string;
   instance_id?: string;
 }

function getWhazingSendUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.includes('/api/external/') || cleanBase.endsWith('/apioficial')) {
    return cleanBase;
  }
  return `${cleanBase}/apioficial`;
}

function getWhazingApiPlusUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.endsWith('/apioficial')) return cleanBase;
  if (cleanBase.includes('/api/external/')) {
    return `${cleanBase}/apioficial`;
  }
  return `${cleanBase}/apioficial`;
}

function buildWhazingTextPayload(baseUrl: string, phone: string, message: string): Record<string, unknown> {
  if (baseUrl.includes('/api/external/')) {
    return { number: phone, body: message };
  }

  return {
    number: phone,
    contents: {
      type: 'chat',
      body: { text: message },
    },
  };
}

function isChatgooExternalUrl(baseUrl: string): boolean {
  return baseUrl.includes('/api/external/');
}

function buildWhazingExternalButtonPayload(phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Record<string, unknown> {
  return {
    number: phone,
    body: bodyText,
    buttons: buttons.map(b => ({ id: b.id, title: b.title })),
  };
}

async function sendViaWhazingTextFallback(phone: string, message: string): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    return { success: false, error: 'Whazing not configured' };
  }

  try {
    let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    const response = await fetch(getWhazingSendUrl(whazingUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify(buildWhazingTextPayload(whazingUrl, cleanPhone, message)),
    });

    const responseText = await response.text();
    let parsed: unknown = responseText;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = responseText;
    }

    if (!response.ok) {
      return { success: false, error: `Whazing fallback returned ${response.status}`, data: parsed };
    }

    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function responseIndicatesDeliveryFailure(payload: any): string | null {
  const status = String(payload?.status || payload?.data?.status || payload?.message?.status || '').toUpperCase();
  const errorText = String(
    payload?.error || payload?.message || payload?.response?.message || payload?.data?.message || ''
  );

  if (status === 'ERROR' || status === 'FAILED') {
    return errorText || 'Falha reportada pela API do WhatsApp';
  }

  return null;
}

const PROFESSIONALS_RODOVIARIOS_LOCATION = ['marcelo aguiar', 'jorge avelar', 'pedro roberto'];

function isRodoviariosProfessional(professionalName: string): boolean {
  const lowerName = String(professionalName || '').toLowerCase();
  return PROFESSIONALS_RODOVIARIOS_LOCATION.some(name => lowerName.includes(name));
}

function getRodoviariosTemplateLocation(): string {
  return 'Av. Antonio Carlos Magalhães, 1062, Bairro Malhado — Sede do Sindicato dos Rodoviários, ao lado da Igreja Testemunhas de Jeová';
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
}

function getComparableBrazilianPhones(rawPhone: string): string[] {
  let digits = normalizePhoneDigits(rawPhone);

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  const localVariants = new Set<string>([digits]);

  // 10 dígitos (DDD + 8) → pode faltar o 9
  if (digits.length === 10) {
    localVariants.add(`${digits.slice(0, 2)}9${digits.slice(2)}`);
  }

  // 11 dígitos (DDD + 9 + 8) → variante sem o 9
  if (digits.length === 11 && digits[2] === '9') {
    localVariants.add(`${digits.slice(0, 2)}${digits.slice(3)}`);
  }

  const withCountryCode = [...localVariants].map((variant) => `55${variant}`);
  return [...new Set([...localVariants, ...withCountryCode])];
}

function phonesEquivalent(a: string, b: string): boolean {
  const aVariants = new Set(getComparableBrazilianPhones(a));
  return getComparableBrazilianPhones(b).some((variant) => aVariants.has(variant));
}

function stripWhatsAppRiskyEmojis(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function resolveReminderAppointmentId(
  supabase: any,
  clinicId: string,
  phone: string,
  message: string,
): Promise<string | undefined> {
  // 1) Tenta extrair token do link de confirmação (modo antigo)
  const tokenMatch = message.match(/\/consulta\/([a-zA-Z0-9_-]+)/);
  const confirmationToken = tokenMatch?.[1];

  if (confirmationToken) {
    const { data: byToken, error: byTokenError } = await supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('confirmation_token', confirmationToken)
      .maybeSingle();
    const typedByToken = byToken as { id?: string } | null;

    if (byTokenError) {
      console.error('[send-whatsapp] Error resolving appointment by confirmation token:', byTokenError);
    }

    if (typedByToken?.id) {
      return typedByToken.id;
    }
  }

  // 2) Fallback: próxima consulta agendada/confirmada do mesmo telefone
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingAppointments, error: upcomingError } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      start_time,
      patient:patients!inner(phone)
    `)
    .eq('clinic_id', clinicId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(250);

  if (upcomingError) {
    console.error('[send-whatsapp] Error resolving appointment by phone:', upcomingError);
    return undefined;
  }

  const typedUpcomingAppointments = (upcomingAppointments || []) as Array<{
    id?: string;
    patient?: { phone?: string } | Array<{ phone?: string }>;
  }>;

  const matchedAppointment = typedUpcomingAppointments.find((appointment) => {
    const patientData = appointment?.patient;
    const patientPhone = Array.isArray(patientData)
      ? patientData[0]?.phone
      : patientData?.phone;

    return typeof patientPhone === 'string' && phonesEquivalent(phone, patientPhone);
  });

  return matchedAppointment?.id;
}

async function sendWhazingConfirmationButtons(
  phone: string,
  appointmentId: string
): Promise<{ success: boolean; error?: string; response?: string }> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    return { success: false, error: 'Whazing not configured' };
  }

  try {
    let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    const buttons = [
      { id: `confirm_apt_${appointmentId}`, title: "Confirmar" },
      { id: `cancel_apt_${appointmentId}`, title: "Cancelar" },
    ];

    // Vary the prompt text to avoid identical messages (anti-ban)
    const buttonPrompts = [
      "Confirme ou cancele sua consulta:",
      "Por favor, confirme ou cancele:",
      "Toque abaixo para confirmar ou cancelar:",
      "Você poderá confirmar ou cancelar abaixo:",
      "Selecione uma opção abaixo:",
      "Confirme sua presença ou cancele:",
      "Escolha uma das opções:",
      "Use os botões abaixo para responder:",
      "Para responder, toque em uma opção:",
      "Confirme já sua consulta:",
    ];
    const buttonPromptText = buttonPrompts[Math.floor(Math.random() * buttonPrompts.length)];

    const payload: Record<string, unknown> = {
      number: cleanPhone,
      contents: {
        type: "button",
        body: { text: buttonPromptText },
        action: {
          buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })),
        },
      },
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${whazingToken}`,
    };

    const apiOficialUrl = getWhazingApiPlusUrl(whazingUrl);
    console.log(`[send-whatsapp] Sending reminder buttons to ${cleanPhone} via API PLUS/native buttons (appointment: ${appointmentId})`);

    let response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    let responseText = await response.text();
    if (!response.ok && isChatgooExternalUrl(whazingUrl)) {
      console.warn(`[send-whatsapp] API PLUS failed (${response.status}); retrying external endpoint: ${responseText.substring(0, 300)}`);
      response = await fetch(getWhazingSendUrl(whazingUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(buildWhazingExternalButtonPayload(cleanPhone, buttonPromptText, buttons)),
      });
      responseText = await response.text();
    }

    if (!response.ok) {
      return { success: false, error: `${response.status}: ${responseText}`, response: responseText };
    }

    return { success: true, response: responseText };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function sendMetaText(phone: string, text: string): Promise<boolean> {
  try {
    const PHONE_ID = Deno.env.get('META_PHONE_NUMBER_ID');
    const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    if (!PHONE_ID || !TOKEN) {
      console.error('[meta-text] Missing META_PHONE_NUMBER_ID or META_WHATSAPP_TOKEN');
      return false;
    }
    const digits = phone.replace(/\D/g, '');
    const to = digits.startsWith('55') ? digits : `55${digits}`;
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );
    if (!r.ok) {
      console.error('[meta-text] Meta error:', await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[meta-text] Exception:', e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // 2. Verify identity - support both user JWT and service role key (internal calls)
    const token = authHeader.replace("Bearer ", "").trim();
    const isServiceRoleCall = token === supabaseServiceKey;

    let userId: string;

    if (isServiceRoleCall) {
      // Trusted internal call (e.g. from send-signature-whatsapp)
      console.log('[send-whatsapp] Service role call - skipping user auth');
      userId = "service-role";
    } else {
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
      userId = user.id;
    }

    // 3. Parse and log request body
    const bodyText = await req.text();
    console.log(`[send-whatsapp] Request Body: ${bodyText}`);
    
    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      console.error('[send-whatsapp] Failed to parse body:', e);
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
    }

    const { phone, message, clinicId, type = 'custom', imageUrl, appointmentId, sendAsTextOnly = false } = body as WhatsAppRequest;
    
    // Extract template info (destructuring explicitly to be safe)
    let { templateName, templateLanguage, templateComponents } = body;

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

    const isReminder = type === 'reminder' || type === 'reminder_direct_reply';
    const safeMessage = isReminder ? stripWhatsAppRiskyEmojis(message) : message;

    // 6. Create service role client for RPC call
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 7. Verify user has access to this clinic (skip for service role calls)
    if (!isServiceRoleCall) {
      const { data: hasAccess, error: accessError } = await supabase.rpc('has_clinic_access', {
        _user_id: userId,
        _clinic_id: clinicId
      });

      // Super-admin bypass (admin panel can message any clinic)
      let isSuperAdmin = false;
      if (!accessError && !hasAccess) {
        const { data: superAdminRow, error: superAdminError } = await supabase
          .from('super_admins')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (superAdminError) {
          console.error('[send-whatsapp] Error checking super admin:', superAdminError);
        }
        isSuperAdmin = !!superAdminRow;
      }

      if (accessError || (!hasAccess && !isSuperAdmin)) {
        console.error(`[send-whatsapp] User ${userId} denied access to clinic ${clinicId}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso negado a esta clínica' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (isSuperAdmin) {
        console.log(`[send-whatsapp] Super admin override for clinic ${clinicId}`);
      }
    } // end permission check

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
       .select('whatsapp_provider, logo_url, whatsapp_header_image_url, phone')
       .eq('id', clinicId)
       .single();

    // 9.1 Check for union entity logo (takes priority for sindicatos)
    let unionLogo: string | null = null;
    const { data: unionEntity } = await supabase
      .from('union_entities')
      .select('logo_url')
      .eq('clinic_id', clinicId)
      .eq('status', 'ativa')
      .maybeSingle();
    
    if (unionEntity?.logo_url) {
      unionLogo = unionEntity.logo_url;
      console.log(`[Clinic ${clinicId}] Using union entity logo: ${unionLogo}`);
    }

    // For Sindicato SECMI, force Meta Official. For others, use clinic config or default to evolution.
    const isSindicato = clinicId === "89e7585e-7bce-4e58-91fa-c37080d1170d";
    const whatsappProvider = isSindicato ? 'meta_official' : (clinicProviderData?.whatsapp_provider || 'evolution');
    const isMetaOfficial = whatsappProvider === 'zapresponder' || whatsappProvider === 'meta_official';

    // Force text-only for appointment reminders to reduce risk of WhatsApp ban
    // (sending media via unofficial APIs increases ban risk)
    const shouldUseTextOnly = sendAsTextOnly === true || isReminder;
    // Priority: explicit imageUrl > whatsapp_header_image_url > union_entity logo > clinic logo > default
    const logoUrl = shouldUseTextOnly
      ? null
      : imageUrl || clinicProviderData?.whatsapp_header_image_url || unionLogo || clinicProviderData?.logo_url || DEFAULT_SYSTEM_LOGO;

    console.log(`[Clinic ${clinicId}] Using WhatsApp provider: ${whatsappProvider}, textOnly: ${shouldUseTextOnly}, logo: ${logoUrl || 'NONE'}`);

    // ========== META OFFICIAL / ZAP RESPONDER PROVIDER ==========
    if (isMetaOfficial) {
      if (isSindicato) {
        // Robust fallback: if it's a reminder for Sindicato, force use of the template
        const isReminderRequest = type === 'reminder' || type === 'reminder_direct_reply';
        if (isReminderRequest && !templateName) {
          console.log(`[Clinic ${clinicId}] Sindicato: Reminder detected without templateName. Forcing lembrete_consulta_v2.`);
          templateName = 'lembrete_consulta_v2';
          templateLanguage = 'pt_BR';
        }

        // API Oficial: para lembretes do Sindicato, o backend deve reconstruir as variáveis
        // pelo appointmentId e ignorar qualquer Local vindo da tela, pois o cliente pode enviar
        // o nome da clínica antigo em {{6}}.
        if (templateName === 'lembrete_consulta_v2' &&
            appointmentId) {
          try {
            const { data: apt } = await supabase
              .from('appointments')
              .select(`
                appointment_date, start_time, dependent_id,
                patient:patients!appointments_patient_id_fkey(name),
                dependent:patient_dependents!appointments_dependent_id_fkey(name),
                professional:professionals!appointments_professional_id_fkey(name, specialty)
              `)
              .eq('id', appointmentId)
              .single();
            if (apt) {
              const displayName = (apt.dependent_id && (apt as any).dependent?.name)
                ? (apt as any).dependent.name
                : ((apt as any).patient?.name || 'Associado');
              const profName = (apt as any).professional?.name || 'Profissional';
              const specialty = (apt as any).professional?.specialty || 'Consulta';
              const dateObj = new Date(apt.appointment_date + 'T12:00:00');
              const dateFormatted = dateObj.toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long'
              });
              const time = String(apt.start_time).slice(0, 5);
              const location = isRodoviariosProfessional(profName)
                ? getRodoviariosTemplateLocation()
                : 'Sindicato dos Comerciários';
              templateComponents = [displayName, profName, specialty, dateFormatted, time, location];
              console.log(`[Clinic ${clinicId}] Sindicato: Built template components from DB:`, templateComponents);
            }
          } catch (e) {
            console.error('[Clinic Sindicato] Error fetching appointment for template:', e);
          }
        }
        if (templateName === 'lembrete_consulta_v2' &&
            Array.isArray(templateComponents) &&
            templateComponents.length === 6 &&
            isRodoviariosProfessional(String(templateComponents[1] || ''))) {
          templateComponents = [...templateComponents];
          templateComponents[5] = getRodoviariosTemplateLocation();
          console.log(`[Clinic ${clinicId}] Sindicato: Forced Rodoviários location in template components:`, templateComponents);
        }
        if (templateName === 'lembrete_consulta_v2' &&
            (!templateComponents || templateComponents.length !== 6)) {
          templateComponents = ["Paciente", "Profissional", "Consulta", "Data", "Horário", "Sindicato dos Comerciários"];
        }

        let metaSuccess = false;
        if (templateName) {
          console.log(`[Clinic ${clinicId}] Sindicato: Routing template ${templateName} to meta-send-template`);
          try {
            const templateResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-send-template`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                to: cleanPhone,
                template_name: templateName,
                language: templateLanguage || 'pt_BR',
                variables: templateComponents || []
              }),
            });
            const templateResult = await templateResp.json();
            if (templateResp.ok) {
              await supabase.from('message_logs').insert({
                clinic_id: clinicId,
                message_type: type,
                phone: cleanPhone,
                month_year: monthYear,
              });
              return new Response(
                JSON.stringify({ success: true, method: 'meta_template_direct', data: templateResult }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            console.error('[Meta Template Direct] Error:', templateResult);
          } catch (tplErr) {
            console.error('[Meta Template Direct] Exception:', tplErr);
          }
        } else {
          console.log(`[Clinic ${clinicId}] Sindicato: Sending direct text via Meta Graph API to ${cleanPhone}`);
          metaSuccess = await sendMetaText(cleanPhone, safeMessage);
          if (metaSuccess) {
            await supabase.from('message_logs').insert({
              clinic_id: clinicId,
              message_type: type,
              phone: cleanPhone,
              month_year: monthYear,
            });
            return new Response(
              JSON.stringify({ success: true, method: 'meta_direct' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        console.warn(`[Clinic ${clinicId}] Sindicato: Meta official delivery failed.`);
        // We return failure for Sindicato if Meta official fails, as per user request to NOT use evolution.
        return new Response(
          JSON.stringify({ success: false, error: 'Falha no envio via Meta API Oficial' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Clinic ${clinicId}] Sending via Zap Responder wrapper to ${cleanPhone}`);
      
      // We call our internal send-whatsapp-zapresponder function
      // passing the necessary credentials and data
      try {
        const zapResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-zapresponder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            phone: cleanPhone,
            message: safeMessage,
            clinicId: clinicId,
            // Optionally pass template info if it was provided in the original request
            templateName: body.templateName,
            templateLanguage: body.templateLanguage,
            templateComponents: body.templateComponents
          }),
        });

        const zapResult = await zapResponse.json();

        if (zapResponse.ok) {
          console.log(`[Zap Responder] Message sent successfully`);
          // Log message
          await supabase.from('message_logs').insert({
            clinic_id: clinicId,
            message_type: type,
            phone: cleanPhone,
            month_year: monthYear,
          });

          return new Response(
            JSON.stringify({ success: true, data: zapResult.data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('[Zap Responder] Send failed:', zapResult);
          console.warn(`[Clinic ${clinicId}] Zap Responder failed. Fallback to Evolution if configured.`);
        }
      } catch (zapError) {
        console.error('[Zap Responder] Request error:', zapError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro de comunicação com Zap Responder' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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
      params.append('Body', safeMessage);
      
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

     // ========== EVOLUTION / Z-API PROVIDER ==========
     const { data: evolutionConfig, error: configError } = await supabase
       .from('evolution_configs')
       .select('api_url, api_key, instance_name, is_connected, direct_reply_enabled, zapi_token, instance_id')
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

    const { api_url, api_key, instance_name, direct_reply_enabled } = evolutionConfig as EvolutionConfig;


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

    console.log(`[Clinic ${clinicId}] User ${userId} sending WhatsApp message to ${formattedPhone} via instance ${instance_name}${shouldUseTextOnly ? ' as text-only' : ' with logo'}`);

    // Resolve canonical WhatsApp JID via Evolution to handle BR mobiles
    // where the real account is registered without the extra "9" (or vice-versa).
    // This prevents silent delivery ERRORs (status=ERROR) when sending to a
    // non-existent variant of the number.
    let numberExistsOnWhatsApp: boolean | null = null;
    try {
      const lookupResp = await fetch(`${api_url}/chat/whatsappNumbers/${instance_name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: api_key },
        body: JSON.stringify({ numbers: [formattedPhone] }),
      });
      if (lookupResp.ok) {
        const lookupData = await lookupResp.json();
        const entry = Array.isArray(lookupData) ? lookupData[0] : null;
        if (entry?.exists && entry?.jid) {
          numberExistsOnWhatsApp = true;
          const canonical = String(entry.jid).split('@')[0].replace(/\D/g, '');
          if (canonical && canonical !== formattedPhone) {
            console.log(`[Clinic ${clinicId}] Canonical JID differs: ${formattedPhone} -> ${canonical}`);
            formattedPhone = canonical;
          }
        } else {
          numberExistsOnWhatsApp = false;
          console.warn(`[Clinic ${clinicId}] Number ${formattedPhone} not found on WhatsApp via lookup`);
        }
      } else {
        await lookupResp.text();
        console.warn(`[Clinic ${clinicId}] WhatsApp number lookup failed: ${lookupResp.status}`);
      }
    } catch (lookupErr) {
      console.warn(`[Clinic ${clinicId}] WhatsApp number lookup error:`, lookupErr);
    }

    // CRITICAL: If lookup definitively says the number is NOT on WhatsApp, abort.
    // Sending anyway results in a silent ERROR via webhook (messages.update),
    // and the frontend wrongly thinks the message was delivered.
    if (numberExistsOnWhatsApp === false) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `O número ${formattedPhone} não possui WhatsApp ativo. Verifique se o número está correto e cadastrado no WhatsApp.`,
          code: 'NUMBER_NOT_ON_WHATSAPP',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionEndpoint = shouldUseTextOnly
      ? `${api_url}/message/sendText/${instance_name}`
      : `${api_url}/message/sendMedia/${instance_name}`;

    const evolutionPayload = shouldUseTextOnly
      ? {
          number: formattedPhone,
          text: safeMessage,
        }
      : {
          number: formattedPhone,
          mediatype: 'image',
          media: logoUrl,
          caption: safeMessage,
        };

    const response = await fetch(evolutionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_key,
      },
      body: JSON.stringify(evolutionPayload),
    });

    const responseText = await response.text();
    let result: any = null;

    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      result = { raw: responseText };
    }

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

    const deliveryFailure = responseIndicatesDeliveryFailure(result);
    if (deliveryFailure) {
      console.error('[send-whatsapp] Delivery failure reported by Evolution:', result);

      if (shouldUseTextOnly) {
        const fallback = await sendViaWhazingTextFallback(formattedPhone, safeMessage);
        if (fallback.success) {
          console.log('[send-whatsapp] Text fallback via Whazing succeeded after Evolution delivery failure');
          result = {
            ...result,
            fallback: 'whazing_apioficial',
            fallbackResult: fallback.data,
          };
        } else {
          console.error('[send-whatsapp] Text fallback via Whazing failed:', fallback.error, fallback.data);
          return new Response(
            JSON.stringify({ success: false, error: deliveryFailure, details: result, fallbackError: fallback.error, fallbackDetails: fallback.data }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ success: false, error: deliveryFailure, details: result }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let buttonsResult: { attempted: boolean; success: boolean; error?: string } | null = null;

    const isReminderType = type === 'reminder' || type === 'reminder_direct_reply';
    let resolvedAppointmentId = appointmentId;

    if (isReminderType && !resolvedAppointmentId) {
      resolvedAppointmentId = await resolveReminderAppointmentId(
        supabase,
        clinicId,
        formattedPhone,
        safeMessage,
      );

      if (resolvedAppointmentId) {
        console.log(`[send-whatsapp] appointmentId resolved automatically: ${resolvedAppointmentId}`);
      }
    }

    const shouldSendReminderButtons = Boolean(
      resolvedAppointmentId && (
        type === 'reminder_direct_reply' ||
        (type === 'reminder' && direct_reply_enabled === true)
      )
    );

    if (isReminderType && !resolvedAppointmentId) {
      buttonsResult = { attempted: false, success: false, error: 'appointmentId not provided or not resolved' };
      console.warn('[send-whatsapp] Reminder without appointmentId. Buttons not sent.');
    } else if (shouldSendReminderButtons && resolvedAppointmentId) {
      // Send ONLY the interactive buttons via Whazing.
      // Do NOT resend the reminder text here — the main message was already
      // delivered above (Evolution or Whazing fallback). Resending the text
      // caused duplicate identical reminders (one with buttons, one without),
      // which can trigger WhatsApp to flag/ban the number for spam.
      await new Promise(resolve => setTimeout(resolve, 1500));
      const buttonsResponse = await sendWhazingConfirmationButtons(formattedPhone, resolvedAppointmentId);

      buttonsResult = {
        attempted: true,
        success: buttonsResponse.success,
        error: buttonsResponse.error,
      };

      if (!buttonsResponse.success) {
        console.error('[send-whatsapp] Failed to send reminder buttons:', buttonsResponse.error);
      } else {
        console.log(`[send-whatsapp] Reminder buttons sent for appointment ${resolvedAppointmentId}`);
      }
    }

    // 13. Log message sent successfully
    console.log(`[Clinic ${clinicId}] Message sent successfully by user ${userId}, logging to message_logs`);
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
      JSON.stringify({ success: true, data: result, buttons: buttonsResult }),
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
