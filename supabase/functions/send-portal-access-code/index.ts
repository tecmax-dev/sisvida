import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-request-id",
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
  ].join(", "),
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type JsonRecord = Record<string, unknown>;

class AppError extends Error {
  status: number;
  code: string;
  expose: boolean;

  constructor(message: string, opts: { status: number; code: string; expose?: boolean }) {
    super(message);
    this.name = "AppError";
    this.status = opts.status;
    this.code = opts.code;
    this.expose = opts.expose ?? true;
  }
}

function ensureCors(res: Response): Response {
  for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  return res;
}

function jsonResponse(requestId: string, payload: unknown, status = 200, logLabel = "return"): Response {
  console.log(`[send-portal-access-code][${requestId}] ${logLabel} status=${status}`);
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function preflightResponse(requestId: string): Response {
  console.log(`[send-portal-access-code][${requestId}] return preflight 204`);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function getRequestId(req: Request): string {
  const headerId = req.headers.get("x-request-id")?.trim();
  if (headerId) return headerId;
  return crypto.randomUUID();
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("timeout:");
}

function classifySmtpError(err: unknown): { code: string; status: number; message: string; expose: boolean } | null {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("timeout:") && lower.includes("smtp")) {
    return { code: "smtp_timeout", status: 504, message: "Tempo excedido ao enviar e-mail", expose: false };
  }
  if (lower.includes("auth") || lower.includes("authentication") || lower.includes("535")) {
    return { code: "smtp_auth_failed", status: 502, message: "Falha na autenticação SMTP", expose: false };
  }
  if (lower.includes("connection") || lower.includes("connect") || lower.includes("econn") || lower.includes("tls")) {
    return { code: "smtp_connection_failed", status: 502, message: "Falha de conexão com o servidor SMTP", expose: false };
  }

  // denomailer pode propagar mensagens variadas
  if (lower.includes("smtp")) {
    return { code: "smtp_error", status: 502, message: "Erro ao enviar e-mail", expose: false };
  }

  return null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms);
    }),
  ]);
}

