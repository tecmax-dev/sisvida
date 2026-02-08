import { supabase } from "@/integrations/supabase/client";

export type FiliacaoPdfPreparedAssets = {
  cpf: string;

  // Values as currently present in the caller record (may be null)
  photoOriginalUrl: string | null;
  signatureOriginalUrl: string | null;

  // Values picked directly from patients table (source-of-truth)
  patientPhotoUrl: string | null;
  patientSignatureUrl: string | null;

  // URLs effectively chosen to convert/embed
  photoResolvedUrl: string | null;
  signatureResolvedUrl: string | null;

  // Final embeddable values
  photoDataUrl: string;
  photoBytes: number;
  signatureDataUrl: string | null;
  signatureBytes: number | null;
  signatureInvalidReason: string | null;
};

function normalizeCpf(cpf: string | null | undefined): string {
  return (cpf || "").replace(/\D/g, "");
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) throw new Error("DATA_URL_INVALIDA");
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  return { mime, bytes: decodeBase64ToBytes(base64) };
}

function getPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return null;

  // IHDR width/height at fixed offsets 16..23
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = dv.getUint32(16);
  const height = dv.getUint32(20);
  return { width, height };
}

function isBlobUrl(url: string) {
  return url.startsWith("blob:");
}

function isDataImageUrl(url: string) {
  return url.startsWith("data:image/");
}

async function convertAnyUrlToDataUrlStrict(label: "foto" | "assinatura", url: string): Promise<string> {
  if (isBlobUrl(url)) {
    throw new Error(`${label.toUpperCase()}_BLOB_URL_PROIBIDA`);
  }

  if (isDataImageUrl(url)) return url;

  let resolvedUrl = url;

  // If it's a storage path, try to convert to signed/public URL.
  if (!resolvedUrl.startsWith("http")) {
    // 1) Try private signatures bucket
    const { data: signed } = await supabase.storage
      .from("patient-signatures")
      .createSignedUrl(resolvedUrl, 60 * 10);

    if (signed?.signedUrl) {
      resolvedUrl = signed.signedUrl;
    } else {
      // 2) Try public patient photos bucket
      const { data: pub } = supabase.storage.from("patient-photos").getPublicUrl(resolvedUrl);
      if (pub?.publicUrl) resolvedUrl = pub.publicUrl;
    }
  }

  const { data, error } = await supabase.functions.invoke("fetch-image-base64", {
    body: { url: resolvedUrl },
  });

  if (error) {
    const msg = (error as any)?.message || "Erro ao converter imagem";
    throw new Error(`${label.toUpperCase()}_CONVERSAO_FALHOU: ${msg}`);
  }

  if (!data?.base64 || typeof data.base64 !== "string") {
    throw new Error(`${label.toUpperCase()}_CONVERSAO_FALHOU: resposta inválida`);
  }

  const contentType = (typeof data.contentType === "string" && data.contentType) ? data.contentType : "image/png";
  const base64 = data.base64;

  return `data:${contentType};base64,${base64}`;
}

type SignatureValidation =
  | { ok: true }
  | { ok: false; reason: string };

function validateSignatureDataUrl(dataUrl: string): SignatureValidation {
  try {
    const { bytes, mime } = dataUrlToBytes(dataUrl);

    // Size guard (roughly same as backend guard)
    if (bytes.byteLength < 2_000) {
      return { ok: false, reason: "assinatura muito pequena (<2KB)" } as const;
    }

    // Detect 1x1 PNG (common blank)
    if (mime === "image/png") {
      const dims = getPngDimensions(bytes);
      if (dims && (dims.width <= 2 || dims.height <= 2)) {
        return { ok: false, reason: `assinatura PNG inválida (${dims.width}x${dims.height})` } as const;
      }
    }

    return { ok: true } as const;
  } catch {
    return { ok: false, reason: "assinatura base64 inválida" } as const;
  }
}

export async function prepareMemberImagesForFiliacaoPdf(params: {
  clinicId: string;
  cpf: string;
  photoUrl?: string | null;
  signatureUrl?: string | null;
  memberPhotoFallback?: string | null;
}): Promise<FiliacaoPdfPreparedAssets> {
  const cpfNormalized = normalizeCpf(params.cpf);
  if (!cpfNormalized) throw new Error("CPF_INVALIDO_PARA_PDF");

  // Always fetch from patients as source-of-truth
  const cpfCandidates = Array.from(
    new Set([
      cpfNormalized,
      params.cpf?.trim(),
    ].filter(Boolean) as string[])
  );

  const orFilter = cpfCandidates.map((c) => `cpf.eq.${c}`).join(",");

  const { data: patients, error: pErr } = await supabase
    .from("patients")
    .select("id, photo_url, signature_url, cpf, created_at")
    .eq("clinic_id", params.clinicId)
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(10);

  if (pErr) throw new Error(`ERRO_BUSCA_PATIENTS: ${pErr.message}`);

  const normalize = (v: string | null) => (v || "").replace(/\D/g, "");
  const matching = (patients || []).filter((p) => normalize(p.cpf) === cpfNormalized);

  const patientWithPhoto = matching.find((p) => !!p.photo_url);
  const patientWithSignature = matching.find((p) => !!p.signature_url);

  const photoOriginalUrl = params.photoUrl ?? null;
  const signatureOriginalUrl = params.signatureUrl ?? null;

  // Prioridade obrigatória: patients.* (fonte da verdade)
  const patientPhotoUrl = patientWithPhoto?.photo_url || null;
  const patientSignatureUrl = patientWithSignature?.signature_url || null;

  const photoResolvedUrl = patientPhotoUrl || params.photoUrl || params.memberPhotoFallback || null;

  const signatureResolvedUrl = patientSignatureUrl || params.signatureUrl || null;

  if (!photoResolvedUrl) {
    throw new Error("FOTO_OBRIGATORIA_AUSENTE_PARA_PDF");
  }

  const photoDataUrl = await convertAnyUrlToDataUrlStrict("foto", photoResolvedUrl);
  const { bytes: photoBytesArr } = dataUrlToBytes(photoDataUrl);

  let signatureDataUrl: string | null = null;
  let signatureBytes: number | null = null;
  let signatureInvalidReason: string | null = null;

  if (signatureResolvedUrl) {
    const sigData = await convertAnyUrlToDataUrlStrict("assinatura", signatureResolvedUrl);
    const validation = validateSignatureDataUrl(sigData);
    if (validation.ok === true) {
      signatureDataUrl = sigData;
      signatureBytes = dataUrlToBytes(sigData).bytes.byteLength;
    }

    if (validation.ok === false) {
      signatureInvalidReason = validation.reason;
      signatureDataUrl = null;
      signatureBytes = null;
    }
  }

  return {
    cpf: cpfNormalized,
    photoOriginalUrl,
    signatureOriginalUrl,
    patientPhotoUrl: patientPhotoUrl,
    patientSignatureUrl: patientSignatureUrl,
    photoResolvedUrl,
    signatureResolvedUrl,
    photoDataUrl,
    photoBytes: photoBytesArr.byteLength,
    signatureDataUrl,
    signatureBytes,
    signatureInvalidReason,
  };
}
