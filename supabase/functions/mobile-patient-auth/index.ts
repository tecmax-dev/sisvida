import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

const DEFAULT_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const MOBILE_AUTH_DOMAIN = "patients.app.internal";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function buildPatientAuthEmail(patientId: string) {
  return `patient.${patientId}@${MOBILE_AUTH_DOMAIN}`;
}

async function buildInternalAuthPassword(patientId: string, clinicId: string, serviceRoleKey: string) {
  const raw = `${patientId}:${clinicId}:${serviceRoleKey}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `Pw!${hash.slice(0, 24)}Aa9#`;
}

async function listAllUsers(supabaseAdmin: ReturnType<typeof createClient>) {
  const users: User[] = [];

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) throw error;

    const pageUsers = data.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < 1000) break;
  }

  return users;
}

async function findExistingPatientAuthUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  patientId: string,
  fallbackEmails: string[]
) {
  const canonicalEmail = buildPatientAuthEmail(patientId).trim().toLowerCase();
  const normalizedFallbackEmails = fallbackEmails
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const users = await listAllUsers(supabaseAdmin);

  const canonicalUser = users.find((user) => {
    const email = user.email?.trim().toLowerCase();
    return email === canonicalEmail;
  });

  if (canonicalUser) return canonicalUser;

  const byPatientId = users.find((user) => {
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;

    return appMeta.patient_id === patientId || userMeta.patient_id === patientId;
  });

  if (byPatientId) return byPatientId;

  return users.find((user) => {
    const email = user.email?.trim().toLowerCase();
    return !!email && normalizedFallbackEmails.includes(email);
  }) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return json({ success: false, error: "Configuração do backend ausente", code: "missing_backend_config" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
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

    const patientId = String(patient.patient_id);
    const clinicId = String(patient.clinic_id ?? targetClinicId);
    const canonicalAuthEmail = buildPatientAuthEmail(patientId);
    const internalAuthPassword = await buildInternalAuthPassword(patientId, clinicId, serviceRoleKey);
    const legacyEmails = [
      canonicalAuthEmail,
      `paciente_${normalizedCpf}@app.internal`,
      patient.patient_email ? String(patient.patient_email).trim().toLowerCase() : "",
    ];

    const appMetadata = {
      provider: "custom",
      patient_id: patient.patient_id,
      clinic_id: clinicId,
    };

    const userMetadata = {
      name: patient.patient_name,
      patient_id: patient.patient_id,
      clinic_id: clinicId,
    };

    const existingUser = await findExistingPatientAuthUser(
      supabaseAdmin,
      patientId,
      legacyEmails
    );

    let authUser: User | null = null;

    if (existingUser) {
      const currentEmail = (existingUser.email ?? "").trim().toLowerCase();
      const targetEmail = canonicalAuthEmail.trim().toLowerCase();
      const emailNeedsChange = currentEmail !== targetEmail;

      const updatePayload: Record<string, unknown> = {
        password: internalAuthPassword,
        app_metadata: {
          ...(existingUser.app_metadata ?? {}),
          ...appMetadata,
        },
        user_metadata: {
          ...(existingUser.user_metadata ?? {}),
          ...userMetadata,
        },
      };

      if (emailNeedsChange) {
        updatePayload.email = canonicalAuthEmail;
        updatePayload.email_confirm = true;
      } else if (!existingUser.email_confirmed_at) {
        updatePayload.email_confirm = true;
      }

      let { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        updatePayload as any
      );

      if (updateError && emailNeedsChange) {
        console.warn("[mobile-patient-auth] updateUserById falhou ao alterar email, tentando sem alterar email", updateError);
        const retryPayload = { ...updatePayload };
        delete (retryPayload as any).email;
        delete (retryPayload as any).email_confirm;
        const retry = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, retryPayload as any);
        updatedUser = retry.data;
        updateError = retry.error;
      }

      if (updateError || !updatedUser?.user) {
        console.error("[mobile-patient-auth] updateUserById error", updateError, "user_id:", existingUser.id, "patient_id:", patient.patient_id);
        return json({
          success: false,
          error: "Não foi possível preparar sua conta de acesso",
          code: "auth_update_failed",
          details: updateError?.message ?? null,
        }, 500);
      }

      authUser = updatedUser.user;
    } else {
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: canonicalAuthEmail,
        password: internalAuthPassword,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: userMetadata,
      });

      if (createError || !createdUser?.user) {
        console.error("[mobile-patient-auth] createUser error", createError, "patient_id:", patient.patient_id);
        return json({
          success: false,
          error: "Não foi possível criar sua conta de acesso",
          code: "auth_create_failed",
          details: createError?.message ?? null,
        }, 500);
      }

      authUser = createdUser.user;
    }

    const signInEmail = (authUser?.email ?? canonicalAuthEmail).trim().toLowerCase();
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: signInEmail,
      password: internalAuthPassword,
    });

    if (signInError || !signInData.session) {
      console.error("[mobile-patient-auth] signInWithPassword error", signInError, "auth_user_id:", authUser?.id);
      return json({
        success: false,
        error: "Não foi possível iniciar sua sessão",
        code: "auth_signin_failed",
        details: signInError?.message ?? null,
      }, 500);
    }

    return json({
      success: true,
      patient_id: patient.patient_id,
      patient_name: patient.patient_name,
      clinic_id: clinicId,
      patient_email: signInEmail,
      auth_user_id: authUser?.id ?? null,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_at: signInData.session.expires_at ?? null,
      expires_in: signInData.session.expires_in ?? null,
      token_type: signInData.session.token_type,
    });
  } catch (error) {
    console.error("[mobile-patient-auth] unexpected error", error);
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    return json({ success: false, error: message, code: "internal_error" }, 500);
  }
});
