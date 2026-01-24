import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FirstAccessRequest {
  cpf: string;
  email: string;
}

const generateEmailHtml = (firstName: string, token: string, logoUrl?: string): string => {
  const logoSection = logoUrl 
    ? `<img src="${logoUrl}" alt="Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 16px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Codigo de Primeiro Acesso</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<tr>
<td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px 30px; text-align: center;">
${logoSection}
<h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">SECMI</h1>
<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Sindicato dos Comerciarios</p>
</td>
</tr>
<tr>
<td style="padding: 40px 30px;">
<h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Ola, ${firstName}!</h2>
<p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">Voce solicitou o cadastro de senha para primeiro acesso ao aplicativo SECMI.</p>
<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
<p style="color: #065f46; font-size: 14px; margin: 0 0 15px 0; font-weight: 500;">Seu codigo de verificacao:</p>
<div style="background: #ffffff; border-radius: 8px; padding: 20px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
<span style="font-size: 36px; font-weight: 700; color: #059669; letter-spacing: 8px;">${token}</span>
</div>
</div>
<p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">Este codigo e valido por 60 minutos.</p>
<p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">Se voce nao solicitou este codigo, por favor ignore este email.</p>
</td>
</tr>
<tr>
<td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
<p style="color: #9ca3af; font-size: 12px; margin: 0;">SECMI - Sindicato dos Comerciarios. Este e um email automatico, nao responda.</p>
</td>
</tr>
</table>
</body>
</html>`;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      console.error("SMTP not configured");
      return new Response(JSON.stringify({ error: "Servico de email nao configurado" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Using SMTP:", smtpHost, "port:", smtpPort, "from:", smtpFrom);

    const { cpf, email }: FirstAccessRequest = await req.json();

    if (!cpf || !email) {
      return new Response(JSON.stringify({ error: "CPF e email sao obrigatorios" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verifica se paciente existe sem senha
    const { data: patientData, error: checkError } = await supabase
      .rpc('check_patient_first_access', {
        p_cpf: cpf.replace(/\D/g, ''),
        p_email: email.toLowerCase().trim()
      });

    if (checkError) {
      console.error("Error checking patient:", checkError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar dados" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!patientData || patientData.length === 0) {
      console.log("Patient not found or already has password");
      return new Response(
        JSON.stringify({ success: true, message: "Se os dados estiverem corretos, voce recebera um email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const patient = patientData[0];

    // Busca logo do sindicato
    let logoUrl: string | undefined;
    const { data: unionData } = await supabase
      .from('union_entities')
      .select('logo_url')
      .eq('clinic_id', patient.clinic_id)
      .single();
    
    if (unionData?.logo_url) {
      logoUrl = unionData.logo_url;
    }

    // Cria token de primeiro acesso
    const { data: token, error: tokenError } = await supabase
      .rpc('create_first_access_token', {
        p_patient_id: patient.patient_id,
        p_email: email.toLowerCase().trim()
      });

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar codigo de verificacao" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const firstName = patient.patient_name.split(' ')[0];
    const emailHtml = generateEmailHtml(firstName, token, logoUrl);

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
        to: email,
        subject: "Codigo de Primeiro Acesso - App SECMI",
        html: emailHtml,
      });

      await client.close();
      console.log("Email sent successfully via SMTP to:", email);
    } catch (smtpError: any) {
      console.error("SMTP error:", smtpError);
      try { await client.close(); } catch (_) {}
      return new Response(
        JSON.stringify({ error: "Nao foi possivel enviar o email. Verifique as configuracoes SMTP." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true, message: "Codigo enviado para seu email" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-first-access-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
