import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function jsonResponse(
  requestId: string,
  payload: unknown,
  status = 200,
  logLabel = "return",
): Response {
  const body = JSON.stringify(payload);
  console.log(`[accounting-office-portal-auth][${requestId}] ${logLabel} status=${status}`);
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function preflightResponse(requestId: string): Response {
  console.log(`[accounting-office-portal-auth][${requestId}] return preflight 204`);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

async function safeJson(req: Request, requestId: string): Promise<JsonRecord> {
  const text = await req.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as JsonRecord;
    throw new Error("json_not_object");
  } catch (err) {
    console.error(`[accounting-office-portal-auth][${requestId}] bad_json:`, err);
    throw new AppError("JSON inválido", { status: 400, code: "bad_json", expose: true });
  }
}

function extractEmailFromText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase().trim() : null;
}

function normalizeAccessCode(input: unknown): string {
  return typeof input === "string" ? input.trim().toUpperCase() : "";
}

function getRequestId(req: Request): string {
  const headerId = req.headers.get("x-request-id")?.trim();
  if (headerId) return headerId;
  return crypto.randomUUID();
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("timeout:");
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms);
    }),
  ]);
}

serve(async (req) => {
  // 1) OPTIONS tem que ser a PRIMEIRA instrução (sem Supabase/async extra)
  const requestId = getRequestId(req);
  if (req.method === "OPTIONS") {
    return ensureCors(preflightResponse(requestId));
  }

  const startTime = Date.now();
  const origin = req.headers.get("origin") || "unknown";
  console.log(`[accounting-office-portal-auth][${requestId}] start method=${req.method} origin=${origin}`);

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
    const action = typeof body.action === "string" ? body.action : "";

    console.log(`[accounting-office-portal-auth][${requestId}] action=${action || "(missing)"}`);

    if (action === "login") {
      const email = typeof body.email === "string" ? body.email : "";
      const accessCode = body.access_code;

      const cleanEmail = email.toLowerCase().trim();
      const cleanAccessCode = normalizeAccessCode(accessCode);

      if (!cleanEmail || !cleanAccessCode) {
        return ensureCors(
          jsonResponse(
            requestId,
            { success: false, error: "E-mail e código de acesso são obrigatórios", code: "missing_credentials", request_id: requestId },
            400,
            "return login missing_credentials",
          ),
        );
      }

      const officeSelect = "id, name, email, clinic_id, access_code, access_code_expires_at, is_active, union_entity_id";

      let office: any = null;

      // 1) Email exato
      const exact = await withTimeout(
        supabase.from("accounting_offices").select(officeSelect).eq("email", cleanEmail).maybeSingle(),
        15000,
        "db:accounting_offices:exact",
      );

      if (!exact.error && exact.data) {
        office = exact.data;
      } else {
        // 2) Fallback: e-mails com lixo (ex.: "email: x@y.com")
        const cand = await withTimeout(
          supabase.from("accounting_offices").select(officeSelect).ilike("email", `%${cleanEmail}%`).limit(10),
          15000,
          "db:accounting_offices:candidates",
        );

        if (!cand.error && cand.data?.length) {
          office =
            cand.data.find((c: any) => {
              const extracted = extractEmailFromText(c.email);
              return extracted === cleanEmail;
            }) ?? null;
        }
      }

      if (!office) {
        return ensureCors(
          jsonResponse(
            requestId,
            { success: false, error: "E-mail não encontrado", code: "email_not_found", request_id: requestId },
            404,
            "return login email_not_found",
          ),
        );
      }

      if (!office.is_active) {
        return ensureCors(
          jsonResponse(
            requestId,
            { success: false, error: "Escritório inativo. Entre em contato com o sindicato.", code: "office_inactive", request_id: requestId },
            403,
            "return login office_inactive",
          ),
        );
      }

      const storedAccessCode = normalizeAccessCode(office.access_code);
      if (!storedAccessCode) {
        return ensureCors(
          jsonResponse(
            requestId,
            {
              success: false,
              error: "Código de acesso não configurado. Entre em contato com o sindicato.",
              code: "access_code_missing",
              request_id: requestId,
            },
            403,
            "return login access_code_missing",
          ),
        );
      }

      if (storedAccessCode !== cleanAccessCode) {
        return ensureCors(
          jsonResponse(
            requestId,
            { success: false, error: "Código de acesso inválido", code: "invalid_access_code", request_id: requestId },
            401,
            "return login invalid_access_code",
          ),
        );
      }

      if (office.access_code_expires_at && new Date(office.access_code_expires_at) < new Date()) {
        return ensureCors(
          jsonResponse(
            requestId,
            { success: false, error: "Código de acesso expirado. Solicite um novo código.", code: "access_code_expired", request_id: requestId },
            401,
            "return login access_code_expired",
          ),
        );
      }

      let unionEntity: any = null;
      if (office.union_entity_id) {
        const entityRes = await withTimeout(
          supabase
            .from("union_entities")
            .select("id, razao_social, nome_fantasia, cnpj, entity_type")
            .eq("id", office.union_entity_id)
            .maybeSingle(),
          15000,
          "db:union_entities",
        );
        if (!entityRes.error) unionEntity = entityRes.data;
      }

      // best-effort: não quebrar login por falha de update/log
      try {
        await withTimeout(
          supabase.from("accounting_offices").update({ portal_last_access_at: new Date().toISOString() }).eq("id", office.id),
          15000,
          "db:accounting_offices:update_last_access",
        );
      } catch (e) {
        console.error(`[accounting-office-portal-auth][${requestId}] warn update_last_access failed:`, e);
      }

      try {
        await withTimeout(
          supabase.from("accounting_office_portal_logs").insert({
            accounting_office_id: office.id,
            action: "login",
            ip_address: req.headers.get("x-forwarded-for") || "unknown",
            user_agent: req.headers.get("user-agent") || "unknown",
            details: { union_entity_id: office.union_entity_id, request_id: requestId },
          }),
          15000,
          "db:accounting_office_portal_logs:insert",
        );
      } catch (e) {
        console.error(`[accounting-office-portal-auth][${requestId}] warn portal_logs insert failed:`, e);
      }

      const sessionToken = btoa(`${office.id}:${Date.now()}`);
      const elapsed = Date.now() - startTime;

      return ensureCors(
        jsonResponse(
          requestId,
          {
            success: true,
            accounting_office: {
              id: office.id,
              name: office.name,
              email: office.email,
              clinic_id: office.clinic_id,
              union_entity_id: office.union_entity_id,
            },
            union_entity: unionEntity,
            session_token: sessionToken,
            request_id: requestId,
            elapsed_ms: elapsed,
          },
          200,
          "return login success",
        ),
      );
    }

    if (action === "get_employers") {
      const accountingOfficeId = typeof body.accounting_office_id === "string" ? body.accounting_office_id : "";
      if (!accountingOfficeId) {
        throw new AppError("ID do escritório não informado", { status: 400, code: "missing_accounting_office_id", expose: true });
      }

      const officeRes = await withTimeout(
        supabase.from("accounting_offices").select("union_entity_id").eq("id", accountingOfficeId).maybeSingle(),
        15000,
        "db:accounting_offices:by_id",
      );

      const linksRes = await withTimeout(
        supabase
          .from("accounting_office_employers")
          .select("employer_id")
          .eq("accounting_office_id", accountingOfficeId),
        15000,
        "db:accounting_office_employers",
      );

      if (linksRes.error) {
        console.error(`[accounting-office-portal-auth][${requestId}] linksError:`, linksRes.error);
        throw new AppError("Erro ao buscar empresas vinculadas", { status: 500, code: "db_links_error", expose: false });
      }

      const employerIds = linksRes.data?.map((l) => l.employer_id) ?? [];
      if (employerIds.length === 0) {
        return ensureCors(jsonResponse(requestId, { employers: [], request_id: requestId }, 200, "return get_employers empty"));
      }

      let query = supabase
        .from("employers")
        .select("id, name, cnpj, trade_name, union_entity_id, phone, email")
        .in("id", employerIds)
        .order("name");

      if (officeRes.data?.union_entity_id) {
        query = query.eq("union_entity_id", officeRes.data.union_entity_id);
      }

      const employersRes = await withTimeout(query, 15000, "db:employers:in_ids");
      if (employersRes.error) {
        console.error(`[accounting-office-portal-auth][${requestId}] employersError:`, employersRes.error);
        throw new AppError("Erro ao buscar empresas", { status: 500, code: "db_employers_error", expose: false });
      }

      try {
        await withTimeout(
          supabase.from("accounting_office_portal_logs").insert({
            accounting_office_id: accountingOfficeId,
            action: "view_employers",
            ip_address: req.headers.get("x-forwarded-for") || "unknown",
            user_agent: req.headers.get("user-agent") || "unknown",
            details: { request_id: requestId },
          }),
          15000,
          "db:accounting_office_portal_logs:view_employers",
        );
      } catch (e) {
        console.error(`[accounting-office-portal-auth][${requestId}] warn portal_logs view_employers failed:`, e);
      }

      const elapsed = Date.now() - startTime;
      return ensureCors(
        jsonResponse(
          requestId,
          { employers: employersRes.data ?? [], request_id: requestId, elapsed_ms: elapsed },
          200,
          "return get_employers success",
        ),
      );
    }

    if (action === "get_contributions") {
      const accountingOfficeId = typeof body.accounting_office_id === "string" ? body.accounting_office_id : "";
      if (!accountingOfficeId) {
        throw new AppError("ID do escritório não informado", { status: 400, code: "missing_accounting_office_id", expose: true });
      }

      const officeRes = await withTimeout(
        supabase.from("accounting_offices").select("union_entity_id, clinic_id").eq("id", accountingOfficeId).maybeSingle(),
        15000,
        "db:accounting_offices:union_clinic",
      );

      const linksRes = await withTimeout(
        supabase
          .from("accounting_office_employers")
          .select("employer_id")
          .eq("accounting_office_id", accountingOfficeId),
        15000,
        "db:accounting_office_employers",
      );

      if (linksRes.error) {
        console.error(`[accounting-office-portal-auth][${requestId}] linksError:`, linksRes.error);
        throw new AppError("Erro ao buscar empresas vinculadas", { status: 500, code: "db_links_error", expose: false });
      }

      const employerIds = linksRes.data?.map((l) => l.employer_id) ?? [];
      if (employerIds.length === 0) {
        return ensureCors(jsonResponse(requestId, { contributions: [], request_id: requestId }, 200, "return get_contributions empty"));
      }

      let filteredEmployerIds = employerIds;
      if (officeRes.data?.union_entity_id) {
        const validEmployers = await withTimeout(
          supabase
            .from("employers")
            .select("id")
            .in("id", employerIds)
            .eq("union_entity_id", officeRes.data.union_entity_id),
          15000,
          "db:employers:filter_union",
        );
        if (!validEmployers.error) {
          filteredEmployerIds = validEmployers.data?.map((e) => e.id) ?? [];
        }
      }

      if (filteredEmployerIds.length === 0) {
        return ensureCors(jsonResponse(requestId, { contributions: [], request_id: requestId }, 200, "return get_contributions none_after_filter"));
      }

      let hidePendingBeforeDate: string | null = null;
      if (officeRes.data?.clinic_id) {
        const clinicRes = await withTimeout(
          supabase.from("clinics").select("hide_pending_before_date").eq("id", officeRes.data.clinic_id).maybeSingle(),
          15000,
          "db:clinics:hide_pending",
        );
        if (!clinicRes.error) hidePendingBeforeDate = (clinicRes.data?.hide_pending_before_date as string | null) ?? null;
      }

      const contribRes = await withTimeout(
        supabase
          .from("employer_contributions")
          .select(`
            *,
            employer:employers(id, name, cnpj),
            contribution_type:contribution_types(name),
            negotiation:debt_negotiations(id, negotiation_code, status, installments_count)
          `)
          .in("employer_id", filteredEmployerIds)
          .order("competence_year", { ascending: false })
          .order("competence_month", { ascending: false }),
        15000,
        "db:employer_contributions",
      );

      if (contribRes.error) {
        console.error(`[accounting-office-portal-auth][${requestId}] contributionsError:`, contribRes.error);
        throw new AppError("Erro ao buscar contribuições", { status: 500, code: "db_contributions_error", expose: false });
      }

      let filtered = contribRes.data ?? [];
      if (hidePendingBeforeDate) {
        const hideDate = new Date(hidePendingBeforeDate);
        filtered = filtered.filter((c: any) => {
          if ((c.status === "pending" || c.status === "overdue") && c.due_date) {
            const dueDate = new Date(c.due_date);
            return dueDate >= hideDate;
          }
          return true;
        });
      }

      try {
        await withTimeout(
          supabase.from("accounting_office_portal_logs").insert({
            accounting_office_id: accountingOfficeId,
            action: "view_contributions",
            ip_address: req.headers.get("x-forwarded-for") || "unknown",
            user_agent: req.headers.get("user-agent") || "unknown",
            details: { request_id: requestId },
          }),
          15000,
          "db:accounting_office_portal_logs:view_contributions",
        );
      } catch (e) {
        console.error(`[accounting-office-portal-auth][${requestId}] warn portal_logs view_contributions failed:`, e);
      }

      const elapsed = Date.now() - startTime;
      return ensureCors(
        jsonResponse(
          requestId,
          { contributions: filtered, request_id: requestId, elapsed_ms: elapsed },
          200,
          "return get_contributions success",
        ),
      );
    }

    throw new AppError("Ação não reconhecida", { status: 400, code: "unknown_action", expose: true });
  } catch (err) {
    // 2) ÚNICO catch no topo: erros sync/async/db/timeout
    const elapsed = Date.now() - startTime;

    const appErr = err instanceof AppError ? err : null;
    const timeout = isTimeoutError(err);

    if (!appErr) {
      console.error(`[accounting-office-portal-auth][${requestId}] catch internal_error elapsed=${elapsed}ms`, err);
    } else {
      console.error(`[accounting-office-portal-auth][${requestId}] catch ${appErr.code} status=${appErr.status} elapsed=${elapsed}ms`, appErr.message);
    }

    const status = appErr?.status ?? (timeout ? 504 : 500);
    const code = appErr?.code ?? (timeout ? "timeout" : "internal_error");

    // 4) NÃO mascarar: erro interno vem com code + request_id (mensagem pública genérica)
    const message = appErr?.expose
      ? appErr.message
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
