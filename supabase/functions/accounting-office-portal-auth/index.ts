import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============ CORS CENTRALIZADO ============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Helpers para garantir CORS em TODAS as respostas
function corsResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function corsError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============ SUPABASE CLIENT (module-level para reduzir cold start) ============
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function extractEmailFromText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase().trim() : null;
}

function normalizeAccessCode(input: unknown): string {
  return typeof input === "string" ? input.trim().toUpperCase() : "";
}

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const origin = req.headers.get("origin") || "unknown";
  
  console.log(`[accounting-office-portal-auth][${requestId}] ${req.method} from ${origin}`);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    console.log(`[accounting-office-portal-auth][${requestId}] Preflight OK`);
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, email, access_code, accounting_office_id } = await req.json();
    console.log(`[accounting-office-portal-auth][${requestId}] Action: ${action}`);

    // Normalizações
    const cleanEmail = (typeof email === "string" ? email : "").toLowerCase().trim();
    const cleanAccessCode = normalizeAccessCode(access_code);

    if (action === "login") {
      // Validar email e código de acesso
      if (!cleanEmail || !cleanAccessCode) {
        console.log(`[accounting-office-portal-auth][${requestId}] Missing credentials`);
        return corsError("E-mail e código de acesso são obrigatórios", 400);
      }

      const officeSelect = "id, name, email, clinic_id, access_code, access_code_expires_at, is_active, union_entity_id";

      // 1) Tentativa padrão (email exato)
      let office: any = null;
      const { data: officeExact, error: exactError } = await supabase
        .from("accounting_offices")
        .select(officeSelect)
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!exactError && officeExact) {
        office = officeExact;
      } else {
        // 2) Fallback: tolerar cadastro ruim (ex.: "email dp1@..."), buscando candidatos
        const { data: candidates, error: candError } = await supabase
          .from("accounting_offices")
          .select(officeSelect)
          .ilike("email", `%${cleanEmail}%`)
          .limit(10);

        if (!candError && candidates?.length) {
          office = candidates.find((c: any) => {
            const extracted = extractEmailFromText(c.email);
            return extracted === cleanEmail;
          }) || null;
        }
      }

      if (!office) {
        console.log(`[accounting-office-portal-auth][${requestId}] Email not found: ${cleanEmail}`);
        return corsError("E-mail não encontrado", 404);
      }

      if (!office.is_active) {
        console.log(`[accounting-office-portal-auth][${requestId}] Office inactive: ${office.id}`);
        return corsError("Escritório inativo. Entre em contato com o sindicato.", 403);
      }

      const storedAccessCode = normalizeAccessCode(office.access_code);
      if (!storedAccessCode) {
        console.log(`[accounting-office-portal-auth][${requestId}] No access code configured for office: ${office.id}`);
        return corsError("Código de acesso não configurado. Entre em contato com o sindicato.", 403);
      }

      if (storedAccessCode !== cleanAccessCode) {
        console.log(`[accounting-office-portal-auth][${requestId}] Invalid access code for office: ${office.id}`);
        return corsError("Código de acesso inválido", 401);
      }

      // Verificar expiração
      if (office.access_code_expires_at && new Date(office.access_code_expires_at) < new Date()) {
        console.log(`[accounting-office-portal-auth][${requestId}] Access code expired for office: ${office.id}`);
        return corsError("Código de acesso expirado. Solicite um novo código.", 401);
      }

      // Buscar dados do sindicato vinculado (se houver)
      let unionEntity = null;
      if (office.union_entity_id) {
        const { data: entity } = await supabase
          .from("union_entities")
          .select("id, razao_social, nome_fantasia, cnpj, entity_type")
          .eq("id", office.union_entity_id)
          .maybeSingle();
        unionEntity = entity;
      }

      // Atualizar último acesso
      await supabase
        .from("accounting_offices")
        .update({ portal_last_access_at: new Date().toISOString() })
        .eq("id", office.id);

      // Registrar log
      await supabase.from("accounting_office_portal_logs").insert({
        accounting_office_id: office.id,
        action: "login",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        details: { union_entity_id: office.union_entity_id },
      });

      // Gerar token de sessão simples (base64 do office_id + timestamp)
      const sessionToken = btoa(`${office.id}:${Date.now()}`);

      const elapsed = Date.now() - startTime;
      console.log(`[accounting-office-portal-auth][${requestId}] Login successful for office: ${office.id} in ${elapsed}ms`);

      return corsResponse({
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
      });
    }

    if (action === "get_employers") {
      if (!accounting_office_id) {
        return corsError("ID do escritório não informado", 400);
      }

      // Buscar o escritório para obter o union_entity_id
      const { data: office } = await supabase
        .from("accounting_offices")
        .select("union_entity_id")
        .eq("id", accounting_office_id)
        .maybeSingle();

      // Buscar empresas vinculadas
      const { data: links, error: linksError } = await supabase
        .from("accounting_office_employers")
        .select("employer_id")
        .eq("accounting_office_id", accounting_office_id);

      if (linksError) {
        console.error(`[accounting-office-portal-auth][${requestId}] Error fetching employer links:`, linksError);
        return corsError("Erro ao buscar empresas vinculadas", 500);
      }

      const employerIds = links?.map(l => l.employer_id) || [];

      if (employerIds.length === 0) {
        return corsResponse({ employers: [] });
      }

      // Buscar dados das empresas - filtrar pelo mesmo union_entity_id para isolamento
      let query = supabase
        .from("employers")
        .select("id, name, cnpj, trade_name, union_entity_id, phone, email")
        .in("id", employerIds)
        .order("name");

      // Se o escritório tem um sindicato vinculado, filtrar apenas empresas do mesmo sindicato
      if (office?.union_entity_id) {
        query = query.eq("union_entity_id", office.union_entity_id);
      }

      const { data: employers, error: employersError } = await query;

      if (employersError) {
        console.error(`[accounting-office-portal-auth][${requestId}] Error fetching employers:`, employersError);
        return corsError("Erro ao buscar empresas", 500);
      }

      // Registrar log
      await supabase.from("accounting_office_portal_logs").insert({
        accounting_office_id,
        action: "view_employers",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      const elapsed = Date.now() - startTime;
      console.log(`[accounting-office-portal-auth][${requestId}] get_employers OK in ${elapsed}ms`);

      return corsResponse({ employers });
    }

    if (action === "get_contributions") {
      if (!accounting_office_id) {
        return corsError("ID do escritório não informado", 400);
      }

      // Buscar o escritório para obter o union_entity_id
      const { data: office } = await supabase
        .from("accounting_offices")
        .select("union_entity_id")
        .eq("id", accounting_office_id)
        .maybeSingle();

      // Buscar empresas vinculadas
      const { data: links, error: linksError } = await supabase
        .from("accounting_office_employers")
        .select("employer_id")
        .eq("accounting_office_id", accounting_office_id);

      if (linksError) {
        return corsError("Erro ao buscar empresas vinculadas", 500);
      }

      const employerIds = links?.map(l => l.employer_id) || [];

      if (employerIds.length === 0) {
        return corsResponse({ contributions: [] });
      }

      // Se o escritório tem um sindicato vinculado, filtrar apenas empresas do mesmo sindicato
      let filteredEmployerIds = employerIds;
      if (office?.union_entity_id) {
        const { data: validEmployers } = await supabase
          .from("employers")
          .select("id")
          .in("id", employerIds)
          .eq("union_entity_id", office.union_entity_id);
        
        filteredEmployerIds = validEmployers?.map(e => e.id) || [];
      }

      if (filteredEmployerIds.length === 0) {
        return corsResponse({ contributions: [] });
      }

      // Buscar configuração de ocultação de pendências (usar clinic_id do escritório)
      const { data: officeData } = await supabase
        .from("accounting_offices")
        .select("clinic_id")
        .eq("id", accounting_office_id)
        .maybeSingle();

      let hidePendingBeforeDate: string | null = null;
      if (officeData?.clinic_id) {
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("hide_pending_before_date")
          .eq("id", officeData.clinic_id)
          .maybeSingle();
        
        hidePendingBeforeDate = clinicData?.hide_pending_before_date || null;
      }

      // Buscar contribuições de todas as empresas vinculadas com informação de negociação
      const { data: contributions, error } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employer:employers(id, name, cnpj),
          contribution_type:contribution_types(name),
          negotiation:debt_negotiations(id, negotiation_code, status, installments_count)
        `)
        .in("employer_id", filteredEmployerIds)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (error) {
        console.error(`[accounting-office-portal-auth][${requestId}] Error fetching contributions:`, error);
        return corsError("Erro ao buscar contribuições", 500);
      }

      // Filtrar contribuições ocultadas (pendentes/vencidas anteriores à data configurada)
      let filteredContributions = contributions || [];
      if (hidePendingBeforeDate) {
        const hideDate = new Date(hidePendingBeforeDate);
        filteredContributions = filteredContributions.filter(c => {
          // Ocultar apenas pendentes/vencidas anteriores à data
          if ((c.status === 'pending' || c.status === 'overdue') && c.due_date) {
            const dueDate = new Date(c.due_date);
            return dueDate >= hideDate;
          }
          return true; // Manter pagas, canceladas, awaiting_value, etc.
        });
      }

      // Registrar log
      await supabase.from("accounting_office_portal_logs").insert({
        accounting_office_id,
        action: "view_contributions",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      const elapsed = Date.now() - startTime;
      console.log(`[accounting-office-portal-auth][${requestId}] get_contributions OK in ${elapsed}ms`);

      return corsResponse({ contributions: filteredContributions });
    }

    console.log(`[accounting-office-portal-auth][${requestId}] Unknown action: ${action}`);
    return corsError("Ação não reconhecida", 400);

  } catch (error: any) {
    console.error(`[accounting-office-portal-auth][${requestId}] Error:`, error);
    return corsError("Erro interno do servidor", 500);
  }
});
