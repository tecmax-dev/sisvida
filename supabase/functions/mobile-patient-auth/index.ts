import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

const DEFAULT_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function findUserByEmail(supabaseAdmin: ReturnType<typeof createClient>, email: string) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) throw error;

    const users = data.users ?? [];
    const matchedUser = users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;

    if (matchedUser) return matchedUser;
    if (users.length < 1000) break;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Configuração do backend ausente", code: "missing_backend_config" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const cpf = String(body?.cpf ?? "");
    const password = String(body?.password ?? "");
    const requestedClinicId = typeof body?.clinic_id === "string" ? body.clinic_id : null;

    if (!cpf || !password) {
      return json({ success: false, error: "CPF e senha são obrigatórios", code: "missing_credentials" }, 400);
    }

    const normalizedCpf = cpf.replace(/\D/g, "");
    const targetClinicId = requestedClinicId || DEFAULT_CLINIC_ID;

    const { data: patientMatches, error: verifyError } = await supabaseAdmin.rpc("verify_patient_password", {
      p_cpf: normalizedCpf,
      p_password: password,
      p_clinic_id: targetClinicId,
    });

    if (verifyError) {
      console.error("[mobile-patient-auth] verify_patient_password error", verifyError);
      return json({ success: false, error: "Erro ao validar credenciais", code: "verify_failed" }, 500);
    }

    if (!patientMatches || patientMatches.length === 0) {
      return json({ success: false, error: "CPF ou senha incorretos", code: "invalid_credentials" }, 200);
    }

    const patient = patientMatches.find((item: any) => item.clinic_id === targetClinicId) ?? patientMatches[0];

    if (!patient?.is_active) {
      return json({ success: false, error: "Sua conta está inativa. Entre em contato com o sindicato.", code: "inactive_account" }, 200);
    }

    const patientEmail = patient.patient_email && String(patient.patient_email).trim() !== ""
      ? String(patient.patient_email).trim().toLowerCase()
      : `paciente_${normalizedCpf}@app.internal`;

    const appMetadata = {
      provider: "custom",
      patient_id: patient.patient_id,
      clinic_id: patient.clinic_id,
    };

    const userMetadata = {
      name: patient.patient_name,
      patient_id: patient.patient_id,
      clinic_id: patient.clinic_id,
    };

    const existingUser = await findUserByEmail(supabaseAdmin, patientEmail);

    let authUser: User | null = null;

    if (existingUser) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        email: patientEmail,
        password,
        email_confirm: true,
        app_metadata: {
          ...(existingUser.app_metadata ?? {}),
          ...appMetadata,
        },
        user_metadata: {
          ...(existingUser.user_metadata ?? {}),
          ...userMetadata,
        },
      });

      if (updateError) {
        console.error("[mobile-patient-auth] updateUserById error", updateError);
        return json({ success: false, error: "Não foi possível preparar sua conta de acesso", code: "auth_update_failed" }, 500);
      }

      authUser = updatedUser.user;
    } else {
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: patientEmail,
        password,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: userMetadata,
      });

      if (createError) {
        console.error("[mobile-patient-auth] createUser error", createError);
        return json({ success: false, error: "Não foi possível criar sua conta de acesso", code: "auth_create_failed" }, 500);
      }

      authUser = createdUser.user;
    }

    return json({
      success: true,
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      clinic_id: patient.clinic_id,
      patient_email: patientEmail,
      auth_user_id: authUser?.id ?? null,
    });
  } catch (error) {
    console.error("[mobile-patient-auth] unexpected error", error);
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    return json({ success: false, error: message, code: "internal_error" }, 500);
  }
});
