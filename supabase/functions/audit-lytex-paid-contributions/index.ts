import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const LYTEX_API_URL = Deno.env.get("LYTEX_API_URL") || "https://api-pay.lytex.com.br/v2";

const PAID_STATUSES = new Set([
  "paid",
  "payed",
  "approved",
  "confirmed",
  "settled",
  "completed",
]);

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

async function getLytexToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now + 60_000) return cachedToken;

  const clientId = Deno.env.get("LYTEX_CLIENT_ID");
  const clientSecret = Deno.env.get("LYTEX_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Credenciais Lytex não configuradas");

  const res = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Erro auth Lytex: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.accessToken;
  cachedTokenExpiresAt = now + (data.expiresIn ?? 3600) * 1000;
  return cachedToken!;
}

async function getInvoice(invoiceId: string, token: string): Promise<{ status: string | null; raw: any } | null> {
  const res = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lytex ${res.status}: ${await res.text()}`);
  const raw = await res.json();
  const status = String(raw?.status || raw?.invoice?.status || "").toLowerCase();
  return { status, raw };
}

function isPaid(status: string | null | undefined): boolean {
  if (!status) return false;
  return PAID_STATUSES.has(String(status).toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const clinicId: string | undefined = body.clinicId;
    const dryRun: boolean = body.dryRun === true;
    const offset: number = Math.max(0, Number(body.offset) || 0);
    const limit: number = Math.min(200, Math.max(1, Number(body.limit) || 100));

    // Contagem total
    let countQ = supabase
      .from("employer_contributions")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid")
      .not("lytex_invoice_id", "is", null);
    if (clinicId) countQ = countQ.eq("clinic_id", clinicId);
    const { count: totalCount } = await countQ;

    // Lote
    let q = supabase
      .from("employer_contributions")
      .select("id, clinic_id, lytex_invoice_id, value, paid_value, due_date, paid_at, payment_method, notes, employer:employers!employer_contributions_employer_id_fkey(name, cnpj)")
      .eq("status", "paid")
      .not("lytex_invoice_id", "is", null)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (clinicId) q = q.eq("clinic_id", clinicId);

    const { data: contribs, error: cErr } = await q;
    if (cErr) throw cErr;

    const token = await getLytexToken();
    const today = new Date().toISOString().slice(0, 10);
    const auditDate = today;

    const mismatches: any[] = [];
    const errors: any[] = [];
    let checked = 0;
    let reverted = 0;

    for (const c of contribs ?? []) {
      checked++;
      try {
        const result = await getInvoice(c.lytex_invoice_id!, token);
        if (!result) {
          // Não existe na Lytex
          mismatches.push({
            id: c.id,
            lytex_invoice_id: c.lytex_invoice_id,
            employer: (c.employer as any)?.name,
            cnpj: (c.employer as any)?.cnpj,
            due_date: c.due_date,
            paid_at: c.paid_at,
            value: c.value,
            lytex_status: "NOT_FOUND",
          });
          if (!dryRun) {
            const newStatus = c.due_date && c.due_date < today ? "overdue" : "pending";
            const note = `[AUDITORIA LYTEX ${auditDate}] Revertido para ${newStatus} - fatura não encontrada na Lytex (id ${c.lytex_invoice_id}). ${c.notes ?? ""}`.trim();
            const { error: upErr } = await supabase
              .from("employer_contributions")
              .update({
                status: newStatus,
                paid_at: null,
                paid_value: null,
                payment_method: null,
                notes: note,
              })
              .eq("id", c.id);
            if (upErr) throw upErr;
            reverted++;
          }
          continue;
        }

        if (!isPaid(result.status)) {
          mismatches.push({
            id: c.id,
            lytex_invoice_id: c.lytex_invoice_id,
            employer: (c.employer as any)?.name,
            cnpj: (c.employer as any)?.cnpj,
            due_date: c.due_date,
            paid_at: c.paid_at,
            value: c.value,
            lytex_status: result.status,
          });
          if (!dryRun) {
            const newStatus = c.due_date && c.due_date < today ? "overdue" : "pending";
            const note = `[AUDITORIA LYTEX ${auditDate}] Revertido para ${newStatus} - Lytex reportou status='${result.status}'. ${c.notes ?? ""}`.trim();
            const { error: upErr } = await supabase
              .from("employer_contributions")
              .update({
                status: newStatus,
                paid_at: null,
                paid_value: null,
                payment_method: null,
                notes: note,
              })
              .eq("id", c.id);
            if (upErr) throw upErr;
            reverted++;
          }
        }
      } catch (err: any) {
        console.error(`[Audit] Erro contrib ${c.id}:`, err?.message || err);
        errors.push({ id: c.id, lytex_invoice_id: c.lytex_invoice_id, error: String(err?.message || err) });
      }
    }

    const nextOffset = (contribs?.length ?? 0) >= limit ? offset + limit : null;

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        offset,
        limit,
        batchSize: contribs?.length ?? 0,
        totalCount: totalCount ?? null,
        checked,
        reverted,
        mismatches,
        errors,
        nextOffset,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[Audit Lytex Paid] Erro:", err?.message || err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});