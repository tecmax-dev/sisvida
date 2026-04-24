import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUCCESS_WHATSAPP_STATUSES = new Set(["SERVER_ACK", "DELIVERY_ACK", "READ"]);

function buildWhatsAppResetMessage(params: {
  firstName: string;
  email: string;
  code: string;
}) {
  return `🔐 *Redefinição de Senha - SECMI*

Olá, ${params.firstName}!

Recebemos uma solicitação para redefinir sua senha de acesso.

Seu código de recuperação:

*${params.code}*

Como usar:
• Abra o app SECMI e toque em *Esqueci minha senha*
• Informe o e-mail: ${params.email}
• Informe o código acima
• Cadastre sua nova senha

Este código é válido por 30 minutos.

_SECMI - Sindicato dos Comerciários_`;
}

async function waitForWhatsAppFinalStatus(
  supabase: any,
  messageId: string,
  timeoutMs = 20000,
  pollMs = 1500,
): Promise<{ status: string | null; error?: string }> {
  const startedAt = Date.now();
  let sawMessageRecord = false;
  let lastObservedStatus: string | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await supabase
      .from("whazing_messages")
      .select("status")
      .eq("message_id", messageId)
      .maybeSingle();

    if (error) {
      console.error("Error checking WhatsApp final status:", error);
      return { status: null, error: "Erro ao validar o status final do WhatsApp" };
    }

    const typedData = data as { status?: string } | null;
    if (typedData) {
      sawMessageRecord = true;
    }

    const status = typeof typedData?.status === "string" ? typedData.status.toUpperCase() : null;
    if (status) {
      lastObservedStatus = status;
    }

    if (status === "ERROR" || status === "FAILED") {
      return { status, error: "WhatsApp recusou a entrega da mensagem" };
    }

    if (status && SUCCESS_WHATSAPP_STATUSES.has(status)) {
      return { status };
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  if (sawMessageRecord) {
    return {
      status: lastObservedStatus ?? "PENDING",
    };
  }

  return {
    status: null,
    error: "Não foi possível confirmar a entrega do WhatsApp. Tente novamente.",
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const email: string = body.email;
    const channel: string = body.channel || "email";
    const checkOnly: boolean = body.checkOnly === true;

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Email invalido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing password reset request for: ${email}, channel: ${channel}, checkOnly: ${checkOnly}`);

    // Look up patient by email
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, name, email, phone, clinic_id, password_hash, is_active, birth_date")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (patientError) {
      console.error("Error looking up patient:", patientError);
    }

    // Check-only mode: return available channels without sending
    if (checkOnly) {
      if (!patient || !patient.password_hash) {
        // Don't reveal whether account exists
        return new Response(
          JSON.stringify({ hasEmail: false, hasPhone: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const maskedPhone = patient.phone
        ? patient.phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) *****-$4")
        : null;

      return new Response(
        JSON.stringify({
          hasEmail: !!patient.email,
          hasPhone: !!patient.phone,
          maskedPhone,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create reset token via RPC
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
          message: "Se o email estiver cadastrado, voce recebera um codigo de recuperacao.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = result.patient_name?.split(" ")[0] || "Associado";
    const token = result.token;

    // Store birth_year in the reset record
    if (patient?.birth_date) {
      const birthYear = new Date(patient.birth_date).getFullYear();
      await supabase
        .from("patient_password_resets")
        .update({ birth_year: birthYear })
        .eq("patient_id", patient.id)
        .eq("token", token)
        .is("used_at", null);
    }

    // ─── SEND VIA WHATSAPP ───
    if (channel === "whatsapp") {
      if (!patient?.phone) {
        return new Response(
          JSON.stringify({ error: "Associado não possui telefone cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!patient.clinic_id) {
        return new Response(
          JSON.stringify({ error: "Associado sem clínica vinculada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whatsappMessage = buildWhatsAppResetMessage({
        firstName,
        email,
        code: token,
      });

      const authHeader = `Bearer ${supabaseServiceKey}`;

      const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          phone: patient.phone,
          message: whatsappMessage,
          clinicId: patient.clinic_id,
          type: "custom",
          sendAsTextOnly: true,
        }),
      });

      const whatsappResult = await whatsappResponse.json().catch(() => null);

      if (!whatsappResponse.ok || whatsappResult?.success === false) {
        const errorMsg = whatsappResult?.error || "Erro ao enviar WhatsApp";
        console.error("WhatsApp send error:", { status: whatsappResponse.status, whatsappResult });
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: whatsappResponse.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const messageId = whatsappResult?.data?.key?.id;
      if (!messageId) {
        console.error("WhatsApp send did not return message id:", whatsappResult);
        return new Response(
          JSON.stringify({ error: "Envio aceito, mas sem protocolo de rastreamento do WhatsApp" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const finalStatus = await waitForWhatsAppFinalStatus(supabase, messageId);
      if (finalStatus.error) {
        return new Response(
          JSON.stringify({ error: finalStatus.error, status: finalStatus.status, messageId }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Self-service reset code sent via WhatsApp to ${patient.phone} with final status ${finalStatus.status}`);

      return new Response(
        JSON.stringify({
          success: true,
            message: "Instruções enviadas por WhatsApp.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SEND VIA EMAIL (default) ───
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      console.error("SMTP not configured");
      return new Response(
        JSON.stringify({ error: "Servico de email nao configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
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
            <p style="font-size: 36px; font-weight: bold; color: #059669; margin: 0; letter-spacing: 8px;">${token}</p>
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
    `.replace(/\s+/g, " ").trim();

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
      to: email,
      subject: "Codigo de Recuperacao de Senha - SECMI",
      html: htmlContent,
    });

    await client.close();

    console.log(`Self-service reset code sent via email to ${email}`);

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
