import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignatureRequestPayload {
  associadoId: string;
  clinicId: string;
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
        JSON.stringify({ error: 'Serviço de email não configurado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { associadoId, clinicId }: SignatureRequestPayload = await req.json();

    if (!associadoId || !clinicId) {
      return new Response(
        JSON.stringify({ error: 'associadoId e clinicId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch patient (sócio) data from patients table
    const { data: associado, error: assocError } = await supabase
      .from('patients')
      .select('id, name, email, cpf, phone, signature_url, signature_accepted')
      .eq('id', associadoId)
      .eq('clinic_id', clinicId)
      .single();

    if (assocError || !associado) {
      console.error('Sócio not found:', assocError);
      return new Response(
        JSON.stringify({ error: 'Sócio não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!associado.email) {
      return new Response(
        JSON.stringify({ error: 'Sócio não possui email cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already signed
    if (associado.signature_accepted) {
      return new Response(
        JSON.stringify({ error: 'Sócio já possui autorização de desconto assinada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch union entity info
    const { data: unionEntity } = await supabase
      .from('union_entities')
      .select('razao_social, logo_url')
      .eq('clinic_id', clinicId)
      .single();

    // Generate secure token
    const { data: tokenData } = await supabase.rpc('generate_signature_token');
    const token = tokenData || crypto.randomUUID().replace(/-/g, '');

    // Store token with 7 days expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: insertError } = await supabase
      .from('signature_request_tokens')
      .insert({
        associado_id: associadoId,
        clinic_id: clinicId,
        token,
        email: associado.email,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar token de assinatura' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build signature URL
    const baseUrl = 'https://app.eclini.com.br';
    const signatureUrl = `${baseUrl}/assinar/${token}`;

    const unionName = unionEntity?.razao_social || 'Sindicato';
    const logoUrl = unionEntity?.logo_url;

    const logoSection = logoUrl 
      ? `<img src="${logoUrl}" alt="Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 16px;" />`
      : '';

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Autorização de Desconto em Folha</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; text-align: center;">
${logoSection}
<h1 style="color: white; margin: 0; font-size: 22px;">${unionName}</h1>
</div>
<div style="padding: 32px;">
<h2 style="color: #1f2937; margin: 0 0 16px;">Olá, ${associado.name}!</h2>
<p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
  Recebemos uma solicitação para que você autorize o desconto em folha de pagamento 
  referente à sua contribuição sindical.
</p>
<p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
  Para completar sua autorização, clique no botão abaixo e assine digitalmente:
</p>
<div style="text-align: center; margin: 32px 0;">
  <a href="${signatureUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
    Assinar Autorização
  </a>
</div>
<p style="color: #6b7280; font-size: 14px;">
  Ou copie e cole este link no seu navegador:<br>
  <a href="${signatureUrl}" style="color: #7c3aed; word-break: break-all;">${signatureUrl}</a>
</p>
<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
  <p style="color: #92400e; margin: 0; font-size: 14px;">
    <strong>⚠️ Importante:</strong> Este link é válido por 7 dias e é de uso único.
  </p>
</div>
</div>
<div style="text-align: center; padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
<p style="color: #9ca3af; font-size: 12px; margin: 0;">
  Este é um email automático. Por favor, não responda.
</p>
<p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
  ${unionName}
</p>
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
        to: associado.email,
        subject: `${unionName} - Autorização de Desconto em Folha`,
        html: emailHtml,
      });

      await client.close();
      console.log('Signature request email sent to:', associado.email);
    } catch (smtpError: any) {
      console.error("SMTP error:", smtpError);
      try { await client.close(); } catch (_) {}
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email enviado para ${associado.email}`,
        email: associado.email 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-signature-request:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
