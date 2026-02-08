import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function getPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

function normalizeCpf(cpf: string): string {
  return (cpf || "").replace(/\D/g, "");
}

function isBlobUrl(input: string) {
  return input.startsWith("blob:");
}

function isDataImageUrl(input: string) {
  return input.startsWith("data:image/");
}

type StorageRef = { bucket: string; path: string; isPublic: boolean };

function parseStorageUrlToRef(url: string): StorageRef | null {
  // Expected patterns:
  // /storage/v1/object/public/<bucket>/<path> - PUBLIC
  // /storage/v1/object/sign/<bucket>/<path> - SIGNED (treat as public fetch)
  // /storage/v1/object/<bucket>/<path> - PRIVATE
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "storage");
    if (idx === -1) return null;

    // Find 'object' segment
    const objectIdx = parts.findIndex((p) => p === "object");
    if (objectIdx === -1) return null;

    // After 'object' we may have: public|sign|<bucket>
    const after = parts.slice(objectIdx + 1);
    if (after.length < 2) return null;

    const mode = after[0];
    if (mode === "public" || mode === "sign") {
      const bucket = after[1];
      const path = after.slice(2).join("/");
      if (!bucket || !path) return null;
      // Public URLs should be fetched via HTTP, not storage API
      return { bucket, path, isPublic: true };
    }

    // /object/<bucket>/<path> - private
    const bucket = after[0];
    const path = after.slice(1).join("/");
    if (!bucket || !path) return null;
    return { bucket, path, isPublic: false };
  } catch {
    return null;
  }
}

function inferContentTypeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

const TRUSTED_IMAGE_HOSTS = [
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
  "s3.amazonaws.com",
  "s3.us-east-1.amazonaws.com",
  "s3.us-west-2.amazonaws.com",
  "s3.sa-east-1.amazonaws.com",
  "blob.core.windows.net",
  "res.cloudinary.com",
  "images.unsplash.com",
  "i.imgur.com",
  "lh3.googleusercontent.com",
  "app.eclini.com.br",
  "eclini.com.br",
];

async function fetchPublicImageToDataUrl(url: string, requestId: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("SOMENTE_HTTPS");
  }

  const backendUrl = Deno.env.get("SUPABASE_URL");
  if (!backendUrl) throw new Error("MISSING_SUPABASE_URL");
  const backendHost = new URL(backendUrl).host;

  const isSupabaseHost = parsed.host.endsWith(".supabase.co");
  const isAllowedHost = parsed.host === backendHost || isSupabaseHost || TRUSTED_IMAGE_HOSTS.includes(parsed.host);

  if (!isAllowedHost) {
    console.warn("[resolve-filiacao-assets] blocked host", { requestId, host: parsed.host });
    throw new Error("HOST_NAO_PERMITIDO");
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "LovableCloud/1.0",
      Accept: "image/*,*/*;q=0.8",
    },
  });

  if (!res.ok) throw new Error(`FALHA_FETCH_HTTP_${res.status}`);

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) throw new Error("NAO_E_IMAGEM");

  const buf = await res.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  return { contentType, base64, bytes: buf.byteLength, dataUrl: `data:${contentType};base64,${base64}` };
}

async function downloadStorageToDataUrl(supabaseAdmin: any, ref: StorageRef) {
  const { data, error } = await supabaseAdmin.storage.from(ref.bucket).download(ref.path);
  if (error || !data) throw new Error(`STORAGE_DOWNLOAD_FALHOU: ${error?.message || "sem dados"}`);

  const buf = await data.arrayBuffer();
  const contentType = (data as Blob).type || inferContentTypeFromPath(ref.path);
  const base64 = arrayBufferToBase64(buf);
  return { contentType, base64, bytes: buf.byteLength, dataUrl: `data:${contentType};base64,${base64}` };
}

type ResolveResult = {
  contentType: string;
  bytes: number;
  dataUrl: string;
  pngDims: { width: number; height: number } | null;
};

