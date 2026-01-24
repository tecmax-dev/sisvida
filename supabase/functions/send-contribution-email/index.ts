import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
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
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      console.error('SMTP not configured');
      return new Response(
        JSON.stringify({ error: 'Servico de email nao configurado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Using SMTP:", smtpHost, "port:", smtpPort, "from:", smtpFrom);

    const { to, subject, message, clinicId, contributionId, memberName }: EmailRequest = await req.json();

    console.log('Sending contribution email:', { to, subject, clinicId, contributionId });

    if (!to || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos: to, subject e message sao obrigatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Busca logo do sindicato
    let logoUrl: string | undefined;
    const { data: unionData } = await supabase
      .from('union_entities')
      .select('logo_url')
      .eq('clinic_id', clinicId)
      .single();
    
    if (unionData?.logo_url) {
      logoUrl = unionData.logo_url;
    }

    const logoSection = logoUrl 
      ? `<img src="${logoUrl}" alt="Logo" style="max-height: 50px; max-width: 180px; margin-bottom: 12px;" />`
      : '';
    
    // Convert plain text message to HTML
    const htmlMessage = message
      .replace(/━+/g, '<hr style="border: 1px solid #e5e5e5; margin: 16px 0;">')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; text-align: center;">
${logoSection}
<h1 style="color: white; margin: 0; font-size: 24px;">${clinicName}</h1>
</div>
<div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e5e5; border-top: none;">
<div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
${htmlMessage}
</div>
</div>
<div style="text-align: center; padding: 16px; color: #666; font-size: 12px;">
<p style="margin: 0;">Este e um email automatico. Por favor, nao responda.</p>
</div>
</div>
</body>
</html>`;

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
      await client.send({
        from: smtpFrom,
        to: to,
        subject: subject,
        html: emailHtml,
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
