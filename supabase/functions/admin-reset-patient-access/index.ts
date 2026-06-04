import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import {
  ApiBrasilSmsService,
  buildBrazilianPhoneCandidates,
  sanitizeApiBrasilError,
} from "../_shared/apibrasil-sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUCCESS_WHATSAPP_STATUSES = new Set(["SERVER_ACK", "DELIVERY_ACK", "READ"]);

function buildResetEmailHtml(firstName: string, token: string, email = ""): string {
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
              Um administrador solicitou a redefinicao da sua senha de acesso ao aplicativo.
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
      html: buildResetEmailHtml(params.firstName, params.token, params.toEmail),
    });

    await client.close();
    return { success: true };
  } catch (err: any) {
    console.error("SMTP send error:", err);
    return { success: false, error: err?.message || "Falha ao enviar e-mail" };
  }
}

function buildWhatsAppResetMessage(params: {
  firstName: string;
  email?: string | null;
  code: string;
}) {
  const emailParam = params.email ? encodeURIComponent(params.email) : "";
  const resetLink = `https://prosindweb.com.br/sindicato/recuperar-senha?email=${emailParam}&code=${params.code}`;
  
  const emailLine = params.email
    ? `seu e-mail (${params.email})`
    : "o e-mail cadastrado no aplicativo";

  return `Olá, ${params.firstName}, tudo bem?

Aqui é do SECMI. Um administrador solicitou o reset da sua senha.

Para continuar e definir sua nova senha, toque no link abaixo:
${resetLink}

Se o link não funcionar, você pode informar ${emailLine} e o código de confirmação: ${params.code}

O código vale por 30 minutos.

Equipe SECMI`;
}

function buildSmsResetMessage(firstName: string, code: string): string {
  return `SECMI: Ola ${firstName}, seu codigo de recuperacao de senha e ${code}. Valido por 30 minutos. Nao compartilhe.`;
}

