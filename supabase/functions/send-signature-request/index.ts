import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JsonObject = Record<string, unknown>;

interface SignatureRequestPayload {
  associadoId: string;
  clinicId: string;
}

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function jsonResponse(status: number, body: JsonObject, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });
}

function redactAuthHeader(authHeader: string | null) {
  if (!authHeader) return null;
  // Don’t log full token. Keep prefix + length.
  const trimmed = authHeader.trim();
  return {
    prefix: trimmed.slice(0, 24),
    length: trimmed.length,
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const contentType = req.headers.get("content-type");
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

  console.log(
    JSON.stringify({
      requestId,
      at: "request.start",
      method: req.method,
      url: req.url,
      headers: {
        authorization: redactAuthHeader(authHeader),
        contentType,
        xClientInfo: req.headers.get("x-client-info"),
      },
    }),
  );

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      throw new HttpError(500, "Serviço de email não configurado.", {
        smtpHost: !!smtpHost,
        smtpUser: !!smtpUser,
        smtpPassword: !!smtpPassword,
        smtpFrom: !!smtpFrom,
      });
    }

    let payload: SignatureRequestPayload;
    try {
      payload = await req.json();
    } catch (e) {
      throw new HttpError(400, "JSON inválido no body.", {
        message: (e as Error)?.message,
        stack: (e as Error)?.stack,
      });
    }

    console.log(
      JSON.stringify({
        requestId,
        at: "request.payload",
        payload,
      }),
    );

    const { associadoId, clinicId } = payload;

    if (!associadoId || !clinicId) {
      throw new HttpError(400, "associadoId e clinicId são obrigatórios", { payload });
    }

    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError(401, "Unauthorized", {
        reason: "Missing Bearer token in Authorization header",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticated client (for getClaims)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(jwt);

    if (claimsError || !claimsData?.claims?.sub) {
      throw new HttpError(401, "Unauthorized", {
        claimsError,
        claimsData,
      });
    }

    const callerUserId = claimsData.claims.sub;

    console.log(
      JSON.stringify({
        requestId,
        at: "auth.claims",
        callerUserId,
        callerEmail: (claimsData.claims as any)?.email ?? null,
      }),
    );

    // Admin client for DB operations & permission checks
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Permission check: must have union_manage_members (or equivalent)
    const { data: perms, error: permsError } = await admin.rpc("get_user_permissions", {
      _user_id: callerUserId,
      _clinic_id: clinicId,
    });

    if (permsError) {
      throw new HttpError(500, "Erro ao verificar permissões", {
        permsError,
      });
    }

    const permissionKeys = Array.isArray(perms)
      ? perms.map((p: any) => String(p?.permission_key ?? "")).filter(Boolean)
      : [];

    const hasManageMembers = permissionKeys.includes("union_manage_members");

    console.log(
      JSON.stringify({
        requestId,
        at: "auth.permissions",
        clinicId,
        hasManageMembers,
        permissionKeys,
      }),
    );

    if (!hasManageMembers) {
      throw new HttpError(403, "Permissão insuficiente (union_manage_members)", {
        required: "union_manage_members",
        permissionKeys,
      });
    }

    // Fetch member data from patients (aligns with UnionMembersListPage)
    const { data: associado, error: assocError } = await admin
      .from("patients")
      .select("id, name, email, cpf, phone, signature_accepted, signature_url")
      .eq("id", associadoId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    console.log(
      JSON.stringify({
        requestId,
        at: "db.patient.fetch",
        associadoId,
        clinicId,
        found: !!associado,
        assocError,
        email: associado?.email ?? null,
        signature_accepted: associado?.signature_accepted ?? null,
      }),
    );

    if (assocError || !associado) {
      throw new HttpError(404, "Sócio não encontrado", { assocError, associadoId, clinicId });
    }

    if (!associado.email || !isValidEmail(associado.email)) {
      throw new HttpError(400, "Sócio não possui email válido cadastrado", {
        email: associado.email,
      });
    }

    if (associado.signature_accepted) {
      throw new HttpError(400, "Sócio já possui autorização de desconto assinada", {
        signature_accepted: associado.signature_accepted,
      });
    }

    // Check existing active token (not used, not expired)
    const { data: existingToken, error: existingTokenError } = await admin
      .from("signature_request_tokens")
      .select("id, token, expires_at, used_at, created_at")
      .eq("patient_id", associadoId)
      .eq("clinic_id", clinicId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(
      JSON.stringify({
        requestId,
        at: "db.token.existing",
        associadoId,
        clinicId,
        hasExisting: !!existingToken,
        existingTokenError,
        existingTokenId: existingToken?.id ?? null,
        existingTokenExpiresAt: existingToken?.expires_at ?? null,
      }),
    );

    if (existingTokenError) {
      throw new HttpError(500, "Erro ao verificar token existente", {
        existingTokenError,
      });
    }

    // Fetch union entity info
    const { data: unionEntity, error: unionError } = await admin
      .from("union_entities")
      .select("razao_social, logo_url")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (unionError) {
      console.error(
        JSON.stringify({ requestId, at: "db.union.fetch.error", unionError, clinicId }),
      );
    }

    const unionName = unionEntity?.razao_social || "Sindicato";
    const logoUrl = unionEntity?.logo_url || null;

    let token: string;
    let expiresAtIso: string;

    if (existingToken?.token) {
      token = existingToken.token;
      expiresAtIso = new Date(existingToken.expires_at).toISOString();
      console.log(JSON.stringify({ requestId, at: "token.reuse", token, expiresAt: expiresAtIso }));
    } else {
      // Generate secure token
      const { data: tokenData, error: tokenRpcError } = await admin.rpc("generate_signature_token");
      if (tokenRpcError) {
        console.error(JSON.stringify({ requestId, at: "rpc.generate_signature_token.error", tokenRpcError }));
      }
      token = (tokenData as string) || crypto.randomUUID().replace(/-/g, "");

      // Store token with 7 days expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      expiresAtIso = expiresAt.toISOString();

      const { data: inserted, error: insertError } = await admin
        .from("signature_request_tokens")
        .insert({
          patient_id: associadoId,
          clinic_id: clinicId,
          token,
          email: associado.email,
          expires_at: expiresAtIso,
          created_by: callerUserId,
          ip_address: req.headers.get("x-forwarded-for") || null,
          user_agent: req.headers.get("user-agent") || null,
        })
        .select("id, token, expires_at")
        .maybeSingle();

      console.log(
        JSON.stringify({
          requestId,
          at: "db.token.insert",
          ok: !insertError,
          insertError,
          inserted,
        }),
      );

      if (insertError) {
        throw new HttpError(500, "Erro ao gerar token de assinatura", {
          insertError,
        });
      }
    }

    // Build signature URL
    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://app.eclini.com.br";
    const signatureUrl = `${baseUrl}/assinar/${token}`;

    console.log(
      JSON.stringify({
        requestId,
        at: "email.compose",
        associadoId,
        clinicId,
        to: associado.email,
        signatureUrl,
        token,
        expiresAt: expiresAtIso,
      }),
    );

    const logoSection = logoUrl
      ? `<img src="${logoUrl}" alt="Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 16px;" />`
      : "";

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Autorização de Desconto em Folha</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
<div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; text-align: center;">
${logoSection}
<h1 style="color: white; margin: 0; font-size: 22px;">${unionName}</h1>
</div>
<div style="padding: 32px;">
<h2 style="color: #1f2937; margin: 0 0 16px;">Olá, ${associado.name}!</h2>
<p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
Recebemos uma solicitação para que você autorize o desconto em folha de pagamento
referente à sua contribuição sindical.
</p>
<p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
Para completar sua autorização, clique no botão abaixo e assine digitalmente:
</p>
<div style="text-align: center; margin: 32px 0;">
<a href="${signatureUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
Assinar Autorização
</a>
</div>
<p style="color: #6b7280; font-size: 14px;">
Ou copie e cole este link no seu navegador:<br>
<a href="${signatureUrl}" style="color: #7c3aed; word-break: break-all;">${signatureUrl}</a>
</p>
<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
<p style="color: #92400e; margin: 0; font-size: 14px;">
<strong>⚠️ Importante:</strong> Este link é válido por 7 dias e é de uso único.
</p>
</div>
</div>
<div style="text-align: center; padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
<p style="color: #9ca3af; font-size: 12px; margin: 0;">Este é um email automático. Por favor, não responda.</p>
<p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">${unionName}</p>
</div>
</div>
</body>
</html>`;

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
      await client.send({
        from: smtpFrom,
        to: associado.email,
        subject: `${unionName} - Autorização de Desconto em Folha`,
        html: emailHtml,
      });

      await client.close();

      console.log(
        JSON.stringify({
          requestId,
          at: "email.sent",
          to: associado.email,
          token,
          ms: Date.now() - startedAt,
        }),
      );

      return jsonResponse(200, {
        success: true,
        requestId,
        message: `Email enviado para ${associado.email}`,
        email: associado.email,
        associadoId,
        clinicId,
        token,
        expires_at: expiresAtIso,
      });
    } catch (smtpError: any) {
      console.error(
        JSON.stringify({
          requestId,
          at: "email.error",
          smtpError: {
            message: smtpError?.message,
            stack: smtpError?.stack,
            name: smtpError?.name,
            code: smtpError?.code,
            response: smtpError?.response,
          },
        }),
      );

      try {
        await client.close();
      } catch {
        // ignore
      }

      throw new HttpError(500, "Erro ao enviar email", {
        smtpError: {
          message: smtpError?.message,
          stack: smtpError?.stack,
          name: smtpError?.name,
          code: smtpError?.code,
          response: smtpError?.response,
        },
      });
    }
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;

    const body: JsonObject = {
      success: false,
      requestId,
      error: err?.message || "Erro interno",
      status,
    };

    if (err instanceof HttpError && err.details !== undefined) {
      body.details = err.details;
    }

    // Include stack for auditability as requested
    body.stack = err?.stack;

    console.error(
      JSON.stringify({
        requestId,
        at: "request.error",
        status,
        message: err?.message,
        stack: err?.stack,
        raw: err,
        ms: Date.now() - startedAt,
      }),
    );

    return jsonResponse(status, body);
  }
});
