import { supabase } from "@/integrations/supabase/client";

export type UploadStage = "idle" | "preparing" | "uploading" | "finishing" | "done" | "error";

export interface UploadProgressState {
  stage: UploadStage;
  percent: number;
  message: string;
}

export function stageMessage(stage: UploadStage, percent: number, fileName?: string): string {
  switch (stage) {
    case "preparing":
      return fileName ? `Preparando ${fileName}...` : "Preparando arquivo...";
    case "uploading":
      if (percent >= 99) return "Quase lá, finalizando o envio...";
      return `Enviando arquivo... ${percent}%`;
    case "finishing":
      return "Processando arquivo no servidor...";
    case "done":
      return "Envio concluído com sucesso!";
    case "error":
      return "Falha no envio.";
    default:
      return "";
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
  /** Tempo limite em ms (padrão: 3 minutos) */
  timeoutMs?: number;
  onProgress?: (state: UploadProgressState) => void;
}

/**
 * Upload para o Supabase Storage via XHR, com progresso real (%),
 * mensagens claras por etapa e tempo limite configurável.
 */
export async function uploadWithProgress({
  bucket,
  path,
  file,
  upsert = false,
  timeoutMs = 3 * 60 * 1000,
  onProgress,
}: UploadOptions): Promise<void> {
  const emit = (stage: UploadStage, percent: number) =>
    onProgress?.({ stage, percent, message: stageMessage(stage, percent, file.name) });

  emit("preparing", 0);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token || SUPABASE_KEY;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, true);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("x-upsert", upsert ? "true" : "false");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
      emit("uploading", percent);
    };

    xhr.upload.onload = () => emit("finishing", 99);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        emit("done", 100);
        resolve();
        return;
      }
      let message = `Falha no envio (código ${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText);
        if (body?.message) message = body.message;
      } catch {
        /* resposta sem JSON */
      }
      if (xhr.status === 413) {
        message = "Arquivo muito grande para o servidor. Reduza o tamanho e tente novamente.";
      }
      emit("error", 0);
      reject(new Error(message));
    };

    xhr.ontimeout = () => {
      emit("error", 0);
      reject(
        new Error(
          "Tempo limite excedido no envio. Verifique sua conexão e tente novamente com um arquivo menor.",
        ),
      );
    };

    xhr.onerror = () => {
      emit("error", 0);
      reject(new Error("Conexão interrompida durante o envio. Tente novamente."));
    };

    emit("uploading", 0);
    xhr.send(file);
  });
}