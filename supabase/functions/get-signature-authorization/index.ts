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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Método não permitido" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;

    if (!isValidToken(token)) {
      return json(400, { error: "Token inválido" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: tokenRecord, error: tokenError } = await supabase
      .from("signature_request_tokens")
      .select("id, patient_id, clinic_id, email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("[get-signature-authorization] token lookup error", tokenError);
      return json(500, { error: "Erro ao validar token" });
    }

    if (!tokenRecord) {
      return json(404, { error: "Link inválido ou expirado" });
    }

    if (tokenRecord.used_at) {
      return json(409, { error: "Este link já foi utilizado" });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return json(410, { error: "Este link expirou. Solicite um novo link ao sindicato." });
    }

    const [{ data: patient, error: patientError }, { data: unionEntity, error: unionEntityError }] = await Promise.all([
      supabase
        .from("patients")
        .select("name, cpf, employer_name, signature_accepted")
        .eq("id", tokenRecord.patient_id)
        .maybeSingle(),
      supabase
        .from("union_entities")
        .select("razao_social, logo_url")
        .eq("clinic_id", tokenRecord.clinic_id)
        .maybeSingle(),
    ]);

    if (patientError) {
      console.error("[get-signature-authorization] patient lookup error", patientError);
      return json(500, { error: "Erro ao carregar dados do associado" });
    }

    if (unionEntityError) {
      console.error("[get-signature-authorization] union entity lookup error", unionEntityError);
      return json(500, { error: "Erro ao carregar dados da entidade" });
    }

    if (!patient) {
      return json(404, { error: "Associado não encontrado" });
    }

    if (patient.signature_accepted) {
      return json(409, {
        error: "Esta autorização já foi assinada anteriormente. Não é necessário assinar novamente.",
      });
    }

    return json(200, {
      success: true,
      tokenData: {
        ...tokenRecord,
        patient: {
          name: patient.name,
          cpf: patient.cpf,
          employer_name: patient.employer_name,
        },
        union_entity: unionEntity,
      },
    });
  } catch (err) {
    console.error("[get-signature-authorization] unexpected", err);
    return json(500, { error: "Erro interno do servidor" });
  }
});
