import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{32,128}$/i.test(token);
}

type ParsedImageDataUrl = {
  mime: "image/png" | "image/jpeg";
  base64: string;
};

function parseImageDataUrl(input: unknown): ParsedImageDataUrl | null {
  if (typeof input !== "string") return null;

  // Accept PNG/JPEG data URLs
  const match = input.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/i);
  if (!match) return null;

  const mime = match[1].toLowerCase() as ParsedImageDataUrl["mime"];
  const base64 = match[2];
  if (!base64 || base64.length < 50) return null;

  return { mime, base64 };
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return json(405, { error: "Método não permitido" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const accepted = body?.accepted;
    const parsedSignature = parseImageDataUrl(body?.signatureData);

    if (!isValidToken(token)) {
      return json(400, { error: "Token inválido" });
    }

    if (accepted !== true) {
      return json(400, { error: "Você precisa aceitar os termos" });
    }

    if (!parsedSignature) {
      return json(400, { error: "Assinatura inválida" });
    }

    // Reject very small/empty signatures (common when canvas export fails)
    const signatureBytes = decodeBase64ToBytes(parsedSignature.base64);
    if (signatureBytes.byteLength < 2_000) {
      return json(400, { error: "Assinatura muito pequena ou vazia" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // 1) Load and validate token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("signature_request_tokens")
      .select("id, patient_id, clinic_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("[submit-signature-authorization] token lookup error", tokenError);
      return json(500, { error: "Erro ao validar token" });
    }

    if (!tokenRecord) {
      return json(404, { error: "Link inválido ou expirado" });
    }

    if (tokenRecord.used_at) {
      return json(409, { error: "Este link já foi utilizado" });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return json(410, { error: "Este link expirou" });
    }

    const nowIso = new Date().toISOString();

    // 2) Upload signature to storage (do NOT store base64 in DB)
    const ext = parsedSignature.mime === "image/jpeg" ? "jpg" : "png";
    const signaturePath = `${tokenRecord.clinic_id}/${tokenRecord.patient_id}/signature-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("patient-signatures")
      .upload(signaturePath, signatureBytes, {
        contentType: parsedSignature.mime,
        upsert: true,
      });

    if (uploadError) {
      console.error("[submit-signature-authorization] signature upload error", uploadError);
      return json(500, { error: "Erro ao salvar assinatura" });
    }

    // 3) Update patient signature (store only the storage path)
    const { error: patientError } = await supabase
      .from("patients")
      .update({
        signature_url: signaturePath,
        signature_accepted: true,
        signature_accepted_at: nowIso,
      })
      .eq("id", tokenRecord.patient_id);

    if (patientError) {
      console.error("[submit-signature-authorization] patient update error", patientError);
      return json(500, { error: "Erro ao salvar assinatura" });
    }

    // 3) Mark token as used (idempotent guard)
    const { error: markUsedError, data: markUsedData } = await supabase
      .from("signature_request_tokens")
      .update({ used_at: nowIso })
      .eq("id", tokenRecord.id)
      .is("used_at", null)
      .select("id");

    if (markUsedError) {
      console.error("[submit-signature-authorization] mark used error", markUsedError);
      return json(500, { error: "Erro ao finalizar" });
    }

    if (!markUsedData || markUsedData.length === 0) {
      // Someone else marked it used between our checks.
      return json(409, { error: "Este link já foi utilizado" });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error("[submit-signature-authorization] unexpected", err);
    return json(500, { error: "Erro interno do servidor" });
  }
});
