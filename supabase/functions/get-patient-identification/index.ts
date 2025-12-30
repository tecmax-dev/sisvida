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

  try {
    const body = await req.json().catch(() => ({}));
    const clinicId = String(body?.clinicId || "").trim();
    const patientId = String(body?.patientId || "").trim();

    if (!clinicId || !patientId) {
      return new Response(
        JSON.stringify({ error: "clinicId e patientId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client "do usuário" (para validar sessão e permissão)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verifica se o usuário tem acesso à clínica
    const { data: accessOk, error: accessErr } = await userClient.rpc("has_clinic_access", {
      _user_id: userData.user.id,
      _clinic_id: clinicId,
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
      return new Response(
        JSON.stringify({ error: "Erro ao buscar paciente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Paciente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        cpf: normalizeCpf(data.cpf || ""),
        address: buildAddress(data),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
