import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JsonObject = Record<string, unknown>;

interface Payload {
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

function json(status: number, body: JsonObject) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError(401, "Unauthorized");
    }

    let payload: Payload;
    try {
      payload = await req.json();
    } catch {
      throw new HttpError(400, "JSON inválido");
    }

    const { associadoId, clinicId } = payload;
    if (!associadoId || !clinicId) {
      throw new HttpError(400, "associadoId e clinicId são obrigatórios");
    }

    console.log(JSON.stringify({ requestId, at: "start", associadoId, clinicId }));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(jwt);

    if (claimsError || !claimsData?.claims?.sub) {
      throw new HttpError(401, "Unauthorized");
    }

    const callerUserId = claimsData.claims.sub;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Permission check
    const { data: perms, error: permsError } = await admin.rpc("get_user_permissions", {
      _user_id: callerUserId,
      _clinic_id: clinicId,
    });

    if (permsError) {
      throw new HttpError(500, "Erro ao verificar permissões", { permsError });
    }

    const permissionKeys = Array.isArray(perms)
      ? perms.map((p: any) => String(p?.permission_key ?? "")).filter(Boolean)
      : [];

    if (!permissionKeys.includes("union_manage_members")) {
      throw new HttpError(403, "Permissão insuficiente (union_manage_members)");
    }

    // Fetch patient
    const { data: associado, error: assocError } = await admin
      .from("patients")
      .select("id, name, email, cpf, phone, signature_accepted")
      .eq("id", associadoId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (assocError || !associado) {
      throw new HttpError(404, "Sócio não encontrado");
    }

    if (!associado.phone) {
      throw new HttpError(400, "Sócio não possui telefone cadastrado");
    }

    if (associado.signature_accepted) {
      throw new HttpError(400, "Sócio já possui autorização de desconto assinada");
    }

    console.log(JSON.stringify({
      requestId, at: "patient.found",
      name: associado.name,
      phone: associado.phone,
      signature_accepted: associado.signature_accepted,
    }));

    // Check existing active token
    const { data: existingToken } = await admin
      .from("signature_request_tokens")
      .select("id, token, expires_at, used_at")
      .eq("patient_id", associadoId)
      .eq("clinic_id", clinicId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch union entity
    const { data: unionEntity } = await admin
      .from("union_entities")
      .select("razao_social, logo_url")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    const unionName = unionEntity?.razao_social || "Sindicato";

    let token: string;
    let expiresAtIso: string;

    if (existingToken?.token) {
      token = existingToken.token;
      expiresAtIso = existingToken.expires_at;
      console.log(JSON.stringify({ requestId, at: "token.reuse", token }));
    } else {
      // Generate token
      const { data: tokenData } = await admin.rpc("generate_signature_token");
      token = (tokenData as string) || crypto.randomUUID().replace(/-/g, "");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      expiresAtIso = expiresAt.toISOString();

      const { error: insertError } = await admin
        .from("signature_request_tokens")
        .insert({
          patient_id: associadoId,
          clinic_id: clinicId,
          token,
          email: associado.email || "",
          expires_at: expiresAtIso,
          created_by: callerUserId,
          ip_address: req.headers.get("x-forwarded-for") || null,
          user_agent: req.headers.get("user-agent") || null,
        });

      if (insertError) {
        throw new HttpError(500, "Erro ao gerar token de assinatura", { insertError });
      }

      console.log(JSON.stringify({ requestId, at: "token.created", token }));
    }

    // Build signature URL
    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://app.eclini.com.br";
    const signatureUrl = `${baseUrl}/assinar/${token}`;

    // Send via WhatsApp using send-whatsapp edge function
    const whatsappMessage = `✍️ *Autorização de Desconto em Folha*

Olá, *${associado.name}*!

O *${unionName}* solicita que você assine digitalmente a autorização de desconto em folha de pagamento.

📝 *Acesse o link abaixo para assinar:*
${signatureUrl}

⚠️ *Importante:*
• Este link é válido por 7 dias
• É de uso único
• A assinatura tem validade legal

Em caso de dúvidas, entre em contato com o sindicato.

Atenciosamente,
*${unionName}*`;

    // Get clinic whatsapp config for header image
    const { data: clinic } = await admin
      .from("clinics")
      .select("whatsapp_header_image_url")
      .eq("id", clinicId)
      .maybeSingle();

    // Invoke send-whatsapp function internally
    const whatsappResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          phone: associado.phone,
          message: whatsappMessage,
          clinicId,
          type: "custom",
          imageUrl: clinic?.whatsapp_header_image_url || undefined,
        }),
      },
    );

    const whatsappData = await whatsappResponse.json();

    console.log(JSON.stringify({
      requestId,
      at: "whatsapp.sent",
      status: whatsappResponse.status,
      success: whatsappData?.success,
      phone: associado.phone,
      ms: Date.now() - startedAt,
    }));

    if (!whatsappResponse.ok || !whatsappData?.success) {
      throw new HttpError(500, whatsappData?.error || "Erro ao enviar WhatsApp", {
        whatsappStatus: whatsappResponse.status,
        whatsappData,
      });
    }

    return json(200, {
      success: true,
      requestId,
      message: `WhatsApp enviado para ${associado.phone}`,
      phone: associado.phone,
      associadoId,
      clinicId,
      token,
      expires_at: expiresAtIso,
    });
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;

    console.error(JSON.stringify({
      requestId,
      at: "request.error",
      status,
      message: err?.message,
      stack: err?.stack,
      details: err instanceof HttpError ? err.details : undefined,
      ms: Date.now() - startedAt,
    }));

    return json(status, {
      success: false,
      requestId,
      error: err?.message || "Erro interno",
      status,
      details: err instanceof HttpError ? err.details : undefined,
      stack: err?.stack,
    });
  }
});
