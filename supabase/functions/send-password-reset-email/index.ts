import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUCCESS_WHATSAPP_STATUSES = new Set(["SERVER_ACK", "DELIVERY_ACK", "READ"]);
const META_SUCCESS_STATUSES = new Set(["DELIVERED", "READ"]);
const META_ACCEPTED_STATUSES = new Set(["SENT", "DELIVERED", "READ"]);

function buildWhatsAppPhoneCandidates(rawPhone: string): string[] {
  let digits = rawPhone.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);

  const candidates = new Set<string>([digits]);
  if (digits.length === 10) candidates.add(`${digits.slice(0, 2)}9${digits.slice(2)}`);
  if (digits.length === 11 && digits[2] === "9") candidates.add(`${digits.slice(0, 2)}${digits.slice(3)}`);

  return [...candidates].filter(Boolean);
}

function buildWhatsAppResetMessage(params: {
  firstName: string;
  email: string;
  code: string;
}) {
  const resetLink = `https://prosindweb.com.br/sindicato/recuperar-senha?email=${encodeURIComponent(params.email)}&code=${params.code}`;
  
  return `Olá, ${params.firstName}, tudo bem?

Aqui é do SECMI. Você pediu para entrar novamente no aplicativo.

Para continuar, toque no link abaixo:
${resetLink}

Se o link não funcionar, você pode informar seu e-mail (${params.email}) e o código de confirmação: ${params.code}

O código vale por 30 minutos.

Equipe SECMI`;
}

function buildSmsResetMessage(firstName: string, code: string): string {
  return `SECMI: Ola ${firstName}, seu codigo de recuperacao de senha e ${code}. Valido por 30 minutos. Nao compartilhe.`;
}

function buildSmsPhoneCandidates(rawPhone: string): string[] {
  let digits = rawPhone.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);

  const candidates = new Set<string>();
  if (digits.length === 10) {
    candidates.add(`55${digits.slice(0, 2)}9${digits.slice(2)}`);
    candidates.add(`55${digits}`);
  } else if (digits.length === 11) {
    candidates.add(`55${digits}`);
    if (digits[2] === "9") candidates.add(`55${digits.slice(0, 2)}${digits.slice(3)}`);
  } else {
    candidates.add(`55${digits}`);
  }
  return [...candidates].filter((c) => c.length >= 12 && c.length <= 13);
}

async function sendResetCodeBySms(params: {
  phone: string;
  firstName: string;
  token: string;
}): Promise<{ success: boolean; error?: string; provider?: unknown }> {
  const bearer = Deno.env.get("APIBRASIL_BEARER_TOKEN");
  const deviceToken = Deno.env.get("APIBRASIL_SMS_DEVICE_TOKEN");

  if (!bearer || !deviceToken) {
    return { success: false, error: "Servico de SMS nao configurado" };
  }

  const message = buildSmsResetMessage(params.firstName, params.token);
  const candidates = buildSmsPhoneCandidates(params.phone);

  if (candidates.length === 0) {
    return { success: false, error: "Numero de telefone invalido para SMS" };
  }

  let lastError: string | null = null;

  for (const number of candidates) {
    try {
      const response = await fetch("https://gateway.apibrasil.io/api/v2/sms/sendSimpleSms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${bearer}`,
          DeviceToken: deviceToken,
        },
        body: JSON.stringify({ number, body: message }),
      });

      const raw = await response.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }

      const errorFlag = data && typeof data === "object" && data.error === true;
      if (!response.ok || errorFlag) {
        lastError = (data && typeof data === "object" && (data.message || data.error_message)) || `Erro HTTP ${response.status}`;
        console.warn("API Brasil SMS attempt failed:", { number, status: response.status, data });
        continue;
      }

      console.log(`SMS de reset enviado via API Brasil para ${number}`);
      return { success: true, provider: data };
    } catch (err: any) {
      lastError = err?.message || "Falha de rede ao enviar SMS";
      console.error("API Brasil SMS network error:", err);
    }
  }

  return { success: false, error: lastError || "Nao foi possivel enviar SMS" };
}

