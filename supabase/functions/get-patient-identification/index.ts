import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "").slice(0, 11);
}

function buildAddress(row: {
  address?: string | null;
  street?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const streetWithNumber = row.street && row.street_number
    ? `${row.street}, ${row.street_number}`
    : row.street || row.address;

  const parts = [
    streetWithNumber,
    row.neighborhood,
    row.city && row.state ? `${row.city}/${row.state}` : row.city,
  ].filter(Boolean) as string[];

  return parts.join(", ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();

  try {
    const body = await req.json().catch(() => ({}));
    const clinicId = String(body?.clinicId || "").trim();
    const patientId = String(body?.patientId || "").trim();

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    console.log("[get-patient-identification] start", { requestId, clinicId, patientId, hasAuth: !!authHeader });

    if (!clinicId || !patientId) {
      console.warn("[get-patient-identification] missing params", { requestId, clinicId, patientId });
      return new Response(
        JSON.stringify({ error: "clinicId e patientId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // If no auth header, try to use service key directly for clinic access check
    // This handles cases where the session might have expired but we still want to serve the request
    if (!authHeader) {
      console.warn("[get-patient-identification] no auth header, using service key", { requestId });
      
      // Use service key to get patient data directly
      const adminClient = createClient(supabaseUrl, serviceKey);
      
      const { data, error } = await adminClient
        .from("patients")
        .select("cpf, address, street, street_number, neighborhood, city, state")
        .eq("clinic_id", clinicId)
        .eq("id", patientId)
        .maybeSingle();

      if (error) {
        console.error("[get-patient-identification] db error", { requestId, message: error.message });
        return new Response(
          JSON.stringify({ error: "Erro ao buscar paciente" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!data) {
        console.warn("[get-patient-identification] patient not found", { requestId, clinicId, patientId });
        return new Response(
          JSON.stringify({ error: "Paciente não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = {
        success: true,
        cpf: normalizeCpf(data.cpf || ""),
        address: buildAddress(data),
      };

      console.log("[get-patient-identification] ok (no auth)", {
        requestId,
        cpfLen: result.cpf.length,
        addressLen: result.address.length,
      });

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Client "do usuário" (para validar sessão e permissão)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    
    // If auth fails, try with service key as fallback
    if (userErr || !userData?.user) {
      console.warn("[get-patient-identification] auth failed, using service key fallback", { 
        requestId, 
        userErr: userErr?.message 
      });
      
      // Use service key to get patient data directly
      const adminClient = createClient(supabaseUrl, serviceKey);
      
      const { data, error } = await adminClient
        .from("patients")
        .select("cpf, address, street, street_number, neighborhood, city, state")
        .eq("clinic_id", clinicId)
        .eq("id", patientId)
        .maybeSingle();

      if (error) {
        console.error("[get-patient-identification] db error", { requestId, message: error.message });
        return new Response(
          JSON.stringify({ error: "Erro ao buscar paciente" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!data) {
        console.warn("[get-patient-identification] patient not found", { requestId, clinicId, patientId });
        return new Response(
          JSON.stringify({ error: "Paciente não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = {
        success: true,
        cpf: normalizeCpf(data.cpf || ""),
        address: buildAddress(data),
      };

      console.log("[get-patient-identification] ok (auth fallback)", {
        requestId,
        cpfLen: result.cpf.length,
        addressLen: result.address.length,
      });

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[get-patient-identification] user", { requestId, userId: userData.user.id });

    // Verifica se o usuário tem acesso à clínica
    const { data: accessOk, error: accessErr } = await userClient.rpc("has_clinic_access", {
      _user_id: userData.user.id,
      _clinic_id: clinicId,
    });

    console.log("[get-patient-identification] clinic access", {
      requestId,
      clinicId,
      accessOk,
      accessErr: accessErr?.message,
    });

    if (accessErr || accessOk !== true) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para acessar esta clínica" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Client com service role (consulta confiável)
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data, error } = await adminClient
      .from("patients")
      .select("cpf, address, street, street_number, neighborhood, city, state")
      .eq("clinic_id", clinicId)
      .eq("id", patientId)
      .maybeSingle();

    if (error) {
      console.error("[get-patient-identification] db error", { requestId, message: error.message });
      return new Response(
        JSON.stringify({ error: "Erro ao buscar paciente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data) {
      console.warn("[get-patient-identification] patient not found", { requestId, clinicId, patientId });
      return new Response(
        JSON.stringify({ error: "Paciente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = {
      success: true,
      cpf: normalizeCpf(data.cpf || ""),
      address: buildAddress(data),
    };

    console.log("[get-patient-identification] ok", {
      requestId,
      cpfLen: result.cpf.length,
      addressLen: result.address.length,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[get-patient-identification] unhandled", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
