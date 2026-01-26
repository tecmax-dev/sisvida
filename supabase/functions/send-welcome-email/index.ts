import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  userEmail: string;
  userName: string;
  trialDays: number;
}

const getWelcomeEmailTemplate = (userName: string, trialDays: number): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Eclini</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f6f9;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🎉 Bem-vindo(a) ao Eclini!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <!-- Trial Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                    ✨ ${trialDays} dias de teste grátis
                  </td>
                </tr>
              </table>
              
              <h2 style="color: #1e293b; margin: 20px 0 10px 0; font-size: 22px;">Olá, ${userName}!</h2>
              
              <p style="color: #475569; line-height: 1.6; font-size: 16px; margin: 0 0 20px 0;">
                Estamos muito felizes em ter você conosco! Sua conta foi criada com sucesso e você tem 
                <strong>${trialDays} dias de acesso completo</strong> a todos os recursos da plataforma, 
                sem nenhum custo.
              </p>
              
              <h3 style="color: #1e293b; margin: 30px 0 15px 0; font-size: 18px;">🚀 O que você pode fazer:</h3>
              
              <!-- Features Grid -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="48%" style="vertical-align: top; padding: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #6366f1;">
                      <tr>
                        <td>
                          <strong style="color: #1e293b; font-size: 14px;">📅 Agenda Inteligente</strong>
                          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">Gerencie agendamentos online</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="vertical-align: top; padding: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #6366f1;">
                      <tr>
                        <td>
                          <strong style="color: #1e293b; font-size: 14px;">📋 Prontuário Eletrônico</strong>
                          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">Histórico completo dos pacientes</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="48%" style="vertical-align: top; padding: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #6366f1;">
                      <tr>
                        <td>
                          <strong style="color: #1e293b; font-size: 14px;">💊 Receituário Digital</strong>
                          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">Emita prescrições com assinatura</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="vertical-align: top; padding: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #6366f1;">
                      <tr>
                        <td>
                          <strong style="color: #1e293b; font-size: 14px;">📱 Lembretes WhatsApp</strong>
                          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">Reduza faltas automaticamente</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="48%" style="vertical-align: top; padding: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #6366f1;">
                      <tr>
                        <td>
                          <strong style="color: #1e293b; font-size: 14px;">💰 Gestão Financeira</strong>
                          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">Controle receitas e despesas</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="vertical-align: top; padding: 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #6366f1;">
                      <tr>
                        <td>
                          <strong style="color: #1e293b; font-size: 14px;">📊 Relatórios</strong>
                          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">Dashboards e métricas</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #475569; line-height: 1.6; font-size: 16px; margin: 25px 0;">
                Durante seu período de teste, você terá acesso a <strong>100% das funcionalidades</strong>, 
                incluindo telemedicina, odontograma digital, gestão de convênios e muito mais!
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 25px auto;">
                <tr>
                  <td style="background: #6366f1; border-radius: 8px;">
                    <a href="https://app.eclini.com.br/dashboard" 
                       style="display: inline-block; padding: 14px 32px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Acessar minha conta →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                Precisa de ajuda? Estamos aqui para você! Responda este email ou acesse nosso suporte.
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
  console.log("[send-welcome-email] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, trialDays = 14 }: WelcomeEmailRequest = await req.json();

    console.log(`[send-welcome-email] Sending to: ${userEmail}, name: ${userName}`);

    if (!userEmail || !userName) {
      console.error("[send-welcome-email] Missing required fields");
      return new Response(
        JSON.stringify({ error: "Email e nome são obrigatórios" }),
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
      console.error("[send-welcome-email] SMTP not configured");
      return new Response(
        JSON.stringify({ error: "SMTP não configurado" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log("Using SMTP:", smtpHost, "port:", smtpPort, "from:", smtpFrom);

    const htmlContent = getWelcomeEmailTemplate(userName, trialDays);

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
        subject: `🎉 Bem-vindo(a) ao Eclini, ${userName}! Seu período de teste começou`,
        content: "Visualize este email em um cliente que suporte HTML.",
        html: cleanHtml,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Content-Transfer-Encoding": "base64",
        },
      });

      await client.close();
      console.log(`[send-welcome-email] Email sent successfully to ${userEmail}`);
    } catch (smtpError: any) {
      console.error("[send-welcome-email] SMTP error:", smtpError);
      try { await client.close(); } catch (_) {}
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email", details: smtpError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("[send-welcome-email] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar email", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