function buildResetEmailHtmlWithLink(firstName: string, token: string, email: string): string {
  const appUrl = `https://prosindweb.com.br/sindicato/recuperar-senha?email=${encodeURIComponent(email)}`;
  return `
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
          <div style="text-align: center; margin: 25px 0;">
            <a href="${appUrl}" style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Abrir app e redefinir senha
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px; text-align: center;">
            Ou acesse manualmente: <a href="${appUrl}" style="color: #059669;">${appUrl}</a><br>
            e informe o codigo acima na tela de recuperacao.
          </p>
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
}

async function sendResetCodeByEmail(params: {
  toEmail: string;
  firstName: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = Deno.env.get("SMTP_PORT");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASSWORD");
  const smtpFrom = Deno.env.get("SMTP_FROM");

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return { success: false, error: "Servico de email nao configurado" };
  }

  try {
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
      to: params.toEmail,
      subject: "Codigo de Recuperacao de Senha - SECMI",
      html: buildResetEmailHtmlWithLink(params.firstName, params.token, params.toEmail),
    });

    await client.close();
    return { success: true };
  } catch (err: any) {
    console.error("SMTP send error:", err);
    return { success: false, error: err?.message || "Falha ao enviar e-mail" };
  }
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

async function waitForMetaDeliveryStatus(
  supabase: any,
  messageId: string,
  timeoutMs = 25000,
  pollMs = 1500,
): Promise<{ status: string | null; error?: string }> {
  const startedAt = Date.now();
  let lastObservedStatus: string | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await supabase
      .from("whatsapp_audit_logs")
      .select("content, metadata")
      .eq("metadata->>message_id", messageId)
      .eq("message_type", "meta_status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error checking Meta WhatsApp status:", error);
      return { status: null, error: "Erro ao validar o status final do WhatsApp" };
    }

    const status = String(data?.content || data?.metadata?.status || "").toUpperCase();
    if (status) lastObservedStatus = status;
    if (status === "FAILED") {
      const metaError = data?.metadata?.errors?.[0];
      const code = metaError?.code ? ` (${metaError.code})` : "";
      return { status, error: `WhatsApp recusou a entrega da mensagem${code}` };
    }

    if (META_SUCCESS_STATUSES.has(status) || META_ACCEPTED_STATUSES.has(status)) return { status };

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  // Meta accepted the message and did not report failure within the polling
  // window. Do not retry another phone variation here: that resends the same
  // password reset multiple times and causes a false error for the user.
  return { status: lastObservedStatus ?? "ACCEPTED" };
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
    let email: string = body.email;
    const cpfInput: string | undefined = body.cpf;
    const channel: string = body.channel || "email";
    const checkOnly: boolean = body.checkOnly === true;

    // ─── CPF-only entrypoint (PWA /sindicato): resolve CPF → email and force SMS ───
    if (cpfInput && !email) {
      const cpfDigits = String(cpfInput).replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return new Response(
          JSON.stringify({ error: "CPF invalido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: byCpf } = await supabase
        .from("patients")
        .select("email, is_active")
        .eq("cpf", cpfDigits)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Always respond generically when CPF doesn't match an active patient
      if (!byCpf?.email) {
        return new Response(
          JSON.stringify({
            success: true,
            channel: "sms",
            message: "Se o CPF estiver cadastrado, voce recebera um codigo por SMS.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      email = byCpf.email;
    }

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
    // ─── SEND VIA SMS (API Brasil) ───
    if (channel === "sms") {
      if (!patient?.phone) {
        return new Response(
          JSON.stringify({ error: "Associado não possui telefone cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const smsResult = await sendResetCodeBySms({ phone: patient.phone, firstName, token });
      if (!smsResult.success) {
        return new Response(
          JSON.stringify({ error: smsResult.error || "Falha ao enviar SMS" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, channel: "sms", message: "Código enviado por SMS." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

      let whatsappFailed = true;
      let whatsappFailureReason: string | null = null;

      for (const phoneCandidate of buildWhatsAppPhoneCandidates(patient.phone)) {
        const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({
            phone: phoneCandidate,
            message: whatsappMessage,
            clinicId: patient.clinic_id,
            type: "custom",
            templateName: "recuperacao_senha_link_v2",
            templateComponents: [firstName, `email=${encodeURIComponent(email)}&code=${token}`],
            sendAsTextOnly: false,
          }),
        });

        const whatsappResult = await whatsappResponse.json().catch(() => null);
        if (!whatsappResponse.ok || whatsappResult?.success === false) {
          whatsappFailureReason = whatsappResult?.error || "Erro ao enviar WhatsApp";
          console.error("WhatsApp send error:", { phoneCandidate, status: whatsappResponse.status, whatsappResult });
          continue;
        }

        const usedFallbackChannel = whatsappResult?.data?.fallback === "whazing_apioficial";
        const metaTemplateMessageId = whatsappResult?.method === "meta_template_direct" ? whatsappResult?.data?.message_id : null;
        const messageId = whatsappResult?.data?.key?.id || metaTemplateMessageId;

        if (!messageId && !usedFallbackChannel) {
          whatsappFailureReason = "WhatsApp não retornou protocolo de rastreamento";
          console.error("WhatsApp send did not return message id:", whatsappResult);
          continue;
        }

        const finalStatus = metaTemplateMessageId
          ? await waitForMetaDeliveryStatus(supabase, metaTemplateMessageId)
          : usedFallbackChannel
            ? { status: "SENT" }
            : await waitForWhatsAppFinalStatus(supabase, messageId);

        if (finalStatus.error) {
          whatsappFailureReason = finalStatus.error;
          console.warn("WhatsApp candidate failed final delivery:", { phoneCandidate, messageId, finalStatus });
          continue;
        }

        whatsappFailed = false;
        console.log(`Reset code delivered via WhatsApp to ${phoneCandidate} with final status ${finalStatus.status}`);
        break;
      }

      // Sucesso WhatsApp → resposta direta
      if (!whatsappFailed) {
        return new Response(
          JSON.stringify({
            success: true,
            channel: "whatsapp",
            message: "Instruções enviadas por WhatsApp.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Falha do WhatsApp → fallback automático para e-mail
      console.warn(`WhatsApp falhou (${whatsappFailureReason}). Acionando fallback de e-mail para ${email}`);

      if (!email) {
        return new Response(
          JSON.stringify({
            error: "WhatsApp indisponível e o associado não possui e-mail cadastrado para fallback",
            whatsappError: whatsappFailureReason,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailFallback = await sendResetCodeByEmail({ toEmail: email, firstName, token });

      if (!emailFallback.success) {
        return new Response(
          JSON.stringify({
            error: `WhatsApp indisponível e fallback por e-mail também falhou: ${emailFallback.error}`,
            whatsappError: whatsappFailureReason,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Reset code sent via EMAIL fallback to ${email}`);

      return new Response(
        JSON.stringify({
          success: true,
          channel: "email",
          fallback: true,
          whatsappError: whatsappFailureReason,
          message: `WhatsApp indisponível para este número. Código enviado por e-mail para ${email}.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SEND VIA EMAIL (default) ───
    const emailSend = await sendResetCodeByEmail({ toEmail: email, firstName, token });
    if (!emailSend.success) {
      return new Response(
        JSON.stringify({ error: emailSend.error || "Falha ao enviar e-mail" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Self-service reset code sent via email to ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        channel: "email",
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
