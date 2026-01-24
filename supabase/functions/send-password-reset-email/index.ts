import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      console.error("SMTP not configured");
      return new Response(
        JSON.stringify({ error: "Servico de email nao configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email }: PasswordResetRequest = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Email invalido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing password reset request for: ${email}`);

    const { data: tokenData, error: tokenError } = await supabase.rpc(
      "create_password_reset_token",
      { p_email: email }
    );

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Erro ao processar solicitacao" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = tokenData?.[0];

    if (!result?.success) {
      console.log(`Token creation failed: ${result?.message}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Se o email estiver cadastrado, voce recebera um codigo de recuperacao." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = result.patient_name?.split(" ")[0] || "Associado";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: #059669; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">SECMI</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Sindicato dos Comerciarios</p>
        </div>

        <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Ola, ${firstName}!</h2>

          <p style="color: #666; line-height: 1.6;">
            Recebemos uma solicitacao para redefinir a senha do seu acesso ao aplicativo SECMI.
          </p>

          <div style="background-color: #f0fdf4; border: 2px solid #059669; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
            <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Seu codigo de recuperacao:</p>
            <p style="font-size: 36px; font-weight: bold; color: #059669; margin: 0; letter-spacing: 8px;">${result.token}</p>
          </div>

          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            <strong>Este codigo e valido por 30 minutos.</strong>
          </p>

          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Se voce nao solicitou a redefinicao de senha, ignore este email. Sua conta permanece segura.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">

          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            Este e um email automatico, por favor nao responda.<br>
            SECMI - Todos os direitos reservados.
          </p>
        </div>
      </body>
      </html>
    `.replace(/\s+/g, ' ').trim();

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort || "465"),
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    await client.send({
      from: smtpFrom,
      to: email,
      subject: "Codigo de Recuperacao de Senha - SECMI",
      html: htmlContent,
    });

    await client.close();

    console.log("Password reset email sent successfully via SMTP");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Se o email estiver cadastrado, voce recebera um codigo de recuperacao.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset-email:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
