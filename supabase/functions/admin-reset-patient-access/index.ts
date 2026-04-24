import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUCCESS_WHATSAPP_STATUSES = new Set(["SERVER_ACK", "DELIVERY_ACK", "READ"]);

function buildWhatsAppResetMessage(params: {
  firstName: string;
  email?: string | null;
  code: string;
}) {
  const emailLine = params.email
    ? `• E-mail da conta: ${params.email}`
    : "• E-mail da conta: use o e-mail cadastrado no aplicativo";

  return `🔐 *Redefinição de Senha - SECMI*

Olá, ${params.firstName}!

Recebemos uma solicitação para redefinir sua senha de acesso.

Seu código de recuperação:

*${params.code}*

Como usar:
• Abra o app SECMI e toque em *Esqueci minha senha*
${emailLine}
• Informe o código acima
• Cadastre sua nova senha

Este código é válido por 30 minutos.

_SECMI - Sindicato dos Comerciários_`;
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

      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = Deno.env.get("SMTP_PORT");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASSWORD");
      const smtpFrom = Deno.env.get("SMTP_FROM");

      if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
        return new Response(
          JSON.stringify({ error: "Serviço de email não configurado" }),
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
              Um administrador solicitou a redefinicao da sua senha de acesso ao aplicativo.
            </p>
            <div style="background-color: #f0fdf4; border: 2px solid #059669; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Seu codigo de recuperacao:</p>
              <p style="font-size: 36px; font-weight: bold; color: #059669; margin: 0; letter-spacing: 8px;">${token}</p>
            </div>
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              <strong>Este codigo e valido por 30 minutos.</strong>
            </p>
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              Abra o aplicativo e utilize a opcao "Esqueci minha senha" para inserir este codigo e criar uma nova senha.
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
        to: patient.email,
        subject: "Codigo de Recuperacao de Senha - SECMI",
        html: htmlContent,
      });

      await client.close();

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
          sendAsTextOnly: true,
        }),
      });

      const whatsappResult = await whatsappResponse.json().catch(() => null);
      console.log(`[admin-reset-patient-access${traceId ? `:${traceId}` : ""}] WhatsApp provider response`, whatsappResult);

      if (!whatsappResponse.ok || whatsappResult?.success === false) {
        const whatsappErrorMessage = whatsappResult?.error || "Erro ao enviar WhatsApp";
        console.error("WhatsApp send error:", {
          status: whatsappResponse.status,
          whatsappResult,
        });
        return new Response(
          JSON.stringify({ error: whatsappErrorMessage }),
          { status: whatsappResponse.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const usedFallbackChannel = whatsappResult?.data?.fallback === "whazing_apioficial";
      const messageId = whatsappResult?.data?.key?.id;
      if (!messageId && !usedFallbackChannel) {
        console.error("WhatsApp send did not return message id:", whatsappResult);
        return new Response(
          JSON.stringify({ error: "Envio aceito, mas sem protocolo de rastreamento do WhatsApp" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!usedFallbackChannel) {
        const finalStatus = await waitForWhatsAppFinalStatus(adminClient, messageId);
        if (finalStatus.error) {
          return new Response(
            JSON.stringify({ error: finalStatus.error, status: finalStatus.status, messageId }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Patient reset code sent via WhatsApp to ${patient.phone} by admin ${currentUser.id} with final status ${finalStatus.status}`);
      } else {
        console.log(`Patient reset code sent via WhatsApp fallback channel to ${patient.phone} by admin ${currentUser.id}`);
      }

    } else {
      return new Response(
        JSON.stringify({ error: "Canal inválido. Use 'email' ou 'whatsapp'" }),
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
