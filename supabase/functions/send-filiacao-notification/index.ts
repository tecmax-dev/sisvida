import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  filiacaoId: string;
  channel: "email" | "whatsapp";
  isRejection?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { filiacaoId, channel, isRejection } = await req.json() as NotificationRequest;

    // Fetch filiacao data
    const { data: filiacao, error: filiacaoError } = await supabase
      .from("sindical_associados")
      .select("*, sindicato_id")
      .eq("id", filiacaoId)
      .single();

    if (filiacaoError || !filiacao) {
      throw new Error("Filiação não encontrada");
    }

    // Fetch sindicato
    const { data: sindicato } = await supabase
      .from("union_entities")
      .select("razao_social, clinic_id")
      .eq("id", filiacao.sindicato_id)
      .single();

    const sindicatoName = sindicato?.razao_social || "Sindicato";

    if (channel === "email") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const resendFrom = Deno.env.get("RESEND_FROM") || "noreply@eclini.com.br";

      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY não configurada");
      }

      const resend = new Resend(resendApiKey);

      let subject: string;
      let htmlContent: string;

      if (isRejection) {
        subject = `Solicitação de Filiação - ${sindicatoName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Solicitação de Filiação</h1>
              <p style="color: #94a3b8; margin: 10px 0 0 0;">${sindicatoName}</p>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <p>Olá <strong>${filiacao.nome}</strong>,</p>
              <p>Infelizmente sua solicitação de filiação não foi aprovada.</p>
              ${filiacao.motivo_rejeicao ? `<p><strong>Motivo:</strong> ${filiacao.motivo_rejeicao}</p>` : ""}
              <p>Caso tenha dúvidas, entre em contato conosco.</p>
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Atenciosamente,<br>${sindicatoName}</p>
            </div>
          </div>
        `;
      } else {
        subject = `Bem-vindo(a) ao ${sindicatoName}!`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Filiação Aprovada!</h1>
              <p style="color: #d1fae5; margin: 10px 0 0 0;">${sindicatoName}</p>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <p>Olá <strong>${filiacao.nome}</strong>,</p>
              <p>Sua filiação foi aprovada com sucesso! Seja bem-vindo(a) ao nosso sindicato.</p>
              ${filiacao.matricula ? `
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #065f46;">Sua matrícula:</p>
                  <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #059669;">${filiacao.matricula}</p>
                </div>
              ` : ""}
              <p>Em breve você receberá sua carteirinha digital e terá acesso a todos os benefícios.</p>
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Atenciosamente,<br>${sindicatoName}</p>
            </div>
          </div>
        `;
      }

      const emailResponse = await resend.emails.send({
        from: resendFrom,
        to: [filiacao.email],
        subject,
        html: htmlContent,
      });

      console.log("Email sent:", emailResponse);
    } else if (channel === "whatsapp") {
      // WhatsApp notification via Evolution API
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE");

      if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
        throw new Error("Evolution API não configurada");
      }

      const phone = filiacao.telefone.replace(/\D/g, "");
      const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;

      const message = isRejection
        ? `Olá ${filiacao.nome}!\n\nInfelizmente sua solicitação de filiação ao ${sindicatoName} não foi aprovada.\n\n${filiacao.motivo_rejeicao ? `Motivo: ${filiacao.motivo_rejeicao}\n\n` : ""}Caso tenha dúvidas, entre em contato conosco.`
        : `🎉 Olá ${filiacao.nome}!\n\nSua filiação ao ${sindicatoName} foi APROVADA!\n\n${filiacao.matricula ? `📋 Sua matrícula: *${filiacao.matricula}*\n\n` : ""}Em breve você receberá sua carteirinha digital.\n\nSeja bem-vindo(a)!`;

      const response = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao enviar WhatsApp: ${errorText}`);
      }

      console.log("WhatsApp sent successfully");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-filiacao-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
