import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CredentialsEmailRequest {
  userEmail: string;
  userName: string;
  tempPassword: string;
  clinicName?: string;
}

const getCredentialsEmailTemplate = (userName: string, userEmail: string, tempPassword: string, clinicName: string, loginUrl: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Suas credenciais de acesso - Eclini</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f6f9;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🔐 Suas credenciais de acesso</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Olá, ${userName}!</h2>
              
              <p style="color: #475569; line-height: 1.6; font-size: 16px; margin: 0 0 20px 0;">
                Você foi adicionado como usuário ${clinicName ? `na clínica <strong>${clinicName}</strong>` : 'no sistema Eclini'}. 
                Abaixo estão suas credenciais de acesso:
              </p>
              
              <!-- Credentials Box -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 10px 0;">
                      <p style="color: #64748b; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                      <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${userEmail}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-top: 1px solid #e2e8f0;">
                      <p style="color: #64748b; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">Senha temporária</p>
                      <p style="color: #1e293b; font-size: 18px; font-weight: 700; font-family: monospace; margin: 0; background: #fef3c7; padding: 8px 12px; border-radius: 4px; display: inline-block;">${tempPassword}</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px auto;">
                <tr>
                  <td style="background: #6366f1; border-radius: 8px;">
                    <a href="${loginUrl}" 
                       style="display: inline-block; padding: 16px 40px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Acessar o sistema →
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  <strong>⚠️ Importante:</strong> Por segurança, recomendamos que você altere sua senha no primeiro acesso. 
                  Acesse seu perfil no sistema para fazer isso.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                Se você não esperava receber este email, entre em contato com o administrador da clínica.
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
  console.log("[send-user-credentials] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, tempPassword, clinicName }: CredentialsEmailRequest = await req.json();

    console.log(`[send-user-credentials] Sending to: ${userEmail}, name: ${userName}`);

    if (!userEmail || !userName || !tempPassword) {
      console.error("[send-user-credentials] Missing required fields");
      return new Response(
        JSON.stringify({ error: "Email, nome e senha são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-user-credentials] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const resend = new Resend(resendApiKey);

    const baseUrl = Deno.env.get("SITE_URL") || "https://eclini.lovable.app";
    const loginUrl = `${baseUrl}/auth`;

    const htmlContent = getCredentialsEmailTemplate(userName, userEmail, tempPassword, clinicName || "", loginUrl);

    const { data, error } = await resend.emails.send({
      from: "Eclini <noreply@eclini.com.br>",
      to: [userEmail],
      subject: "🔐 Suas credenciais de acesso - Eclini",
      html: htmlContent,
    });

    if (error) {
      console.error("[send-user-credentials] Resend error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email", details: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log(`[send-user-credentials] Email sent successfully to ${userEmail}`, data);

    return new Response(
      JSON.stringify({ success: true, message: "Email com credenciais enviado com sucesso", id: data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("[send-user-credentials] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar email", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
