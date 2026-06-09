// Shared helper: enforces Meta WhatsApp 24h "customer service window".
// Outside this window only approved templates can be sent; any free-form
// type:text returns 131047 and degrades quality rating.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logPolicyEvent, normalizePhone } from "./opt-out.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_client) _client = createClient(SB_URL, SB_SERVICE);
  return _client;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Returns true when we are still inside the 24h conversation window
 * (i.e. the contact sent a message in the last 24h). When no inbound
 * is registered we conservatively return false.
 */
export async function isInsideSessionWindow(clinicId: string, phone: string): Promise<boolean> {
  const p = normalizePhone(phone);
  if (!p || !clinicId) return false;

  // 1) Try the ticket model first.
  const { data: ticket } = await sb()
    .from("whatsapp_tickets")
    .select("last_message_at, last_inbound_at, contact:whatsapp_contacts!inner(phone, clinic_id)")
    .eq("contact.clinic_id", clinicId)
    .eq("contact.phone", p)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inboundIso = (ticket as any)?.last_inbound_at || null;
  if (inboundIso) {
    const age = Date.now() - new Date(inboundIso).getTime();
    if (age >= 0 && age < WINDOW_MS) return true;
  }

  // 2) Fallback: most recent inbound in whatsapp_incoming_logs.
  const { data: incoming } = await sb()
    .from("whatsapp_incoming_logs")
    .select("created_at")
    .eq("clinic_id", clinicId)
    .eq("phone", p)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const createdAt = (incoming as any)?.created_at;
  if (createdAt) {
    const age = Date.now() - new Date(createdAt).getTime();
    if (age >= 0 && age < WINDOW_MS) return true;
  }
  return false;
}

/** Returns true if outbound free-form must be BLOCKED (window closed). */
export async function blockedByWindow(params: {
  clinicId: string;
  phone: string;
  sourceFunction?: string;
}): Promise<boolean> {
  const inside = await isInsideSessionWindow(params.clinicId, params.phone);
  if (!inside) {
    await logPolicyEvent({
      clinicId: params.clinicId,
      phone: params.phone,
      event: "blocked_by_session_window",
      sourceFunction: params.sourceFunction,
    });
  }
  return !inside;
}
