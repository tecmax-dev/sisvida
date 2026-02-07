import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// ============ CORS CENTRALIZADO ============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Helpers para garantir CORS em TODAS as respostas
function corsResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function corsError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SendAccessCodeRequest {
  type: "accounting_office" | "employer";
  entityId: string;
  recipientEmail?: string;
  recipientName: string;
  clinicName: string;
  clinicSlug: string;
  clinicId?: string;
  updateEmail?: boolean;
  updatePhone?: boolean;
  phone?: string;
  whatsappOnly?: boolean;
}

const generateEmailHtml = (
  type: "accounting_office" | "employer",
  recipientName: string,
  clinicName: string,
  portalUrl: string,
  accessCode: string,
  identifier: string,
  logoUrl?: string
): string => {
  const portalName = type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";
  const identifierLabel = type === "accounting_office" ? "E-mail" : "CNPJ";

  const logoSection = logoUrl 
    ? `<img src="${logoUrl}" alt="Logo" style="max-height: 50px; max-width: 180px; margin-bottom: 12px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Codigo de Acesso</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f3f4f6;">
<div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
<div style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); padding: 32px 24px; text-align: center;">
${logoSection}
<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Bem-vindo ao eCLINI</h1>
<p style="margin: 8px 0 0 0; color: #99f6e4; font-size: 14px;">${portalName} - ${clinicName}</p>
</div>
<div style="padding: 32px 24px;">
<p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">Prezado(a) <strong>${recipientName}</strong>,</p>
<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
<h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">Novidade: Sistema eCLINI</h3>
<p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">O <strong>${clinicName}</strong> atualizou seu sistema de gestao de contribuicoes para o <strong>eCLINI</strong>. A partir de agora, todos os boletos, consultas e servicos estarao disponiveis atraves deste novo portal.</p>
</div>
<p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">Segue seu codigo de acesso ao ${portalName}:</p>
<div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #14b8a6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
<p style="margin: 0 0 8px 0; color: #0f766e; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Seu Codigo de Acesso</p>
<div style="font-family: Courier New, Courier, monospace; font-size: 36px; font-weight: bold; color: #0d9488; letter-spacing: 8px; padding: 16px 0;">${accessCode}</div>
</div>
<div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 24px 0;">
<h3 style="margin: 0 0 12px 0; color: #065f46; font-size: 15px; font-weight: 600;">Seus dados de acesso:</h3>
<p style="margin: 0 0 8px 0; color: #047857; font-size: 14px;"><strong>${identifierLabel}:</strong> ${identifier}</p>
<p style="margin: 0; color: #047857; font-size: 14px;"><strong>Codigo:</strong> ${accessCode}</p>
</div>
<div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
<h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 15px; font-weight: 600;">Como acessar:</h3>
<ol style="margin: 0; padding: 0 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
<li>Acesse o link: <a href="${portalUrl}" style="color: #0d9488; font-weight: 500;">${portalUrl}</a></li>
<li>Informe seu ${identifierLabel}: <strong>${identifier}</strong></li>
<li>Digite o codigo de acesso: <strong>${accessCode}</strong></li>
</ol>
</div>
<div style="text-align: center; margin: 32px 0;">
<a href="${portalUrl}" target="_blank" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Acessar Portal</a>
</div>
<div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 24px 0;">
<p style="margin: 0; color: #92400e; font-size: 13px;"><strong>Importante:</strong> Este codigo e pessoal e intransferivel. Nao compartilhe com terceiros.</p>
</div>
</div>
<div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">Em caso de duvidas, entre em contato conosco.</p>
<p style="margin: 0; color: #9ca3af; font-size: 12px;">${clinicName} - Sistema eCLINI</p>
</div>
</div>
</body>
</html>`;
};

