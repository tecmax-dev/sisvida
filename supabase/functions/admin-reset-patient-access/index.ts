import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { patientId, channel } = await req.json();

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

    // Invalidate existing tokens
    await adminClient
      .from("patient_password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("patient_id", patientId)
      .is("used_at", null);

    // Generate 6-digit token
    const token = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

    // Extract birth year for identity verification
    const birthYear = patient.birth_date ? new Date(patient.birth_date).getFullYear() : null;

    // Insert new token (valid for 30 minutes)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await adminClient.from("patient_password_resets").insert({
      patient_id: patientId,
      token,
      expires_at: expiresAt,
      birth_year: birthYear,
    });

    if (channel === "email") {
      if (!patient.email) {
        return new Response(
          JSON.stringify({ error: "Associado não possui e-mail cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      // Build deep link to the PWA reset page with token pre-filled
      const resetLink = `https://prosindweb.com.br/app/recuperar-senha?token=${token}&email=${encodeURIComponent(patient.email || "")}`;

      const whatsappMessage = `🔐 *Redefinição de Senha - SECMI*

Olá, ${firstName}!

Recebemos uma solicitação para redefinir sua senha de acesso ao aplicativo.

Clique no link abaixo para criar uma nova senha:

${resetLink}

⏳ Este link é válido por *30 minutos*.

Se preferir, abra o aplicativo manualmente e use o código: *${token}*

_SECMI - Sindicato dos Comerciários_`;

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
          Authorization: authHeader,
        },
        body: JSON.stringify({
          phone: patient.phone,
          message: whatsappMessage,
          clinicId,
          type: "custom",
        }),
      });

      const whatsappResult = await whatsappResponse.json().catch(() => null);

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

      console.log(`Patient reset code sent via WhatsApp to ${patient.phone} by admin ${currentUser.id}`);

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
        patient_name: patient.name,
        sent_by: currentUser.email,
      },
    });

    return new Response(
      JSON.stringify({ success: true, channel }),
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