async function safeJson(req: Request, requestId: string): Promise<JsonRecord> {
  const text = await req.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as JsonRecord;
    throw new Error("json_not_object");
  } catch (err) {
    console.error(`[send-portal-access-code][${requestId}] bad_json:`, err);
    throw new AppError("JSON inválido", { status: 400, code: "bad_json", expose: true });
  }
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
  logoUrl?: string,
): string => {
  const portalName = type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";
  const identifierLabel = type === "accounting_office" ? "E-mail" : "CNPJ";

  const logoSection = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height: 50px; max-width: 180px; margin-bottom: 12px;" />`
    : "";

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

serve(async (req) => {
  // 1) OPTIONS tem que ser a PRIMEIRA instrução (sem Supabase/SMTP/async extra)
  const requestId = getRequestId(req);
  if (req.method === "OPTIONS") {
    return ensureCors(preflightResponse(requestId));
  }

  const startTime = Date.now();
  const origin = req.headers.get("origin") || "unknown";
  console.log(`[send-portal-access-code][${requestId}] start method=${req.method} origin=${origin}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new AppError("Configuração do backend ausente", {
        status: 500,
        code: "missing_backend_config",
        expose: false,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await safeJson(req, requestId);
    const data = body as unknown as SendAccessCodeRequest;

    console.log(
      `[send-portal-access-code][${requestId}] payload type=${(data as any)?.type} entityId=${(data as any)?.entityId} whatsappOnly=${(data as any)?.whatsappOnly}`,
    );

    if (!data?.type || !data?.entityId || !data?.recipientName || !data?.clinicName || !data?.clinicSlug) {
      throw new AppError("Campos obrigatórios não preenchidos", { status: 400, code: "missing_fields", expose: true });
    }

    if (!data.whatsappOnly && data.recipientEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.recipientEmail)) {
        throw new AppError("Email do destinatário inválido", { status: 400, code: "invalid_email", expose: true });
      }
    }

    let accessCode: string;
    let identifier: string;
    let portalUrl: string;
    let clinicId: string | undefined = data.clinicId;

    if (data.type === "accounting_office") {
      const officeRes = await withTimeout(
        supabase
          .from("accounting_offices")
          .select("access_code, email, phone, clinic_id")
          .eq("id", data.entityId)
          .maybeSingle(),
        15000,
        "db:accounting_offices",
      );

      if (officeRes.error || !officeRes.data) {
        console.error(`[send-portal-access-code][${requestId}] db office error:`, officeRes.error);
        throw new AppError("Escritório não encontrado", { status: 404, code: "office_not_found", expose: true });
      }

      const office = officeRes.data as any;

      if (!office.access_code) {
        throw new AppError("Código de acesso não configurado para este escritório", {
          status: 400,
          code: "access_code_missing",
          expose: true,
        });
      }

      accessCode = String(office.access_code);
      identifier = data.recipientEmail || office.email;
      clinicId = clinicId || office.clinic_id;
      portalUrl = `${req.headers.get("origin") || "https://app.eclini.com.br"}/portal-contador/${data.clinicSlug}`;

      if (data.updateEmail && data.recipientEmail && data.recipientEmail !== office.email) {
        await withTimeout(
          supabase.from("accounting_offices").update({ email: data.recipientEmail.toLowerCase().trim() }).eq("id", data.entityId),
          15000,
          "db:accounting_offices:update_email",
        );
      }

      if (data.updatePhone && data.phone && data.phone !== office.phone) {
        await withTimeout(
          supabase.from("accounting_offices").update({ phone: data.phone }).eq("id", data.entityId),
          15000,
          "db:accounting_offices:update_phone",
        );
      }
    } else {
      const employerRes = await withTimeout(
        supabase
          .from("employers")
          .select("access_code, cnpj, email, phone, clinic_id")
          .eq("id", data.entityId)
          .maybeSingle(),
        15000,
        "db:employers",
      );

      if (employerRes.error || !employerRes.data) {
        console.error(`[send-portal-access-code][${requestId}] db employer error:`, employerRes.error);
        throw new AppError("Empresa não encontrada", { status: 404, code: "employer_not_found", expose: true });
      }

      const employer = employerRes.data as any;

      if (!employer.access_code) {
        // gera um código simples (mantém comportamento atual)
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let newCode = "";
        for (let i = 0; i < 6; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length));

        await withTimeout(
          supabase.from("employers").update({ access_code: newCode }).eq("id", data.entityId),
          15000,
          "db:employers:update_access_code",
        );

        accessCode = newCode;
        console.log(`[send-portal-access-code][${requestId}] generated employer access_code employerId=${data.entityId}`);
      } else {
        accessCode = String(employer.access_code);
      }

      const cleanCnpj = String(employer.cnpj || "").replace(/\D/g, "");
      identifier = cleanCnpj.length === 14
        ? cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
        : cleanCnpj;

      clinicId = clinicId || employer.clinic_id;
      portalUrl = `${req.headers.get("origin") || "https://app.eclini.com.br"}/portal-empresa/${data.clinicSlug}`;

      if (data.updateEmail && data.recipientEmail && data.recipientEmail !== employer.email) {
        await withTimeout(
          supabase.from("employers").update({ email: data.recipientEmail.toLowerCase().trim() }).eq("id", data.entityId),
          15000,
          "db:employers:update_email",
        );
      }

      if (data.updatePhone && data.phone && data.phone !== employer.phone) {
        await withTimeout(
          supabase.from("employers").update({ phone: data.phone }).eq("id", data.entityId),
          15000,
          "db:employers:update_phone",
        );
      }
    }

    if (data.whatsappOnly) {
      const elapsed = Date.now() - startTime;
      return ensureCors(
        jsonResponse(
          requestId,
          { success: true, accessCode, identifier, portalUrl, request_id: requestId, elapsed_ms: elapsed },
          200,
          "return whatsappOnly",
        ),
      );
    }

    if (!data.recipientEmail) {
      throw new AppError("Email do destinatário é obrigatório para envio por e-mail", {
        status: 400,
        code: "email_required",
        expose: true,
      });
    }

    // Busca logo (best-effort)
    let logoUrl: string | undefined;
    if (clinicId) {
      try {
        const unionRes = await withTimeout(
          supabase.from("union_entities").select("logo_url").eq("clinic_id", clinicId).maybeSingle(),
          15000,
          "db:union_entities:logo",
        );
        if (!unionRes.error && unionRes.data?.logo_url) logoUrl = String(unionRes.data.logo_url);
      } catch (e) {
        console.error(`[send-portal-access-code][${requestId}] warn logo fetch failed:`, e);
      }
    }

    const html = generateEmailHtml(data.type, data.recipientName, data.clinicName, portalUrl, accessCode, identifier, logoUrl);
    const portalName = data.type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";
    const subject = `Seu Codigo de Acesso - ${portalName}`;

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    console.log(
      `[send-portal-access-code][${requestId}] smtp_config host=${smtpHost ? "SET" : "MISSING"} user=${smtpUser ? "SET" : "MISSING"} from=${smtpFrom ? "SET" : "MISSING"} port=${smtpPort}`,
    );

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      throw new AppError("Configuração SMTP não encontrada", { status: 500, code: "smtp_config_missing", expose: false });
    }

    let client: SMTPClient | null = null;
    try {
      client = new SMTPClient({
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

      console.log(`[send-portal-access-code][${requestId}] smtp_send to=${data.recipientEmail}`);
      await withTimeout(
        client.send({
          from: smtpFrom,
          to: data.recipientEmail,
          subject,
          html,
        }),
        20000,
        "smtp:send",
      );
    } finally {
      if (client) {
        try {
          await withTimeout(client.close(), 8000, "smtp:close");
        } catch (e) {
          console.error(`[send-portal-access-code][${requestId}] warn smtp_close failed:`, e);
        }
      }
    }

    const elapsed = Date.now() - startTime;
    return ensureCors(
      jsonResponse(
        requestId,
        { success: true, message: "Email enviado com sucesso", request_id: requestId, elapsed_ms: elapsed },
        200,
        "return success",
      ),
    );
  } catch (err) {
    // 2) ÚNICO catch no topo: erros sync/async/db/smtp/timeout
    const elapsed = Date.now() - startTime;

    const appErr = err instanceof AppError ? err : null;
    const timeout = isTimeoutError(err);
    const smtp = classifySmtpError(err);

    if (!appErr) {
      console.error(`[send-portal-access-code][${requestId}] catch internal_error elapsed=${elapsed}ms`, err);
    } else {
      console.error(`[send-portal-access-code][${requestId}] catch ${appErr.code} status=${appErr.status} elapsed=${elapsed}ms`, appErr.message);
    }

    const status = appErr?.status ?? smtp?.status ?? (timeout ? 504 : 500);
    const code = appErr?.code ?? smtp?.code ?? (timeout ? "timeout" : "internal_error");

    const message = appErr?.expose
      ? appErr.message
      : smtp
        ? smtp.message
        : timeout
          ? "Tempo excedido ao processar a solicitação"
          : "Erro interno do servidor";

    return ensureCors(
      jsonResponse(
        requestId,
        {
          success: false,
          error: message,
          code,
          request_id: requestId,
          elapsed_ms: elapsed,
        },
        status,
        "return catch",
      ),
    );
  }
});
