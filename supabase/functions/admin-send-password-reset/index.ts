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

    // Check permissions
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

    const { targetUserId, channel, appBaseUrl } = await req.json();

    if (!targetUserId || !channel) {
      return new Response(
        JSON.stringify({ error: "targetUserId e channel são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user info
    const { data: targetAuthUser, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetError || !targetAuthUser?.user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetEmail = targetAuthUser.user.email;
    if (!targetEmail) {
      return new Response(
        JSON.stringify({ error: "Usuário não possui email cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get profile name
    const { data: profile } = await adminClient
      .from("profiles")
      .select("name")
      .eq("id", targetUserId)
      .maybeSingle();

    const userName = profile?.name || "Usuário";
    const firstName = userName.split(" ")[0];

    // Generate recovery link
    const redirectTo = appBaseUrl ? `${appBaseUrl}/auth` : `${supabaseUrl}/auth`;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: targetEmail,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Error generating recovery link:", linkError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the reset URL with hash token
    const hashedToken = linkData.properties.hashed_token;
    const resetUrl = `${appBaseUrl || "https://prosindweb.com.br"}/auth#type=recovery&access_token=${hashedToken}`;

    if (channel === "email") {
      // Send via SMTP
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
            <h1 style="color: white; margin: 0; font-size: 24px;">ProSindWeb</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Redefinicao de Senha</p>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Ola, ${firstName}!</h2>
            <p style="color: #666; line-height: 1.6;">
              Um administrador solicitou a redefinicao da sua senha de acesso ao sistema.
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Redefinir Minha Senha
              </a>
            </div>
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              <strong>Este link e valido por 1 hora.</strong> Se voce nao solicitou esta alteracao, entre em contato com o administrador.
            </p>
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              Caso o botao nao funcione, copie e cole o link abaixo no seu navegador:
            </p>
            <p style="color: #059669; font-size: 12px; word-break: break-all;">${resetUrl}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              Este e um email automatico, por favor nao responda.<br>
              ProSindWeb - Todos os direitos reservados.
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
        to: targetEmail,
        subject: "Redefinicao de Senha - ProSindWeb",
        html: htmlContent,
      });

      await client.close();

      console.log(`Password reset email sent to ${targetEmail} by admin ${currentUser.id}`);

    } else if (channel === "whatsapp") {
      // Get user's phone from profile
      const phone = profile?.name ? null : null; // We need phone from profile
      const { data: profileWithPhone } = await adminClient
        .from("profiles")
        .select("phone")
        .eq("id", targetUserId)
        .maybeSingle();

      const userPhone = profileWithPhone?.phone;
      if (!userPhone) {
        return new Response(
          JSON.stringify({ error: "Usuário não possui telefone cadastrado no perfil" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get clinic for WhatsApp sending
      const { data: userRole } = await adminClient
        .from("user_roles")
        .select("clinic_id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!userRole?.clinic_id) {
        return new Response(
          JSON.stringify({ error: "Usuário não vinculado a nenhuma clínica" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whatsappMessage = `🔐 *Redefinição de Senha - ProSindWeb*

Olá, ${firstName}!

Um administrador solicitou a redefinição da sua senha de acesso ao sistema.

Clique no link abaixo para criar uma nova senha:

${resetUrl}

⏳ Este link é válido por *1 hora*.

Se você não solicitou esta alteração, entre em contato com o administrador.

_ProSindWeb - Gestão Sindical_`;

      const { error: whatsappError } = await adminClient.functions.invoke("send-whatsapp", {
        body: {
          phone: userPhone,
          message: whatsappMessage,
          clinicId: userRole.clinic_id,
          type: "custom",
        },
      });

      if (whatsappError) {
        console.error("WhatsApp send error:", whatsappError);
        return new Response(
          JSON.stringify({ error: "Erro ao enviar WhatsApp" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Password reset WhatsApp sent to ${userPhone} by admin ${currentUser.id}`);
    } else {
      return new Response(
        JSON.stringify({ error: "Canal inválido. Use 'email' ou 'whatsapp'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    await adminClient.from("audit_logs").insert({
      user_id: currentUser.id,
      action: "send_password_reset",
      entity_type: "user",
      entity_id: targetUserId,
      details: {
        channel,
        target_user_email: targetEmail,
        target_user_name: userName,
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
