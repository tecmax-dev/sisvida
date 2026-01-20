import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM") || "noreply@eclini.com.br";

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const { email, memberName, pdfBase64, sindicatoName } = await req.json() as EmailRequest;

    if (!email || !memberName || !pdfBase64) {
      throw new Error("Dados incompletos: email, memberName e pdfBase64 são obrigatórios");
    }

    const resend = new Resend(resendApiKey);

    const emailResponse = await resend.emails.send({
      from: resendFrom,
      to: [email],
      subject: `Ficha de Filiação - ${sindicatoName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📋 Ficha de Filiação</h1>
            <p style="color: #94a3b8; margin: 10px 0 0 0;">${sindicatoName}</p>
          </div>
          
          <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #1e293b;">Olá <strong>${memberName}</strong>,</p>
            
            <p style="color: #475569; line-height: 1.6;">
              Segue em anexo sua ficha de filiação completa, contendo todos os seus dados cadastrais, 
              informações de dependentes e a autorização de desconto em folha de pagamento assinada digitalmente.
            </p>
            
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #065f46; font-weight: 500;">
                📎 Documento anexo: Ficha de Filiação (PDF)
              </p>
            </div>
            
            <p style="color: #475569; line-height: 1.6;">
              Guarde este documento para seus registros. Caso tenha alguma dúvida, entre em contato conosco.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Atenciosamente,<br/>
              <strong>${sindicatoName}</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `ficha-filiacao-${memberName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
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
