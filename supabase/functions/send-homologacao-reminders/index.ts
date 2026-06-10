import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SMTP configuration from secrets
const SMTP_HOST = Deno.env.get('SMTP_HOST');
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD');
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'noreply@prosindweb.com.br';

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

// Get Brazil time (UTC-3)
function getBrazilTime(): Date {
  const now = new Date();
  const utcTime = now.getTime();
  const brazilOffsetMs = -3 * 60 * 60 * 1000;
  return new Date(utcTime + brazilOffsetMs);
}

// Send email via SMTP
async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      console.error('SMTP not configured');
      return false;
    }

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASSWORD,
        },
      },
    });

    await client.send({
      from: SMTP_FROM,
      to,
      subject,
      html: htmlBody,
    });

    await client.close();
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Format reminder email HTML
function formatReminderEmailHtml(data: {
  employeeName: string;
  companyName: string;
  appointmentDate: string;
  startTime: string;
  professionalName: string;
  protocolNumber?: string;
  address: string;
  logoUrl: string;
  clinicName: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lembrete de Homologação</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: #1e3a8a; padding: 30px; text-align: center;">
              <img src="${data.logoUrl}" alt="${data.clinicName}" style="max-height: 60px; margin-bottom: 16px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                ⏰ Lembrete de Homologação
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Prezado(a),
              </p>
              <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                Este é um lembrete do seu agendamento de homologação para <strong>amanhã</strong>:
              </p>
              
              <!-- Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; width: 120px;">📋 Funcionário:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${data.employeeName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">🏢 Empresa:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${data.companyName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">📅 Data:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${data.appointmentDate}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">🕐 Horário:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${data.startTime}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">👤 Profissional:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600;">${data.professionalName}</td>
                      </tr>
                      ${data.protocolNumber ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">📝 Protocolo:</td>
                        <td style="color: #16a34a; font-size: 14px; font-weight: 600;">${data.protocolNumber}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Address -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  📍 <strong>Local:</strong><br>
                  ${data.address}
                </p>
              </div>
              
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Por favor, compareça no horário agendado com toda a documentação necessária.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Esta é uma mensagem automática enviada por ${data.clinicName}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendWhatsAppMessage(params: {
  provider: string;
  phone: string;
  message: string;
  clinicId: string;
  evolutionConfig?: EvolutionConfig | null;
  logoUrl?: string;
  templateName?: string;
  templateComponents?: string[];
  appointmentId?: string;
}): Promise<boolean> {
  const { provider, phone, message, clinicId, evolutionConfig, logoUrl, templateName, templateComponents, appointmentId } = params;
  const isMeta = provider === 'meta_official' || provider === 'zapresponder';

  if (isMeta) {
    try {
      console.log(`Sending via Meta to ${phone} using template ${templateName || 'NONE'}`);
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          phone,
          message,
          clinicId,
          type: 'reminder',
          templateName,
          templateComponents,
          appointmentId
        }),
      });
      const data = await response.json();
      return response.ok && data.success;
    } catch (error) {
      console.error('Error sending Meta WhatsApp:', error);
      return false;
    }
  }

  if (!evolutionConfig) return false;

  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;
    if (formattedPhone.length === 12 && formattedPhone.startsWith('55')) {
      const ddd = formattedPhone.substring(2, 4);
      const number = formattedPhone.substring(4);
      if (!number.startsWith('9')) formattedPhone = `55${ddd}9${number}`;
    }

    console.log(`Sending via Evolution to ${formattedPhone}`);
    const response = await fetch(`${evolutionConfig.api_url}/message/sendMedia/${evolutionConfig.instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.api_key },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: 'image',
        media: logoUrl,
        caption: message,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending Evolution WhatsApp:', error);
    return false;
  }
}

function formatReminderMessage(
  type: 'company' | 'manager' | 'professional',
  data: {
    protocolNumber: string;
    companyName: string;
    employeeName: string;
    appointmentDate: string;
    startTime: string;
    address: string;
    publicWhatsapp?: string;
    clinicName: string;
    serviceTypeName?: string;
  }
): string {
  const { protocolNumber, companyName, employeeName, appointmentDate, startTime, address, publicWhatsapp, clinicName, serviceTypeName } = data;

  const isJuridico = serviceTypeName?.toLowerCase().includes('jurídic') || serviceTypeName?.toLowerCase().includes('juridic') || serviceTypeName?.toLowerCase().includes('assessoria');
  const label = isJuridico ? 'Assessoria Jurídica' : 'Homologação';

  if (type === 'company') {
    const lines = [
      `⏰ *Lembrete - ${label} Amanhã*`,
      ``,
      `📋 *Protocolo:* ${protocolNumber}`,
      ...(isJuridico ? [] : [`🏢 *Empresa:* ${companyName}`]),
      `👤 *${isJuridico ? 'Nome' : 'Funcionário'}:* ${employeeName}`,
      `📅 *Data:* ${appointmentDate}`,
      `🕐 *Horário:* ${startTime}`,
      `📍 *Local:* ${address}`,
    ];
    
    if (publicWhatsapp) {
      lines.push(``, `Em caso de dúvidas: ${publicWhatsapp}`);
    }
    
    lines.push(``, `_${clinicName}_`);
    return lines.join('\n');
  }

  if (type === 'manager') {
    return [
      `⏰ *Lembrete - ${label} Amanhã*`,
      ``,
      `📋 *Protocolo:* ${protocolNumber}`,
      ...(isJuridico ? [] : [`🏢 *Empresa:* ${companyName}`]),
      `👤 *${isJuridico ? 'Nome' : 'Funcionário'}:* ${employeeName}`,
      `📅 *Data:* ${appointmentDate}`,
      `🕐 *Horário:* ${startTime}`,
    ].join('\n');
  }

  // professional
  return [
    `⏰ *Lembrete - ${label} Amanhã*`,
    ``,
    `📋 *Protocolo:* ${protocolNumber}`,
    ...(isJuridico ? [] : [`🏢 *Empresa:* ${companyName}`]),
    `👤 *${isJuridico ? 'Nome' : 'Funcionário'}:* ${employeeName}`,
    `📅 *Data:* ${appointmentDate}`,
    `🕐 *Horário:* ${startTime}`,
    `📍 *Local:* ${address}`,
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

    const now = getBrazilTime();
    console.log(`[Brasil] Starting homologacao reminder check at ${now.toISOString()}`);

    // Calculate target window: appointments 24 hours from now (+/- 30 min window)
    const reminderHours = 24;
    const targetStart = new Date(now.getTime() + reminderHours * 60 * 60 * 1000 - 30 * 60 * 1000);
    const targetEnd = new Date(now.getTime() + reminderHours * 60 * 60 * 1000 + 30 * 60 * 1000);

    const targetDate = targetStart.toISOString().split('T')[0];
    const targetStartTime = targetStart.toTimeString().substring(0, 5);
    const targetEndTime = targetEnd.toTimeString().substring(0, 5);
    
    // Format target date in Brazilian format for the message
    const targetDateFormatted = targetStart.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    console.log(`Looking for appointments on ${targetDate} between ${targetStartTime} and ${targetEndTime}`);

    // Get all active clinics with Evolution API connected (including union entity logo)
    const { data: clinics } = await supabase
      .from('clinics')
      .select(`
        id, name, logo_url, whatsapp_header_image_url, whatsapp_provider, reminder_interval,
        union_entities!union_entities_clinic_id_fkey(logo_url)
      `);

    let sentCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const clinic of clinics || []) {
      const whatsappProvider = clinic.whatsapp_provider || 'evolution';
      const isMetaProvider = whatsappProvider === 'meta_official' || whatsappProvider === 'zapresponder';

      let evolutionConfig = null;
      if (!isMetaProvider) {
        const { data: evoConfig } = await supabase
          .from('evolution_configs')
          .select('api_url, api_key, instance_name, is_connected')
          .eq('clinic_id', clinic.id)
          .maybeSingle();

        if (!evoConfig || !evoConfig.is_connected) {
          skippedCount++;
          continue;
        }
        evolutionConfig = evoConfig;
      }

      // Fetch homologacao settings
      const { data: settings } = await supabase
        .from('homologacao_settings')
        .select('manager_whatsapp, public_whatsapp, display_name, logo_url')
        .eq('clinic_id', clinic.id)
        .maybeSingle();

// Prioridade: 1) Logo das settings, 2) Logo da union entity, 3) Header WhatsApp, 4) Logo da clínica, 5) Default
      const unionEntity = (clinic as any).union_entities?.[0];
      const logoUrl = settings?.logo_url || unionEntity?.logo_url || clinic.whatsapp_header_image_url || clinic.logo_url || 'https://prosindweb.com.br/prosindweb-whatsapp-header.jpg';

      // Get appointments in target window that haven't received reminders
      const { data: appointments, error } = await supabase
        .from('homologacao_appointments')
        .select(`
          *,
          professional:homologacao_professionals(name, phone, address, city, state_code),
          service_type:homologacao_service_types(name)
        `)
        .eq('clinic_id', clinic.id)
        .eq('appointment_date', targetDate)
        .gte('start_time', targetStartTime)
        .lte('start_time', targetEndTime)
        .in('status', ['scheduled', 'confirmed'])
        .is('reminder_sent_at', null);

      if (error) {
        console.error(`Error fetching appointments for clinic ${clinic.id}:`, error);
        continue;
      }

      console.log(`Found ${appointments?.length || 0} appointments for clinic ${clinic.name}`);

      for (const appointment of appointments || []) {
        const professional = appointment.professional as any;
        const serviceType = appointment.service_type as any;
        const serviceTypeName = serviceType?.name || 'Homologação';
        const address = [
          professional?.address,
          professional?.city,
          professional?.state_code
        ].filter(Boolean).join(', ') || 'Endereço não informado';

        const messageData = {
          protocolNumber: appointment.protocol_number || 'Não gerado',
          companyName: appointment.company_name || 'Não informado',
          employeeName: appointment.employee_name || 'Não informado',
          appointmentDate: targetDateFormatted,
          startTime: appointment.start_time?.substring(0, 5) || '',
          address,
          publicWhatsapp: settings?.public_whatsapp,
          clinicName: settings?.display_name || clinic.name || 'HomologaNet',
          serviceTypeName,
        };

        let anySuccess = false;
        let emailSent = false;

        const commonParams = {
          provider: whatsappProvider,
          clinicId: clinic.id,
          evolutionConfig,
          logoUrl,
          appointmentId: appointment.id
        };

        // Send WhatsApp to company
        if (appointment.company_phone) {
          const companyMessage = formatReminderMessage('company', messageData);
          const success = await sendWhatsAppMessage({
            ...commonParams,
            phone: appointment.company_phone,
            message: companyMessage,
            templateName: 'homologacao_lembrete',
            templateComponents: [
              serviceTypeName,
              messageData.companyName,
              messageData.employeeName,
              messageData.companyName,
              messageData.appointmentDate,
              messageData.startTime,
              professional?.name || 'Profissional'
            ]
          });
          if (success) anySuccess = true;
          console.log(`Company WhatsApp reminder ${appointment.id}: ${success ? '✓' : '✗'}`);
        }

        // Send Email to company
        if (appointment.company_email) {
          const emailHtml = formatReminderEmailHtml({
            employeeName: messageData.employeeName,
            companyName: messageData.companyName,
            appointmentDate: messageData.appointmentDate,
            startTime: messageData.startTime,
            professionalName: professional?.name || 'Profissional',
            protocolNumber: messageData.protocolNumber,
            address: "Rua Coronel Paiva, 99, Centro, Ilhéus - BA (Ao lado da Sorveteria Chiquinho) - Tel: (73) 3098-2161",
            logoUrl,
            clinicName: messageData.clinicName,
          });
          const emailSuccess = await sendEmailViaSMTP(
            appointment.company_email,
            `⏰ Lembrete de Homologação - ${messageData.companyName}`,
            emailHtml
          );
          if (emailSuccess) {
            anySuccess = true;
            emailSent = true;
          }
          console.log(`Company Email reminder ${appointment.id}: ${emailSuccess ? '✓' : '✗'}`);
        }

        // Send to manager
        if (settings?.manager_whatsapp) {
          const managerMessage = formatReminderMessage('manager', messageData);
          const success = await sendWhatsAppMessage({
            ...commonParams,
            phone: settings.manager_whatsapp,
            message: managerMessage,
            // Use the same template or a generic one if needed
            templateName: 'homologacao_lembrete',
            templateComponents: [
              serviceTypeName,
              'Gestor',
              messageData.employeeName,
              messageData.companyName,
              messageData.appointmentDate,
              messageData.startTime,
              professional?.name || 'Profissional'
            ]
          });
          if (success) anySuccess = true;
          console.log(`Manager reminder ${appointment.id}: ${success ? '✓' : '✗'}`);
        }

        // Send to professional
        if (professional?.phone) {
          const professionalMessage = formatReminderMessage('professional', messageData);
          const success = await sendWhatsAppMessage({
            ...commonParams,
            phone: professional.phone,
            message: professionalMessage,
            templateName: 'homologacao_lembrete_profissional',
            templateComponents: [
              serviceTypeName,
              professional.name || 'Profissional',
              messageData.employeeName,
              messageData.companyName,
              messageData.appointmentDate,
              messageData.startTime
            ]
          });
          if (success) anySuccess = true;
          console.log(`Professional reminder ${appointment.id}: ${success ? '✓' : '✗'}`);
        }

        // Update reminder_sent_at and email_reminder_sent_at
        if (anySuccess) {
          const updateData: any = { reminder_sent_at: new Date().toISOString() };
          if (emailSent) {
            updateData.email_reminder_sent_at = new Date().toISOString();
          }
          await supabase
            .from('homologacao_appointments')
            .update(updateData)
            .eq('id', appointment.id);
          sentCount++;
        } else {
          errorCount++;
        }

        // Use the clinic-specific interval (default 60s if not set)
        const intervalSeconds = clinic.reminder_interval || 60;
        console.log(`[Clinic ${clinic.name}] Waiting ${intervalSeconds}s before next reminder...`);
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      }
    }

    const summary = {
      success: true,
      sent: sentCount,
      errors: errorCount,
      skipped: skippedCount,
      timestamp: now.toISOString(),
    };

    console.log('Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-homologacao-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
