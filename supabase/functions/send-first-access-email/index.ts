import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FirstAccessRequest {
  cpf: string;
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Serviço de email não configurado" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const resend = new Resend(resendApiKey);
    const { cpf, email }: FirstAccessRequest = await req.json();

    if (!cpf || !email) {
      return new Response(JSON.stringify({ error: "CPF e email são obrigatórios" }), {
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

    // Por segurança, sempre retorna sucesso mesmo se não encontrar
    // para não revelar se o email/cpf existe
    if (!patientData || patientData.length === 0) {
      console.log("Patient not found or already has password");
      return new Response(
        JSON.stringify({ success: true, message: "Se os dados estiverem corretos, você receberá um email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const patient = patientData[0];

    // Cria token de primeiro acesso
    const { data: token, error: tokenError } = await supabase
      .rpc('create_first_access_token', {
        p_patient_id: patient.patient_id,
        p_email: email.toLowerCase().trim()
      });

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar código de verificação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Envia email com o código via Resend
    const firstName = patient.patient_name.split(' ')[0];
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                SECMI
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
                Sindicato dos Comerciários
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">
                Olá, ${firstName}!
              </h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Você solicitou o cadastro de senha para primeiro acesso ao aplicativo SECMI.
              </p>
              <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                <p style="color: #065f46; font-size: 14px; margin: 0 0 15px 0; font-weight: 500;">
                  Seu código de verificação:
                </p>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <span style="font-size: 36px; font-weight: 700; color: #059669; letter-spacing: 8px;">
                    ${token}
                  </span>
                </div>
              </div>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                ⏰ Este código é válido por <strong>30 minutos</strong>.
              </p>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                Se você não solicitou este código, por favor ignore este email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 SECMI - Sindicato dos Comerciários<br>
                Este é um email automático, não responda.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      const { data, error } = await resend.emails.send({
        from: "SECMI <onboarding@resend.dev>",
        to: [email],
        subject: "Código de Primeiro Acesso - App SECMI",
        html: emailHtml,
      });

      if (error) {
        console.error("Resend error:", error);
        return new Response(
          JSON.stringify({ error: "Não foi possível enviar o email" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Email sent successfully via Resend to:", email, data);
    } catch (sendError: any) {
      console.error("Email send error:", sendError);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true, message: "Código enviado para seu email" }), {
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
