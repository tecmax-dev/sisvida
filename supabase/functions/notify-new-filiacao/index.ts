import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface NotifyRequest {
  filiacaoId: string;
  sindicatoId: string;
  nome: string;
  cpf: string;
  empresa?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { filiacaoId, sindicatoId, nome, cpf, empresa } = await req.json() as NotifyRequest;

    // Fetch sindicato data (manager email + phone)
    const { data: sindicato } = await supabase
      .from("union_entities")
      .select("razao_social, email_contato, email_institucional, telefone, logo_url")
      .eq("id", sindicatoId)
      .single();

    if (!sindicato) {
      throw new Error("Sindicato não encontrado");
    }

    const sindicatoName = sindicato.razao_social || "Sindicato";
    const managerEmail = sindicato.email_contato || sindicato.email_institucional;
    const managerPhone = sindicato.telefone;
    const logoUrl = sindicato.logo_url || "";

    const formattedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const results: { email?: boolean; whatsapp?: boolean } = {};

    // Send email to manager
    if (managerEmail) {
      try {
        const smtpHost = Deno.env.get("SMTP_HOST");
        const smtpPort = Deno.env.get("SMTP_PORT");
        const smtpUser = Deno.env.get("SMTP_USER");
        const smtpPass = Deno.env.get("SMTP_PASSWORD");
        const smtpFrom = Deno.env.get("SMTP_FROM");

        if (smtpHost && smtpUser && smtpPass && smtpFrom) {
          const logoSection = logoUrl ? `
            <div style="text-align: center; margin-bottom: 15px;">
              <img src="${logoUrl}" alt="${sindicatoName}" style="max-width: 150px; max-height: 80px; object-fit: contain;" />
            </div>
          ` : '';

          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
              <div style="background: #1e3a8a; padding: 30px; text-align: center;">
                ${logoSection}
                <h1 style="color: white; margin: 0; font-size: 20px;">Nova Solicitação de Filiação</h1>
                <p style="color: #e9d5ff; margin: 10px 0 0 0;">${sindicatoName}</p>
              </div>
              <div style="padding: 30px; background: white;">
                <p style="margin: 0 0 15px 0;">Uma nova solicitação de filiação foi recebida e aguarda aprovação:</p>
                <div style="background: #faf5ff; border-left: 4px solid #7c3aed; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                  <p style="margin: 0 0 8px 0;"><strong>Nome:</strong> ${nome}</p>
                  <p style="margin: 0 0 8px 0;"><strong>CPF:</strong> ${formattedCpf}</p>
                  ${empresa ? `<p style="margin: 0 0 8px 0;"><strong>Empresa:</strong> ${empresa}</p>` : ""}
                  <p style="margin: 0; color: #6b7280; font-size: 13px;"><strong>Data:</strong> ${now}</p>
                </div>
                <p style="margin: 20px 0 0 0; font-size: 14px; color: #6b7280;">
                  Acesse o sistema para revisar e aprovar esta solicitação.
                </p>
              </div>
              <div style="padding: 15px 30px; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8;">
                ${sindicatoName} — Sistema de Gestão Sindical
              </div>
            </body>
            </html>
          `.replace(/\s+/g, ' ').trim();

          const client = new SMTPClient({
            connection: {
              hostname: smtpHost,
              port: parseInt(smtpPort || "465"),
              tls: true,
              auth: { username: smtpUser, password: smtpPass },
            },
          });

          await client.send({
            from: smtpFrom,
            to: managerEmail,
            subject: `[SECMI] Nova Filiação Pendente - ${nome}`,
            html: htmlContent,
          });

          await client.close();
          results.email = true;
          console.log("Manager email sent to:", managerEmail);
        }
      } catch (emailErr) {
        console.error("Error sending manager email:", emailErr);
        results.email = false;
      }
    }

    // Send WhatsApp to manager
    if (managerPhone) {
      try {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
        const rawEvoInst = (Deno.env.get("EVOLUTION_INSTANCE") || '').trim();
        const evolutionInstance = /^[a-z0-9_-]{1,40}$/i.test(rawEvoInst) && rawEvoInst !== '2b7dbe72ab69c51e4d37e55329e10aeb' ? rawEvoInst : 'secmi';

        if (evolutionUrl && evolutionKey && evolutionInstance) {
          const phone = managerPhone.replace(/\D/g, "");
          const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;

          const message = `📋 *Nova Filiação Pendente*\n\n` +
            `Nome: *${nome}*\n` +
            `CPF: ${formattedCpf}\n` +
            `${empresa ? `Empresa: ${empresa}\n` : ""}` +
            `Data: ${now}\n\n` +
            `Acesse o sistema para revisar e aprovar.`;

          const response = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionKey,
            },
            body: JSON.stringify({ number: formattedPhone, text: message }),
          });

          if (response.ok) {
            results.whatsapp = true;
            console.log("Manager WhatsApp sent to:", formattedPhone);
          } else {
            console.error("WhatsApp error:", await response.text());
            results.whatsapp = false;
          }
        }
      } catch (whatsErr) {
        console.error("Error sending manager WhatsApp:", whatsErr);
        results.whatsapp = false;
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-new-filiacao:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
