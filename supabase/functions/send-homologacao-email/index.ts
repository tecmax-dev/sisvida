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

async function sendEmailViaSMTP(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    // Use Resend as fallback if SMTP not configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: SMTP_FROM,
          to: [to],
          subject,
          html: htmlBody,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resend API error:', errorText);
        return false;
      }

      console.log(`Email sent successfully to ${to}`);
      return true;
    }

    // SMTP sending using denomailer
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
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center;">
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
                Este é um lembrete do seu agendamento de homologação:
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
                  ${data.address}
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

    const { appointment_id, type, custom_message } = await req.json();

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

    if (!appointment.company_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'No email address for this appointment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch clinic and settings
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, logo_url')
      .eq('id', appointment.clinic_id)
      .single();

    const { data: settings } = await supabase
      .from('homologacao_settings')
      .select('display_name, logo_url')
      .eq('clinic_id', appointment.clinic_id)
      .maybeSingle();

    const logoUrl = settings?.logo_url || clinic?.logo_url || 'https://app.eclini.com.br/logo.png';
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

    const professional = appointment.professional as any;
    const address = "Rua Coronel Paiva, 99, Centro, Ilhéus - BA (Ao lado da Sorveteria Chiquinho) - Tel: (73) 3231-1784";

    let subject: string;
    let htmlBody: string;

    if (type === 'protocol' && appointment.protocol_number) {
      subject = `✅ Protocolo de Homologação - ${appointment.protocol_number}`;
      htmlBody = formatProtocolEmailHtml({
        employeeName: appointment.employee_name || 'Não informado',
        companyName: appointment.company_name || 'Não informado',
        appointmentDate,
        protocolNumber: appointment.protocol_number,
        address,
        logoUrl,
        clinicName,
      });
    } else {
      subject = `⏰ Lembrete de Homologação - ${appointment.company_name}`;
      htmlBody = formatReminderEmailHtml({
        employeeName: appointment.employee_name || 'Não informado',
        companyName: appointment.company_name || 'Não informado',
        appointmentDate,
        startTime: appointment.start_time?.substring(0, 5) || '',
        professionalName: professional?.name || 'Profissional',
        protocolNumber: appointment.protocol_number,
        address,
        logoUrl,
        clinicName,
      });
    }

    const success = await sendEmailViaSMTP(
      appointment.company_email,
      subject,
      htmlBody
    );

    if (!success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the email
    const monthYear = new Date().toISOString().slice(0, 7);
    await supabase.from('message_logs').insert({
      clinic_id: appointment.clinic_id,
      message_type: type === 'protocol' ? 'homologacao_protocol_email' : 'homologacao_reminder_email',
      phone: '',
      month_year: monthYear,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-homologacao-email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
