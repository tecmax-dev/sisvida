// Shared authentication/authorization guard for edge functions.
// Validates the incoming Authorization header in code (verify_jwt = false by default).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export function getBearer(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

/** True when the caller presents the service-role key (trusted internal automation). */
export function isInternalCaller(req: Request): boolean {
  const token = getBearer(req);
  return !!token && !!SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  patientId: string | null;
  isStaff: boolean;
  isSuperAdmin: boolean;
}

/** Resolves the authenticated user from the JWT. Returns null when absent/invalid/anon key. */
export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const token = getBearer(req);
  if (!token) return null;
  if (ANON_KEY && token === ANON_KEY) return null;
  if (SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY) return null;

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const user = data.user;
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const patientId =
    (appMeta.patient_id as string | undefined) ??
    (userMeta.patient_id as string | undefined) ??
    null;

  const [{ data: superAdmin }, { data: roles }] = await Promise.all([
    admin.from("super_admins").select("id").eq("user_id", user.id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const isSuperAdmin = !!superAdmin;
  const isStaff = isSuperAdmin || ((roles ?? []).length > 0);

  return {
    userId: user.id,
    email: user.email ?? null,
    patientId,
    isStaff,
    isSuperAdmin,
  };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Requires a trusted internal caller or an authenticated staff/admin user. */
export async function requireStaff(req: Request): Promise<AuthContext | null> {
  if (isInternalCaller(req)) return null;
  const ctx = await getAuthContext(req);
  if (!ctx) throw new AuthError("UNAUTHORIZED", 401);
  if (!ctx.isStaff) throw new AuthError("FORBIDDEN", 403);
  return ctx;
}

/** Requires any authenticated user (staff or patient app session). */
export async function requireUser(req: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (!ctx) throw new AuthError("UNAUTHORIZED", 401);
  return ctx;
}

export function authErrorResponse(e: unknown, headers: Record<string, string>): Response | null {
  if (e instanceof AuthError) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: e.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  return null;
}
