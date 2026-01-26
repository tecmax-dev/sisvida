import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  userEmail: string;
  userName: string;
  confirmationToken: string;
}

const getConfirmationEmailTemplate = (userName: string, confirmationUrl: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email - Eclini</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f6f9;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">📧 Confirme seu email</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Olá, ${userName}!</h2>
              
              <p style="color: #475569; line-height: 1.6; font-size: 16px; margin: 0 0 20px 0;">
                Obrigado por se cadastrar no Eclini! Para ativar sua conta e começar a usar todos os recursos 
                da plataforma, por favor confirme seu endereço de email clicando no botão abaixo:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px auto;">
                <tr>
                  <td style="background: #6366f1; border-radius: 8px;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; padding: 16px 40px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Confirmar meu email →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #64748b; font-size: 14px; margin: 30px 0 10px 0;">
                Se o botão não funcionar, copie e cole este link no seu navegador:
              </p>
              <p style="color: #6366f1; font-size: 12px; word-break: break-all; margin: 0 0 30px 0;">
                ${confirmationUrl}
              </p>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  <strong>⚠️ Importante:</strong> Este link expira em 24 horas. Se você não solicitou este cadastro, 
                  ignore este email.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                Precisa de ajuda? Responda este email ou acesse nosso suporte.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 30px; text-align: center;">
              <p style="color: #64748b; font-size: 14px; margin: 0 0 5px 0;"><strong>Eclini</strong> - Gestão inteligente para clínicas e consultórios</p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Eclini. Todos os direitos reservados.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-confirmation-email] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, confirmationToken }: ConfirmationEmailRequest = await req.json();

    console.log(`[send-confirmation-email] Sending to: ${userEmail}, name: ${userName}`);

    if (!userEmail || !userName || !confirmationToken) {
      console.error("[send-confirmation-email] Missing required fields");
      return new Response(
        JSON.stringify({ error: "Email, nome e token são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // SMTP Configuration (Locaweb)
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      console.error("[send-confirmation-email] SMTP not configured");
      return new Response(
        JSON.stringify({ error: "SMTP não configurado" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("Using SMTP:", smtpHost, "port:", smtpPort, "from:", smtpFrom);

    const baseUrl = Deno.env.get("SITE_URL") || "https://app.eclini.com.br";
    const confirmationUrl = `${baseUrl}/confirm-email?token=${confirmationToken}`;

    const htmlContent = getConfirmationEmailTemplate(userName, confirmationUrl);

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
      const cleanHtml = htmlContent.replace(/\n\s*/g, '').replace(/\s{2,}/g, ' ');

      await client.send({
        from: smtpFrom,
        to: userEmail,
        subject: "📧 Confirme seu email - Eclini",
        content: "Visualize este email em um cliente que suporte HTML.",
        html: cleanHtml,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Content-Transfer-Encoding": "base64",
        },
      });

      await client.close();
      console.log(`[send-confirmation-email] Email sent successfully to ${userEmail}`);
    } catch (smtpError: any) {
      console.error("[send-confirmation-email] SMTP error:", smtpError);
      try { await client.close(); } catch (_) {}
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email", details: smtpError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email de confirmação enviado com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("[send-confirmation-email] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar email", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
