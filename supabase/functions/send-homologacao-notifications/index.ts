import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

async function sendWhatsAppWithImage(
  config: EvolutionConfig,
  phone: string,
  imageUrl: string,
  caption: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }
    // Fix Brazilian mobile: add 9 after DDD if missing
    if (formattedPhone.length === 12 && formattedPhone.startsWith('55')) {
      const ddd = formattedPhone.substring(2, 4);
      const number = formattedPhone.substring(4);
      if (!number.startsWith('9')) {
        formattedPhone = `55${ddd}9${number}`;
      }
    }

    console.log(`Sending WhatsApp with image to ${formattedPhone}`);

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp with image:', error);
    return false;
  }
}

function formatConfirmationMessage(
  type: 'company' | 'manager' | 'professional',
  data: {
    protocolNumber: string;
    companyName: string;
    employeeName: string;
    appointmentDate: string;
    startTime: string;
    professionalName: string;
    address: string;
    protocolLink: string;
    clinicName: string;
    createdAt: string;
  }
): string {
  const { protocolNumber, companyName, employeeName, appointmentDate, startTime, professionalName, address, protocolLink, clinicName, createdAt } = data;

  if (type === 'company') {
    return [
      `✅ *Agendamento Confirmado - Homologação*`,
      ``,
      `📋 *Protocolo:* ${protocolNumber}`,
      ``,
      `🏢 *Empresa:* ${companyName}`,
      `👤 *Funcionário:* ${employeeName}`,
      ``,
      `📅 *Data:* ${appointmentDate}`,
      `🕐 *Horário:* ${startTime}`,
      `👨‍⚖️ *Profissional:* ${professionalName}`,
      `📍 *Local:* ${address}`,
      ``,
      `📄 Acesse o protocolo: ${protocolLink}`,
      ``,
      `_HomologaNet - ${clinicName}_`,
    ].join('\n');
  }

  if (type === 'manager') {
    return [
      `🔔 *Novo Agendamento de Homologação*`,
      ``,
      `📋 *Protocolo:* ${protocolNumber}`,
      `🏢 *Empresa:* ${companyName}`,
      `👤 *Funcionário:* ${employeeName}`,
      `📅 *Data:* ${appointmentDate} às ${startTime}`,
      `👨‍⚖️ *Profissional:* ${professionalName}`,
      ``,
      `_Agendado em ${createdAt}_`,
    ].join('\n');
  }

  // professional
  return [
    `📅 *Nova Homologação Agendada*`,
    ``,
    `📋 *Protocolo:* ${protocolNumber}`,
    `🏢 *Empresa:* ${companyName}`,
    `👤 *Funcionário:* ${employeeName}`,
    `📅 *Data:* ${appointmentDate} às ${startTime}`,
    ``,
    `📄 Protocolo: ${protocolLink}`,
  ].join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointment_id } = await req.json();

    if (!appointment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'appointment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing notification for appointment: ${appointment_id}`);

    // Fetch appointment with related data
    const { data: appointment, error: appointmentError } = await supabase
      .from('homologacao_appointments')
      .select(`
        *,
        professional:homologacao_professionals(name, phone, email, address, city, state_code, clinic_id),
        service_type:homologacao_service_types(name)
      `)
      .eq('id', appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error('Error fetching appointment:', appointmentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clinicId = appointment.clinic_id;

    // Fetch clinic info
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, logo_url, whatsapp_header_image_url, slug')
      .eq('id', clinicId)
      .single();

    // Fetch homologacao settings
    const { data: settings } = await supabase
      .from('homologacao_settings')
      .select('manager_whatsapp, display_name, logo_url')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    // Fetch Evolution API config
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (!evolutionConfig || !evolutionConfig.is_connected) {
      console.log('No connected WhatsApp for this clinic');
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://eclini.lovable.app';
    const logoUrl = settings?.logo_url || clinic?.whatsapp_header_image_url || clinic?.logo_url || 'https://eclini.lovable.app/eclini-whatsapp-header.jpg';

    // Format appointment date
    const appointmentDateObj = new Date(appointment.appointment_date + 'T12:00:00');
    const appointmentDate = appointmentDateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const createdAtFormatted = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const professional = appointment.professional as any;
    const address = [
      professional?.address,
      professional?.city,
      professional?.state_code
    ].filter(Boolean).join(', ') || 'Endereço não informado';

    const protocolLink = appointment.public_token 
      ? `${baseUrl}/protocolo/${appointment.public_token}`
      : `${baseUrl}/protocolo/${appointment.id}`;

    const messageData = {
      protocolNumber: appointment.protocol_number || 'Não gerado',
      companyName: appointment.company_name || 'Não informado',
      employeeName: appointment.employee_name || 'Não informado',
      appointmentDate,
      startTime: appointment.start_time?.substring(0, 5) || '',
      professionalName: professional?.name || 'Profissional',
      address,
      protocolLink,
      clinicName: settings?.display_name || clinic?.name || 'HomologaNet',
      createdAt: createdAtFormatted,
    };

    const results = {
      company: false,
      manager: false,
      professional: false,
    };

    // 1. Send to Company
    if (appointment.company_phone) {
      const companyMessage = formatConfirmationMessage('company', messageData);
      results.company = await sendWhatsAppWithImage(
        evolutionConfig as EvolutionConfig,
        appointment.company_phone,
        logoUrl,
        companyMessage
      );
      console.log(`Company notification: ${results.company ? '✓' : '✗'}`);
    }

    // 2. Send to Manager
    if (settings?.manager_whatsapp) {
      const managerMessage = formatConfirmationMessage('manager', messageData);
      results.manager = await sendWhatsAppWithImage(
        evolutionConfig as EvolutionConfig,
        settings.manager_whatsapp,
        logoUrl,
        managerMessage
      );
      console.log(`Manager notification: ${results.manager ? '✓' : '✗'}`);
    }

    // 3. Send to Professional
    if (professional?.phone) {
      const professionalMessage = formatConfirmationMessage('professional', messageData);
      results.professional = await sendWhatsAppWithImage(
        evolutionConfig as EvolutionConfig,
        professional.phone,
        logoUrl,
        professionalMessage
      );
      console.log(`Professional notification: ${results.professional ? '✓' : '✗'}`);
    }

    // Update appointment with notification status
    const notificationStatus = Object.values(results).some(r => r) ? 'success' : 'error';
    await supabase
      .from('homologacao_appointments')
      .update({
        notification_sent_at: new Date().toISOString(),
        notification_status: notificationStatus,
      })
      .eq('id', appointment_id);

    // Log messages
    const monthYear = new Date().toISOString().slice(0, 7);
    const messageLogs = [];
    
    if (results.company && appointment.company_phone) {
      messageLogs.push({
        clinic_id: clinicId,
        message_type: 'homologacao_confirmation',
        phone: appointment.company_phone.replace(/\D/g, ''),
        month_year: monthYear,
      });
    }
    if (results.manager && settings?.manager_whatsapp) {
      messageLogs.push({
        clinic_id: clinicId,
        message_type: 'homologacao_notification',
        phone: settings.manager_whatsapp.replace(/\D/g, ''),
        month_year: monthYear,
      });
    }
    if (results.professional && professional?.phone) {
      messageLogs.push({
        clinic_id: clinicId,
        message_type: 'homologacao_notification',
        phone: professional.phone.replace(/\D/g, ''),
        month_year: monthYear,
      });
    }

    if (messageLogs.length > 0) {
      await supabase.from('message_logs').insert(messageLogs);
    }

    console.log('Notification results:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-homologacao-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
