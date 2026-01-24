import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
      throw new Error("Filiacao nao encontrada");
    }

    // Fetch sindicato
    const { data: sindicato } = await supabase
      .from("union_entities")
      .select("razao_social, clinic_id, logo_url")
      .eq("id", filiacao.sindicato_id)
      .single();

    const sindicatoName = sindicato?.razao_social || "Sindicato";
    const logoUrl = sindicato?.logo_url || "";

    if (channel === "email") {
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = Deno.env.get("SMTP_PORT");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");
      const smtpFrom = Deno.env.get("SMTP_FROM");

      if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
        throw new Error("Configuracao SMTP incompleta");
      }

      let subject: string;
      let htmlContent: string;

      const logoSection = logoUrl ? `
        <div style="text-align: center; margin-bottom: 15px;">
          <img src="${logoUrl}" alt="${sindicatoName}" style="max-width: 150px; max-height: 80px; object-fit: contain;" />
        </div>
      ` : '';

      if (isRejection) {
        subject = `Solicitacao de Filiacao - ${sindicatoName}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; text-align: center;">
              ${logoSection}
              <h1 style="color: white; margin: 0;">Solicitacao de Filiacao</h1>
              <p style="color: #94a3b8; margin: 10px 0 0 0;">${sindicatoName}</p>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <p>Ola <strong>${filiacao.nome}</strong>,</p>
              <p>Infelizmente sua solicitacao de filiacao nao foi aprovada.</p>
              ${filiacao.motivo_rejeicao ? `<p><strong>Motivo:</strong> ${filiacao.motivo_rejeicao}</p>` : ""}
              <p>Caso tenha duvidas, entre em contato conosco.</p>
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Atenciosamente,<br>${sindicatoName}</p>
            </div>
          </body>
          </html>
        `.replace(/\s+/g, ' ').trim();
      } else {
        subject = `Bem-vindo(a) ao ${sindicatoName}!`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
              ${logoSection}
              <h1 style="color: white; margin: 0;">Filiacao Aprovada!</h1>
              <p style="color: #d1fae5; margin: 10px 0 0 0;">${sindicatoName}</p>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <p>Ola <strong>${filiacao.nome}</strong>,</p>
              <p>Sua filiacao foi aprovada com sucesso! Seja bem-vindo(a) ao nosso sindicato.</p>
              ${filiacao.matricula ? `
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #065f46;">Sua matricula:</p>
                  <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #059669;">${filiacao.matricula}</p>
                </div>
              ` : ""}
              <p>Em breve voce recebera sua carteirinha digital e tera acesso a todos os beneficios.</p>
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Atenciosamente,<br>${sindicatoName}</p>
            </div>
          </body>
          </html>
        `.replace(/\s+/g, ' ').trim();
      }

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
        to: filiacao.email,
        subject,
        html: htmlContent,
      });

      await client.close();

      console.log("Email sent via SMTP");
    } else if (channel === "whatsapp") {
      // WhatsApp notification via Evolution API
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE");

      if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
        throw new Error("Evolution API nao configurada");
      }

      const phone = filiacao.telefone.replace(/\D/g, "");
      const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;

      const message = isRejection
        ? `Ola ${filiacao.nome}!\n\nInfelizmente sua solicitacao de filiacao ao ${sindicatoName} nao foi aprovada.\n\n${filiacao.motivo_rejeicao ? `Motivo: ${filiacao.motivo_rejeicao}\n\n` : ""}Caso tenha duvidas, entre em contato conosco.`
        : `Ola ${filiacao.nome}!\n\nSua filiacao ao ${sindicatoName} foi APROVADA!\n\n${filiacao.matricula ? `Sua matricula: *${filiacao.matricula}*\n\n` : ""}Em breve voce recebera sua carteirinha digital.\n\nSeja bem-vindo(a)!`;

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
