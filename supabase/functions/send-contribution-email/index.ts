import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  clinicId: string;
  contributionId?: string;
  memberName?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SMTP Configuration (Locaweb)
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      console.error('SMTP not configured. Missing:', {
        host: !smtpHost,
        user: !smtpUser,
        password: !smtpPassword,
        from: !smtpFrom
      });
      return new Response(
        JSON.stringify({ error: 'Serviço de email não configurado. Configure as variáveis SMTP.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Using SMTP:", smtpHost, "port:", smtpPort, "from:", smtpFrom);

    const { to, subject, message, clinicId, contributionId, memberName }: EmailRequest = await req.json();

    console.log('Sending contribution email:', { to, subject, clinicId, contributionId });

    // Validate inputs
    if (!to || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos: to, subject e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get clinic info for sender name
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, email')
      .eq('id', clinicId)
      .single();

    const clinicName = clinic?.name || 'Sistema';
    
    // Convert plain text message to HTML
    const htmlMessage = message
      .replace(/━+/g, '<hr style="border: 1px solid #e5e5e5; margin: 16px 0;">')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/📋|📅|📆|💰|🔗|🔢|📱/g, (match) => `<span style="font-size: 18px;">${match}</span>`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${clinicName}</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            ${htmlMessage}
          </div>
        </div>
        <div style="text-align: center; padding: 16px; color: #666; font-size: 12px;">
          <p>Este é um email automático. Por favor, não responda.</p>
        </div>
      </body>
      </html>
    `;

    // Initialize SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    try {
      // Remove extra whitespace/newlines from HTML to prevent encoding issues
      const cleanHtml = emailHtml.replace(/\n\s*/g, '').replace(/\s{2,}/g, ' ');

      await client.send({
        from: smtpFrom,
        to: to,
        subject: subject,
        content: "Visualize este email em um cliente que suporte HTML.",
        html: cleanHtml,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Content-Transfer-Encoding": "base64",
        },
      });

      await client.close();
      console.log('Email sent successfully via SMTP to:', to);
    } catch (smtpError: any) {
      console.error("SMTP error:", smtpError);
      try { await client.close(); } catch (_) {}
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar email via SMTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the email send
    if (contributionId) {
      await supabase.from('contribution_audit_logs').insert({
        contribution_id: contributionId,
        clinic_id: clinicId,
        action: 'email_sent',
        notes: `Email enviado para ${to}`,
        new_data: { email: to, subject, memberName },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao enviar email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
