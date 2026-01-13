import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendAccessCodeRequest {
  type: "accounting_office" | "employer";
  entityId: string;
  recipientEmail: string;
  recipientName: string;
  clinicName: string;
  clinicSlug: string;
  updateEmail?: boolean;
}

const generateEmailHtml = (
  type: "accounting_office" | "employer",
  recipientName: string,
  clinicName: string,
  portalUrl: string,
  accessCode: string,
  identifier: string
): string => {
  const portalName = type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";
  const identifierLabel = type === "accounting_office" ? "E-mail" : "CNPJ";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
            🔑 Código de Acesso
          </h1>
          <p style="margin: 8px 0 0 0; color: #99f6e4; font-size: 14px;">
            ${portalName} - ${clinicName}
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Prezado(a) <strong>${recipientName}</strong>,
          </p>
          <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Segue seu código de acesso ao ${portalName}:
          </p>
          
          <!-- Access Code Box -->
          <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #14b8a6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #0f766e; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
              Seu Código de Acesso
            </p>
            <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: bold; color: #0d9488; letter-spacing: 8px; padding: 16px 0;">
              ${accessCode}
            </div>
          </div>
          
          <!-- Instructions -->
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 15px; font-weight: 600;">
              📋 Como acessar:
            </h3>
            <ol style="margin: 0; padding: 0 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
              <li>Acesse o link: <a href="${portalUrl}" style="color: #0d9488; font-weight: 500;">${portalUrl}</a></li>
              <li>Informe seu ${identifierLabel}: <strong>${identifier}</strong></li>
              <li>Digite o código de acesso: <strong>${accessCode}</strong></li>
            </ol>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" target="_blank" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(20, 184, 166, 0.4);">
              🚀 Acessar Portal
            </a>
          </div>
          
          <!-- Security Note -->
          <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #92400e; font-size: 13px;">
              ⚠️ <strong>Importante:</strong> Este código é pessoal e intransferível. Não compartilhe com terceiros.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
            Em caso de dúvidas, entre em contato conosco.
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            ${clinicName}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-portal-access-code: Received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: SendAccessCodeRequest = await req.json();
    console.log("send-portal-access-code: Processing request for", data.type, data.entityId);

    // Validate required fields
    if (!data.type || !data.entityId || !data.recipientEmail || !data.recipientName || !data.clinicName || !data.clinicSlug) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios não preenchidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.recipientEmail)) {
      return new Response(
        JSON.stringify({ error: "Email do destinatário inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessCode: string;
    let identifier: string;
    let portalUrl: string;

    if (data.type === "accounting_office") {
      // Fetch accounting office data
      const { data: office, error: fetchError } = await supabase
        .from("accounting_offices")
        .select("access_code, email")
        .eq("id", data.entityId)
        .single();

      if (fetchError || !office) {
        console.error("Error fetching accounting office:", fetchError);
        return new Response(
          JSON.stringify({ error: "Escritório não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessCode = office.access_code;
      identifier = data.recipientEmail;
      portalUrl = `${req.headers.get("origin") || "https://app.eclini.com.br"}/portal-contador/${data.clinicSlug}`;

      // Update email if different and requested
      if (data.updateEmail && data.recipientEmail !== office.email) {
        const { error: updateError } = await supabase
          .from("accounting_offices")
          .update({ email: data.recipientEmail.toLowerCase().trim() })
          .eq("id", data.entityId);

        if (updateError) {
          console.error("Error updating email:", updateError);
        } else {
          console.log("Email updated to:", data.recipientEmail);
        }
      }
    } else {
      // Fetch employer data
      const { data: employer, error: fetchError } = await supabase
        .from("employers")
        .select("access_code, cnpj, email")
        .eq("id", data.entityId)
        .single();

      if (fetchError || !employer) {
        console.error("Error fetching employer:", fetchError);
        return new Response(
          JSON.stringify({ error: "Empresa não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate access code if not exists
      if (!employer.access_code) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let newCode = "";
        for (let i = 0; i < 6; i++) {
          newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const { error: updateError } = await supabase
          .from("employers")
          .update({ access_code: newCode })
          .eq("id", data.entityId);

        if (updateError) {
          console.error("Error updating access code:", updateError);
          return new Response(
            JSON.stringify({ error: "Erro ao gerar código de acesso" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessCode = newCode;
      } else {
        accessCode = employer.access_code;
      }

      // Format CNPJ for display
      const cleanCnpj = employer.cnpj.replace(/\D/g, "");
      identifier = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
      portalUrl = `${req.headers.get("origin") || "https://app.eclini.com.br"}/portal-empresa/${data.clinicSlug}`;

      // Update email if different and requested
      if (data.updateEmail && data.recipientEmail !== employer.email) {
        const { error: updateError } = await supabase
          .from("employers")
          .update({ email: data.recipientEmail.toLowerCase().trim() })
          .eq("id", data.entityId);

        if (updateError) {
          console.error("Error updating email:", updateError);
        } else {
          console.log("Email updated to:", data.recipientEmail);
        }
      }
    }

    const html = generateEmailHtml(
      data.type,
      data.recipientName,
      data.clinicName,
      portalUrl,
      accessCode,
      identifier
    );

    const portalName = data.type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";
    const subject = `🔑 Seu Código de Acesso - ${portalName}`;

    console.log("send-portal-access-code: Sending email to", data.recipientEmail);

    const emailResponse = await resend.emails.send({
      from: `${data.clinicName} <onboarding@resend.dev>`,
      to: [data.recipientEmail],
      subject,
      html,
    });

    console.log("send-portal-access-code: Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-portal-access-code: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao enviar email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