async function sendResetCodeBySms(params: {
  phone: string;
  firstName: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  let sms: ApiBrasilSmsService;
  try {
    sms = ApiBrasilSmsService.fromEnv({ timeoutMs: 15_000 });
  } catch {
    return { success: false, error: "Servico de SMS nao configurado" };
  }

  const message = buildSmsResetMessage(params.firstName, params.token);
  const candidates = buildBrazilianPhoneCandidates(params.phone);

  if (candidates.length === 0) {
    return { success: false, error: "Numero de telefone invalido para SMS" };
  }

  let lastError: string | null = null;

  for (const number of candidates) {
    const result = await sms.send({ number, message });
    if (result.ok) {
      console.log(`SMS de reset enviado via Comtele para ${number}`);
      return { success: true };
    }
    lastError = result.error.message;
    console.warn("Comtele SMS attempt failed:", { number, error: result.error });
  }

  return { success: false, error: sanitizeApiBrasilError(lastError) };
}

async function waitForWhatsAppFinalStatus(
  adminClient: any,
  messageId: string,
  timeoutMs = 20000,
  pollMs = 1500,
): Promise<{ status: string | null; error?: string }> {
  const startedAt = Date.now();
  let sawMessageRecord = false;
  let lastObservedStatus: string | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await adminClient
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin
    const supabaseUser = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check permissions (super_admin, owner, admin, manage_users, change_password)
    const { data: superAdmin } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    let hasPermission = !!superAdmin;
    if (!hasPermission) {
      const { data: userRole } = await adminClient
        .from("user_roles")
        .select("access_group_id, role")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (userRole?.access_group_id) {
        const { data: perms } = await adminClient
          .from("access_group_permissions")
          .select("permission_key")
          .eq("access_group_id", userRole.access_group_id)
          .in("permission_key", ["manage_users", "change_password"]);
        hasPermission = (perms?.length ?? 0) > 0;
      } else if (userRole?.role === "owner" || userRole?.role === "admin") {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { patientId, channel, traceId } = await req.json();

    if (!patientId || !channel) {
      return new Response(
        JSON.stringify({ error: "patientId e channel são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get patient info
    const { data: patient, error: patientError } = await adminClient
      .from("patients")
      .select("id, name, email, phone, clinic_id, password_hash, is_active, birth_date")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return new Response(
        JSON.stringify({ error: "Associado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!patient.is_active) {
      return new Response(
        JSON.stringify({ error: "Associado está inativo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!patient.password_hash) {
      console.log(`Patient ${patientId} has no password_hash yet; proceeding with reset token delivery for first password definition`);
    }

    const firstName = patient.name?.split(" ")[0] || "Associado";

    if (channel === "email") {
      if (!patient.email) {
        return new Response(
          JSON.stringify({ error: "Associado não possui e-mail cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient
        .from("patient_password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("patient_id", patientId)
        .is("used_at", null);

      const token = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      const birthYear = patient.birth_date ? new Date(patient.birth_date).getFullYear() : null;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await adminClient.from("patient_password_resets").insert({
        patient_id: patientId,
        token,
        expires_at: expiresAt,
        birth_year: birthYear,
      });

      const emailSend = await sendResetCodeByEmail({
        toEmail: patient.email,
        firstName,
        token,
      });
      if (!emailSend.success) {
        return new Response(
          JSON.stringify({ error: emailSend.error || "Falha ao enviar e-mail" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Patient reset code sent via email to ${patient.email} by admin ${currentUser.id}`);

    } else if (channel === "whatsapp") {
      if (!patient.phone) {
        return new Response(
          JSON.stringify({ error: "Associado não possui telefone cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[admin-reset-patient-access${traceId ? `:${traceId}` : ""}] Sending WhatsApp reset for patient ${patientId} to ${patient.phone}`);

      // Generate and persist a 6-digit recovery code (same table used by self-service flow)
      await adminClient
        .from("patient_password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("patient_id", patientId)
        .is("used_at", null);

      const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      const birthYear = patient.birth_date ? new Date(patient.birth_date).getFullYear() : null;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await adminClient.from("patient_password_resets").insert({
        patient_id: patientId,
        token: code,
        expires_at: expiresAt,
        birth_year: birthYear,
      });

      const whatsappMessage = buildWhatsAppResetMessage({
        firstName,
        email: patient.email,
        code,
      });

      const clinicId = patient.clinic_id;
      if (!clinicId) {
        return new Response(
          JSON.stringify({ error: "Associado sem clínica vinculada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          phone: patient.phone,
          message: whatsappMessage,
          clinicId,
           type: "custom",
            templateName: "recuperacao_senha_link_v2",
            templateComponents: [
              firstName,
              `email=${encodeURIComponent(patient.email || "")}&code=${code}`
            ],
           sendAsTextOnly: false,
        }),
      });

      const whatsappResult = await whatsappResponse.json().catch(() => null);
      console.log(`[admin-reset-patient-access${traceId ? `:${traceId}` : ""}] WhatsApp provider response`, whatsappResult);

      // Detecta falha do WhatsApp para acionar fallback automático por e-mail.
      let whatsappFailed = false;
      let whatsappFailureReason: string | null = null;

      if (!whatsappResponse.ok || whatsappResult?.success === false) {
        whatsappFailed = true;
        whatsappFailureReason = whatsappResult?.error || "Erro ao enviar WhatsApp";
        console.error("WhatsApp send error:", { status: whatsappResponse.status, whatsappResult });
      } else {
        const usedFallbackChannel = whatsappResult?.data?.fallback === "whazing_apioficial";
        const metaTemplateMessageId = whatsappResult?.method === "meta_template_direct"
          ? whatsappResult?.data?.message_id
          : null;
        const messageId = whatsappResult?.data?.key?.id || metaTemplateMessageId;
        if (!messageId && !usedFallbackChannel) {
          whatsappFailed = true;
          whatsappFailureReason = "WhatsApp não retornou protocolo de rastreamento";
        } else if (metaTemplateMessageId) {
          console.log(`Patient reset code accepted by Meta WhatsApp to ${patient.phone} by admin ${currentUser.id} with message id ${metaTemplateMessageId}`);
        } else if (!usedFallbackChannel) {
          const finalStatus = await waitForWhatsAppFinalStatus(adminClient, messageId);
          if (finalStatus.error) {
            whatsappFailed = true;
            whatsappFailureReason = finalStatus.error;
          } else {
            console.log(`Patient reset code sent via WhatsApp to ${patient.phone} by admin ${currentUser.id} with final status ${finalStatus.status}`);
          }
        } else {
          console.log(`Patient reset code sent via WhatsApp fallback channel to ${patient.phone} by admin ${currentUser.id}`);
        }
      }

      // Se WhatsApp falhou, tenta automaticamente por e-mail.
      if (whatsappFailed) {
        console.warn(`[admin-reset-patient-access] WhatsApp falhou (${whatsappFailureReason}). Tentando fallback por e-mail para paciente ${patientId}`);

        if (!patient.email) {
          return new Response(
            JSON.stringify({
              error: `WhatsApp indisponível para este número e o associado não possui e-mail cadastrado. ${whatsappFailureReason}`,
              whatsappError: whatsappFailureReason,
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const fallbackEmail = await sendResetCodeByEmail({
          toEmail: patient.email,
          firstName,
          token: code,
        });

        if (!fallbackEmail.success) {
          return new Response(
            JSON.stringify({
              error: `WhatsApp indisponível e fallback por e-mail também falhou: ${fallbackEmail.error}`,
              whatsappError: whatsappFailureReason,
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Audit log informando o fallback
        await adminClient.from("audit_logs").insert({
          user_id: currentUser.id,
          action: "admin_reset_patient_access",
          entity_type: "patient",
          entity_id: patientId,
          details: {
            channel: "email",
            requested_channel: "whatsapp",
            fallback: true,
            whatsapp_error: whatsappFailureReason,
            trace_id: traceId ?? null,
            patient_name: patient.name,
            sent_by: currentUser.email,
          },
        });

        console.log(`Patient reset code sent via EMAIL fallback to ${patient.email} by admin ${currentUser.id}`);

        return new Response(
          JSON.stringify({
            success: true,
            channel: "email",
            fallback: true,
            whatsappError: whatsappFailureReason,
            message: `WhatsApp indisponível para este número. Código enviado por e-mail para ${patient.email}.`,
            traceId: traceId ?? null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    } else if (channel === "sms") {
      if (!patient.phone) {
        return new Response(
          JSON.stringify({ error: "Associado não possui telefone cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[admin-reset-patient-access${traceId ? `:${traceId}` : ""}] Sending SMS reset for patient ${patientId} to ${patient.phone}`);

      await adminClient
        .from("patient_password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("patient_id", patientId)
        .is("used_at", null);

      const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      const birthYear = patient.birth_date ? new Date(patient.birth_date).getFullYear() : null;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await adminClient.from("patient_password_resets").insert({
        patient_id: patientId,
        token: code,
        expires_at: expiresAt,
        birth_year: birthYear,
      });

      const smsResult = await sendResetCodeBySms({
        phone: patient.phone,
        firstName,
        token: code,
      });

      if (!smsResult.success) {
        return new Response(
          JSON.stringify({ error: smsResult.error || "Falha ao enviar SMS" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Patient reset code sent via SMS to ${patient.phone} by admin ${currentUser.id}`);

    } else {
      return new Response(
        JSON.stringify({ error: "Canal inválido. Use 'email', 'whatsapp' ou 'sms'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    await adminClient.from("audit_logs").insert({
      user_id: currentUser.id,
      action: "admin_reset_patient_access",
      entity_type: "patient",
      entity_id: patientId,
      details: {
        channel,
        trace_id: traceId ?? null,
        patient_name: patient.name,
        sent_by: currentUser.email,
      },
    });

    return new Response(
      JSON.stringify({ success: true, channel, traceId: traceId ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