async function resolveImage(
  label: "photo" | "signature",
  supabaseAdmin: any,
  input: string,
  requestId: string,
  bucketHint: string
): Promise<ResolveResult> {
  if (isBlobUrl(input)) throw new Error(`${label.toUpperCase()}_BLOB_URL_PROIBIDA`);

  if (isDataImageUrl(input)) {
    // We intentionally allow legacy data URLs (but we audit them).
    const match = input.match(/^data:([^;]+);base64,(.+)$/i);
    if (!match) throw new Error(`${label.toUpperCase()}_DATAURL_INVALIDA`);
    const contentType = match[1].toLowerCase();
    const b64 = match[2];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pngDims = contentType === "image/png" ? getPngDimensions(bytes) : null;
    console.log("[resolve-filiacao-assets] legacy dataurl", { requestId, label, bytes: bytes.byteLength, contentType, pngDims });
    return { contentType, bytes: bytes.byteLength, dataUrl: input, pngDims };
  }

  // If it's a full storage URL from our backend
  if (input.startsWith("http")) {
    const storageRef = parseStorageUrlToRef(input);
    
    // If it's a PUBLIC storage URL, fetch via HTTP (don't use storage API)
    if (storageRef && storageRef.isPublic) {
      console.log("[resolve-filiacao-assets] fetching public storage URL via HTTP", { requestId, label, url: input });
      const out = await fetchPublicImageToDataUrl(input, requestId);
      const bytesArr = Uint8Array.from(atob(out.base64), (c) => c.charCodeAt(0));
      const pngDims = out.contentType === "image/png" ? getPngDimensions(bytesArr) : null;
      return { contentType: out.contentType, bytes: out.bytes, dataUrl: out.dataUrl, pngDims };
    }
    
    // If it's a PRIVATE storage URL, use storage API with service role
    if (storageRef && !storageRef.isPublic) {
      console.log("[resolve-filiacao-assets] downloading from private storage URL", { requestId, label, bucket: storageRef.bucket, path: storageRef.path });
      const out = await downloadStorageToDataUrl(supabaseAdmin, storageRef);
      const bytesArr = Uint8Array.from(atob(out.base64), (c) => c.charCodeAt(0));
      const pngDims = out.contentType === "image/png" ? getPngDimensions(bytesArr) : null;
      return { contentType: out.contentType, bytes: out.bytes, dataUrl: out.dataUrl, pngDims };
    }

    // Otherwise treat as public URL (SSRF allowlist)
    const out = await fetchPublicImageToDataUrl(input, requestId);
    const bytesArr = Uint8Array.from(atob(out.base64), (c) => c.charCodeAt(0));
    const pngDims = out.contentType === "image/png" ? getPngDimensions(bytesArr) : null;
    return { contentType: out.contentType, bytes: out.bytes, dataUrl: out.dataUrl, pngDims };
  }

  // Storage path (bucketHint) - use correct bucket based on label
  const actualBucket = label === "signature" ? "patient-signatures" : bucketHint;
  console.log("[resolve-filiacao-assets] downloading from storage path", { requestId, label, bucket: actualBucket, path: input });
  const out = await downloadStorageToDataUrl(supabaseAdmin, { bucket: actualBucket, path: input });
  const bytesArr = Uint8Array.from(atob(out.base64), (c) => c.charCodeAt(0));
  const pngDims = out.contentType === "image/png" ? getPngDimensions(bytesArr) : null;
  return { contentType: out.contentType, bytes: out.bytes, dataUrl: out.dataUrl, pngDims };
}

function validateSignature(resolved: ResolveResult): { valid: boolean; reason: string | null } {
  if (resolved.bytes < 2_000) {
    return { valid: false, reason: "assinatura muito pequena (<2KB)" };
  }

  if (resolved.contentType === "image/png" && resolved.pngDims) {
    if (resolved.pngDims.width <= 2 || resolved.pngDims.height <= 2) {
      return { valid: false, reason: `assinatura PNG inválida (${resolved.pngDims.width}x${resolved.pngDims.height})` };
    }
  }

  return { valid: true, reason: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });

  const requestId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    // Validate JWT (signing keys compatible)
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.warn("[resolve-filiacao-assets] unauthorized", { requestId, claimsError });
      return json(401, { error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));

    const cpf = normalizeCpf(body?.cpf);
    const photoUrl = body?.photo_url;
    const signatureUrl = body?.signature_url;

    if (!cpf || cpf.length !== 11) {
      return json(400, { error: "CPF inválido" });
    }

    if (typeof photoUrl !== "string" || !photoUrl.trim()) {
      return json(400, { error: "photo_url é obrigatório" });
    }

    if (typeof signatureUrl !== "string" && signatureUrl !== null && signatureUrl !== undefined) {
      return json(400, { error: "signature_url inválido" });
    }

    if (typeof photoUrl === "string" && isBlobUrl(photoUrl)) {
      return json(400, { error: "blob: proibido em photo_url" });
    }

    if (typeof signatureUrl === "string" && isBlobUrl(signatureUrl)) {
      return json(400, { error: "blob: proibido em signature_url" });
    }

    // Admin client for storage downloads (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    console.log("[resolve-filiacao-assets] payload", {
      requestId,
      cpf,
      photo_url: photoUrl,
      signature_url: signatureUrl ?? null,
    });

    const photoResolved = await resolveImage("photo", supabaseAdmin, photoUrl, requestId, "patient-photos");
    console.log("[resolve-filiacao-assets] photo.resolved", {
      requestId,
      contentType: photoResolved.contentType,
      bytes: photoResolved.bytes,
      pngDims: photoResolved.pngDims,
      kind: "dataurl",
    });

    let signatureResolved: ResolveResult | null = null;
    let signatureInvalidReason: string | null = null;

    if (typeof signatureUrl === "string" && signatureUrl.trim()) {
      signatureResolved = await resolveImage("signature", supabaseAdmin, signatureUrl, requestId, "patient-signatures");
      const v = validateSignature(signatureResolved);
      if (!v.valid) {
        signatureInvalidReason = v.reason;
        signatureResolved = null;
      }

      console.log("[resolve-filiacao-assets] signature.resolved", {
        requestId,
        contentType: signatureResolved?.contentType ?? null,
        bytes: signatureResolved?.bytes ?? null,
        pngDims: signatureResolved?.pngDims ?? null,
        valid: !signatureInvalidReason,
        invalidReason: signatureInvalidReason,
        kind: signatureResolved ? "dataurl" : "none",
      });
    } else {
      console.log("[resolve-filiacao-assets] signature.resolved", {
        requestId,
        valid: false,
        invalidReason: "sem assinatura",
        kind: "none",
      });
    }

    return json(200, {
      requestId,
      cpf,
      photo: {
        kind: "dataurl",
        contentType: photoResolved.contentType,
        bytes: photoResolved.bytes,
        dataUrl: photoResolved.dataUrl,
      },
      signature: {
        kind: signatureResolved ? "dataurl" : "none",
        contentType: signatureResolved?.contentType ?? null,
        bytes: signatureResolved?.bytes ?? null,
        dataUrl: signatureResolved?.dataUrl ?? null,
        invalidReason: signatureInvalidReason,
      },
    });
  } catch (err) {
    console.error("[resolve-filiacao-assets] unexpected", { requestId, err });
    return json(500, { error: "Erro interno" });
  }
});
