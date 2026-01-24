import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  email: string;
  memberName: string;
  pdfBase64: string;
  sindicatoName: string;
}

serve(async (req) => {
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
      throw new Error("Configuracao SMTP incompleta");
    }

    const { email, memberName, pdfBase64, sindicatoName } = await req.json() as EmailRequest;

    if (!email || !memberName || !pdfBase64) {
      throw new Error("Dados incompletos: email, memberName e pdfBase64 sao obrigatorios");
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Ficha de Filiacao</h1>
          <p style="color: #94a3b8; margin: 10px 0 0 0;">${sindicatoName}</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #1e293b;">Ola <strong>${memberName}</strong>,</p>
          
          <p style="color: #475569; line-height: 1.6;">
            Segue em anexo sua ficha de filiacao completa, contendo todos os seus dados cadastrais, 
            informacoes de dependentes e a autorizacao de desconto em folha de pagamento assinada digitalmente.
          </p>
          
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #065f46; font-weight: 500;">
              Documento anexo: Ficha de Filiacao (PDF)
            </p>
          </div>
          
          <p style="color: #475569; line-height: 1.6;">
            Guarde este documento para seus registros. Caso tenha alguma duvida, entre em contato conosco.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Atenciosamente,<br/>
            <strong>${sindicatoName}</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Este e um e-mail automatico. Por favor, nao responda diretamente a esta mensagem.
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

    const filename = `ficha-filiacao-${memberName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`;

    await client.send({
      from: smtpFrom,
      to: email,
      subject: `Ficha de Filiacao - ${sindicatoName}`,
      content: "Visualize este email em um cliente que suporte HTML",
      html: htmlContent,
      attachments: [
        {
          filename: filename,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
      headers: {
        "Content-Transfer-Encoding": "base64",
      },
    });

    await client.close();

    console.log("Email sent successfully via SMTP");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-filiacao-pdf-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
