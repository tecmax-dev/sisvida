import { supabase } from "@/integrations/supabase/client";

const BUCKET = "sindical-documentos";
const PUBLIC_PATH_MARKER = `/object/public/${BUCKET}/`;
const SIGNED_PATH_MARKER = `/object/sign/${BUCKET}/`;

/**
 * Resolve uma URL armazenada para o bucket privado `sindical-documentos`
 * em uma signed URL acessível. Aceita URLs legadas com `/object/public/...`
 * (geradas antes da correção) e também caminhos brutos.
 */
export async function resolveSindicalDocumentoUrl(
  value: string | null | undefined
): Promise<string | null> {
  if (!value) return null;

  // Já é signed URL — usar direto
  if (value.includes(SIGNED_PATH_MARKER) || value.includes("token=")) {
    return value;
  }

  let path: string | null = null;

  if (value.includes(PUBLIC_PATH_MARKER)) {
    path = value.split(PUBLIC_PATH_MARKER)[1] ?? null;
  } else if (!value.startsWith("http")) {
    path = value.replace(/^\/+/, "");
  } else {
    // URL externa qualquer — retornar como está
    return value;
  }

  if (!path) return value;

  // Remove querystring caso exista
  path = path.split("?")[0];

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1h

  if (error || !data?.signedUrl) {
    console.warn("[sindical-documentos] Falha ao gerar signed URL:", error);
    return null;
  }

  return data.signedUrl;
}