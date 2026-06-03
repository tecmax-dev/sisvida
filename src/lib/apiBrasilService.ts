import { supabase } from "@/integrations/supabase/client";

export interface ApiBrasilQuery {
  search: string;
  homolog?: boolean;
  endpoint?: string;
  timeoutMs?: number;
}

export interface ApiBrasilOk<T = unknown> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiBrasilErr {
  ok: false;
  status: number;
  error: { message: string; code?: string; raw?: unknown };
}

export type ApiBrasilResult<T = unknown> = ApiBrasilOk<T> | ApiBrasilErr;

/**
 * Serviço dedicado para a APIBrasil. Toda comunicação passa pela edge function
 * `apibrasil-proxy`, que mantém o Bearer token no servidor.
 */
export class ApiBrasilService {
  async query<T = unknown>(params: ApiBrasilQuery): Promise<ApiBrasilResult<T>> {
    const { data, error } = await supabase.functions.invoke<ApiBrasilResult<T>>("apibrasil-proxy", {
      body: {
        endpoint: params.endpoint ?? "apis",
        search: params.search,
        homolog: params.homolog ?? false,
        timeoutMs: params.timeoutMs,
      },
    });

    if (error) {
      return {
        ok: false,
        status: 0,
        error: { message: error.message ?? "Falha ao invocar apibrasil-proxy", code: "INVOKE_ERROR" },
      };
    }
    return (data ?? {
      ok: false,
      status: 0,
      error: { message: "Resposta vazia do proxy", code: "EMPTY_RESPONSE" },
    }) as ApiBrasilResult<T>;
  }
}

export const apiBrasilService = new ApiBrasilService();

// Exemplo de uso:
// const res = await apiBrasilService.query({ search: "abc-1234-abc124", homolog: false });
// if (res.ok) console.log(res.data); else console.error(res.error.message);