// ============ SUPABASE CLIENT (module-level para reduzir cold start) ============
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const origin = req.headers.get("origin") || "unknown";
  
  console.log(`[send-portal-access-code][${requestId}] ${req.method} from ${origin}`);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    console.log(`[send-portal-access-code][${requestId}] Preflight OK`);
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const data: SendAccessCodeRequest = await req.json();
    console.log(`[send-portal-access-code][${requestId}] Processing: type=${data.type}, entityId=${data.entityId}, whatsappOnly=${data.whatsappOnly}`);

    if (!data.type || !data.entityId || !data.recipientName || !data.clinicName || !data.clinicSlug) {
      console.log(`[send-portal-access-code][${requestId}] Missing required fields`);
      return corsError("Campos obrigatorios nao preenchidos", 400);
    }

    if (!data.whatsappOnly && data.recipientEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.recipientEmail)) {
        console.log(`[send-portal-access-code][${requestId}] Invalid email: ${data.recipientEmail}`);
        return corsError("Email do destinatario invalido", 400);
      }
    }

    let accessCode: string;
    let identifier: string;
    let portalUrl: string;
    let clinicId: string | undefined = data.clinicId;

    if (data.type === "accounting_office") {
      const { data: office, error: fetchError } = await supabase
        .from("accounting_offices")
        .select("access_code, email, phone, clinic_id")
        .eq("id", data.entityId)
        .maybeSingle();

      if (fetchError || !office) {
        console.log(`[send-portal-access-code][${requestId}] Accounting office not found: ${data.entityId}`);
        return corsError("Escritorio nao encontrado", 404);
      }

      if (!office.access_code) {
        console.log(`[send-portal-access-code][${requestId}] No access code for accounting office: ${data.entityId}`);
        return corsError("Codigo de acesso nao configurado para este escritorio", 400);
      }

      accessCode = office.access_code;
      identifier = data.recipientEmail || office.email;
      clinicId = clinicId || office.clinic_id;
      portalUrl = `${req.headers.get("origin") || "https://app.eclini.com.br"}/portal-contador/${data.clinicSlug}`;

      if (data.updateEmail && data.recipientEmail && data.recipientEmail !== office.email) {
        await supabase.from("accounting_offices").update({ email: data.recipientEmail.toLowerCase().trim() }).eq("id", data.entityId);
      }

      if (data.updatePhone && data.phone && data.phone !== office.phone) {
        await supabase.from("accounting_offices").update({ phone: data.phone }).eq("id", data.entityId);
      }
    } else {
      const { data: employer, error: fetchError } = await supabase
        .from("employers")
        .select("access_code, cnpj, email, phone, clinic_id")
        .eq("id", data.entityId)
        .maybeSingle();

      if (fetchError || !employer) {
        console.log(`[send-portal-access-code][${requestId}] Employer not found: ${data.entityId}`);
        return corsError("Empresa nao encontrada", 404);
      }

      if (!employer.access_code) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let newCode = "";
        for (let i = 0; i < 6; i++) {
          newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        await supabase.from("employers").update({ access_code: newCode }).eq("id", data.entityId);
        accessCode = newCode;
        console.log(`[send-portal-access-code][${requestId}] Generated new access code for employer: ${data.entityId}`);
      } else {
        accessCode = employer.access_code;
      }

      const cleanCnpj = employer.cnpj.replace(/\D/g, "");
      identifier = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
      clinicId = clinicId || employer.clinic_id;
      portalUrl = `${req.headers.get("origin") || "https://app.eclini.com.br"}/portal-empresa/${data.clinicSlug}`;

      if (data.updateEmail && data.recipientEmail && data.recipientEmail !== employer.email) {
        await supabase.from("employers").update({ email: data.recipientEmail.toLowerCase().trim() }).eq("id", data.entityId);
      }

      if (data.updatePhone && data.phone && data.phone !== employer.phone) {
        await supabase.from("employers").update({ phone: data.phone }).eq("id", data.entityId);
      }
    }

    // WhatsApp only - retorna dados sem enviar email
    if (data.whatsappOnly) {
      const elapsed = Date.now() - startTime;
      console.log(`[send-portal-access-code][${requestId}] WhatsApp only response in ${elapsed}ms`);
      return corsResponse({ success: true, accessCode, identifier, portalUrl });
    }

    if (!data.recipientEmail) {
      console.log(`[send-portal-access-code][${requestId}] Email required but not provided`);
      return corsError("Email do destinatario e obrigatorio para envio por e-mail", 400);
    }

    // Busca logo do sindicato
    let logoUrl: string | undefined;
    if (clinicId) {
      const { data: unionData } = await supabase
        .from('union_entities')
        .select('logo_url')
        .eq('clinic_id', clinicId)
        .maybeSingle();
      
      if (unionData?.logo_url) {
        logoUrl = unionData.logo_url;
      }
    }

    const html = generateEmailHtml(data.type, data.recipientName, data.clinicName, portalUrl, accessCode, identifier, logoUrl);
    const portalName = data.type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";
    const subject = `Seu Codigo de Acesso - ${portalName}`;

    // Verificar configuração SMTP
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    console.log(`[send-portal-access-code][${requestId}] SMTP config: host=${smtpHost ? 'SET' : 'MISSING'}, user=${smtpUser ? 'SET' : 'MISSING'}, from=${smtpFrom ? 'SET' : 'MISSING'}`);

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      console.error(`[send-portal-access-code][${requestId}] SMTP configuration incomplete`);
      return corsError("Configuracao SMTP nao encontrada", 500);
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    try {
      console.log(`[send-portal-access-code][${requestId}] Sending email to: ${data.recipientEmail}`);
      
      await client.send({
        from: smtpFrom,
        to: data.recipientEmail,
        subject: subject,
        html: html,
      });

      await client.close();
      
      const elapsed = Date.now() - startTime;
      console.log(`[send-portal-access-code][${requestId}] Email sent successfully in ${elapsed}ms`);

      return corsResponse({ success: true, message: "Email enviado com sucesso" });

    } catch (smtpError: any) {
      console.error(`[send-portal-access-code][${requestId}] SMTP error:`, smtpError?.message || smtpError);
      try { await client.close(); } catch (_) {}
      
      let errorMessage = "Erro ao enviar email";
      if (smtpError.message?.includes("authentication")) {
        errorMessage = "Falha na autenticacao SMTP.";
      } else if (smtpError.message?.includes("connection")) {
        errorMessage = "Nao foi possivel conectar ao servidor SMTP.";
      } else if (smtpError.message) {
        errorMessage = `Erro SMTP: ${smtpError.message}`;
      }
      
      return corsError(errorMessage, 500);
    }

  } catch (error: any) {
    console.error(`[send-portal-access-code][${requestId}] Error:`, error?.message || error);
    return corsError(error?.message || "Erro interno", 500);
  }
};

serve(handler);
