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
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'noreply@eclini.com.br';

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

// Send WhatsApp message with image
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

    console.log(`Sending WhatsApp protocol to ${formattedPhone}`);

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
    console.error('Error sending WhatsApp:', error);
    return false;
  }
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

// Format WhatsApp protocol message
function formatProtocolMessage(data: {
  protocolNumber: string;
  companyName: string;
  employeeName: string;
  appointmentDate: string;
  address: string;
  clinicName: string;
}): string {
  return [
    `✅ *Protocolo de Homologação*`,
    ``,
    `O processo de homologação foi concluído com sucesso.`,
    ``,
    `📋 *Funcionário:* ${data.employeeName}`,
    `🏢 *Empresa:* ${data.companyName}`,
    `📅 *Data:* ${data.appointmentDate}`,
    `📝 *Protocolo:* ${data.protocolNumber}`,
    ``,
    `📍 *Local:* ${data.address}`,
    `📞 *Telefone:* (73) 3231-1784`,
    ``,
    `Guarde este protocolo para seus registros.`,
    ``,
    `_Este é um comprovante oficial._`,
    `_${data.clinicName}_`,
  ].join('\n');
}

// Format protocol email HTML
function formatProtocolEmailHtml(data: {
  employeeName: string;
  companyName: string;
  appointmentDate: string;
  protocolNumber: string;
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
  <title>Protocolo de Homologação</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center;">
              <img src="${data.logoUrl}" alt="${data.clinicName}" style="max-height: 60px; margin-bottom: 16px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                ✅ Protocolo de Homologação
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                O processo de homologação foi concluído com sucesso.
              </p>
              
              <!-- Protocol Badge -->
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background-color: #dcfce7; border: 2px solid #16a34a; border-radius: 8px; padding: 16px 32px;">
                  <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 500;">Número do Protocolo</p>
                  <p style="margin: 8px 0 0; color: #15803d; font-size: 28px; font-weight: 700; letter-spacing: 1px;">${data.protocolNumber}</p>
                </div>
              </div>
              
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
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Address -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  📍 <strong>Local:</strong><br>
                  ${data.address}<br>
                  📞 Telefone: (73) 3231-1784
                </p>
              </div>
              
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Guarde este protocolo para seus registros.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Este é um comprovante oficial emitido por ${data.clinicName}.
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

    // Fetch appointment with related data
    const { data: appointment, error: appointmentError } = await supabase
      .from('homologacao_appointments')
      .select(`
        *,
        professional:homologacao_professionals(name, address, city, state_code)
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

    if (!appointment.protocol_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'No protocol number for this appointment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch clinic and settings
    const { data: clinic } = await supabase
      .from('clinics')
      .select(`
        name, logo_url, whatsapp_header_image_url,
        union_entities!union_entities_clinic_id_fkey(logo_url)
      `)
      .eq('id', appointment.clinic_id)
      .single();

    const { data: settings } = await supabase
      .from('homologacao_settings')
      .select('display_name, logo_url')
      .eq('clinic_id', appointment.clinic_id)
      .maybeSingle();

    // Fetch Evolution config
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', appointment.clinic_id)
      .maybeSingle();

    // Logo priority
    const unionEntity = (clinic as any)?.union_entities?.[0];
    const logoUrl = settings?.logo_url || unionEntity?.logo_url || clinic?.whatsapp_header_image_url || clinic?.logo_url || 'https://app.eclini.com.br/eclini-whatsapp-header.jpg';
    const clinicName = settings?.display_name || clinic?.name || 'HomologaNet';

    // Format date
    const dateOnly = (appointment.appointment_date || "").slice(0, 10);
    const dateMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let appointmentDate = appointment.appointment_date;
    if (dateMatch) {
      const dateObj = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), 12, 0, 0);
      appointmentDate = dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    const address = "Rua Coronel Paiva, 99, Centro, Ilhéus - BA (Ao lado da Sorveteria Chiquinho)";

    const messageData = {
      protocolNumber: appointment.protocol_number,
      companyName: appointment.company_name || 'Não informado',
      employeeName: appointment.employee_name || 'Não informado',
      appointmentDate,
      address,
      clinicName,
    };

    let whatsappSent = false;
    let emailSent = false;

    // Send WhatsApp
    if (appointment.company_phone && evolutionConfig?.is_connected) {
      const message = formatProtocolMessage(messageData);
      whatsappSent = await sendWhatsAppWithImage(
        evolutionConfig as EvolutionConfig,
        appointment.company_phone,
        logoUrl,
        message
      );
      console.log(`WhatsApp protocol sent: ${whatsappSent ? '✓' : '✗'}`);
    }

    // Send Email
    if (appointment.company_email) {
      const emailHtml = formatProtocolEmailHtml({
        ...messageData,
        logoUrl,
      });
      emailSent = await sendEmailViaSMTP(
        appointment.company_email,
        `✅ Protocolo de Homologação - ${appointment.protocol_number}`,
        emailHtml
      );
      console.log(`Email protocol sent: ${emailSent ? '✓' : '✗'}`);
    }

    // Update protocol sent timestamp
    if (whatsappSent || emailSent) {
      await supabase
        .from('homologacao_appointments')
        .update({
          protocol_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointment_id);

      // Log the notification
      await supabase.from('homologacao_notification_logs').insert({
        appointment_id,
        clinic_id: appointment.clinic_id,
        channel: whatsappSent ? 'whatsapp' : 'email',
        recipient_phone: whatsappSent ? appointment.company_phone : null,
        recipient_email: emailSent ? appointment.company_email : null,
        message: `Protocolo ${appointment.protocol_number} enviado automaticamente`,
        status: 'sent',
        sent_at: new Date().toISOString(),
        protocol_sent: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: whatsappSent || emailSent,
        whatsapp_sent: whatsappSent,
        email_sent: emailSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-homologacao-protocol:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
