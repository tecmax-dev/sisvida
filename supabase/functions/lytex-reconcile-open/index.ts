// Concilia contribuições em aberto (pending/overdue) contra a API real da Lytex.
// Percorre em lotes todas as employer_contributions com lytex_invoice_id e
// atualiza status/pagamento conforme a fatura real na Lytex.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext, isInternalCaller, adminClient } from "../_shared/authGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LYTEX_BASE = "https://api-pay.lytex.com.br";

async function getToken(clientId: string, clientSecret: string) {
  const res = await fetch(`${LYTEX_BASE}/v2/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "clientCredentials", clientId, clientSecret }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Falha na autenticação Lytex: ${res.status} ${JSON.stringify(json)}`);
  return json.accessToken as string;
}

function mapLytexStatus(raw: any, dueDate: string | null): string {
  const s = String(raw?.status || raw?.invoiceStatus || "").toLowerCase();
  if (s.includes("paid") || s.includes("pago") || s.includes("received") || s.includes("liquidated")) return "paid";
  if (s.includes("cancel") || s.includes("deleted") || s.includes("void")) return "cancelled";
  if (s.includes("expired") || s.includes("overdue") || s.includes("vencid") || s.includes("late")) return "overdue";
  if (dueDate) {
    const due = new Date(`${dueDate}T23:59:59`);
    if (due.getTime() < Date.now()) return "overdue";
  }
  return "pending";
}

function extractPaidValue(raw: any): number | null {
  const v = raw?.lastPayment?.paidValue ?? raw?.paidValue ?? raw?.totalPaid ?? null;
  return typeof v === "number" ? v : null;
}

function extractPaidAt(raw: any): string | null {
  return raw?.lastPayment?.paidAt || raw?.paidAt || raw?.paymentDate || null;
}

const MESES = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function parseCompetence(name: string): { month: number; year: number } | null {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const m = n.match(/referente\s+([a-z]+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const idx = MESES.indexOf(m[1]);
  if (idx < 0) return null;
  return { month: idx + 1, year: Number(m[2]) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const clinicId = body.clinicId as string;
    const offset = Number(body.offset ?? 0);
    const limit = Math.min(Number(body.limit ?? 100), 200);
    const statuses: string[] = body.statuses ?? ["pending", "overdue"];
    if (!clinicId) throw new Error("clinicId obrigatório");

    // Dados financeiros: somente administrador do sistema (super admin ou admin/owner sem grupo de acesso)
    if (!isInternalCaller(req)) {
      const ctx = await getAuthContext(req);
      if (!ctx) {
        return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let allowed = ctx.isSuperAdmin;
      if (!allowed) {
        const { data: roles } = await adminClient()
          .from("user_roles")
          .select("role, access_group_id")
          .eq("user_id", ctx.userId)
          .eq("clinic_id", clinicId);
        allowed = (roles || []).some((r: any) => (r.role === "owner" || r.role === "admin") && !r.access_group_id);
      }
      if (!allowed) {
        return new Response(JSON.stringify({ success: false, error: "Acesso restrito ao administrador do sistema" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const clientId = Deno.env.get("LYTEX_CLIENT_ID");
    const clientSecret = Deno.env.get("LYTEX_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new Error("Credenciais Lytex não configuradas");

    const token = await getToken(clientId, clientSecret);
    const H = { Authorization: `Bearer ${token}` };

    // MODO 3: busca valor pago e taxa Lytex das contribuições já pagas (bruto, taxa, líquido)
    if (body.mode === "fees") {
      const fromYear = Number(body.fromYear ?? 2026);
      const fromMonth = Number(body.fromMonth ?? 9);
      const typeIds: string[] = Array.isArray(body.typeIds) ? body.typeIds.slice(0, 10) : [];
      let q = supabase
        .from("employer_contributions")
        .select("id, lytex_invoice_id, competence_year, competence_month")
        .eq("clinic_id", clinicId)
        .eq("status", "paid")
        .not("lytex_invoice_id", "is", null)
        .gte("competence_year", fromYear)
        .order("id")
        .range(offset, offset + limit - 1);
      if (typeIds.length) q = q.in("contribution_type_id", typeIds);
      const { data: rows, error: qErr } = await q;
      if (qErr) throw qErr;
      let updated = 0, failed = 0;
      for (const r of (rows || []).filter((x: any) => x.competence_year * 100 + x.competence_month >= fromYear * 100 + fromMonth)) {
        const res = await fetch(`${LYTEX_BASE}/v2/invoices/${r.lytex_invoice_id}`, { headers: H });
        const inv: any = await res.json().catch(() => null);
        if (!res.ok || !inv) { failed++; continue; }
        const pd = inv.paymentData || {};
        const tx = (inv.transactions || []).find((t: any) => t?.status === "paid") || {};
        const paid = Number(pd.payedValue ?? tx.payedValue ?? inv.lastPayment?.payedValue);
        const fee = Number(pd.metadata?.rates ?? tx.rates ?? 0);
        if (!Number.isFinite(paid) || paid <= 0) { failed++; continue; }
        const { error: uErr } = await supabase.from("employer_contributions").update({
          paid_value: paid,
          lytex_fee_amount: Number.isFinite(fee) ? fee : 0,
          net_value: paid - (Number.isFinite(fee) ? fee : 0),
          lytex_fee_details: { rates: fee, discount: pd.metadata?.discount ?? 0, mulct: pd.metadata?.mulct ?? 0, interest: pd.metadata?.interest ?? 0, creditAt: pd.metadata?.creditAt ?? tx.creditAt ?? null, method: pd.method ?? tx.paymentMethod ?? null },
        }).eq("id", r.id);
        if (uErr) failed++; else updated++;
      }
      const n = (rows || []).length;
      return new Response(JSON.stringify({ success: true, mode: "fees", processed: n, updated, failed, done: n < limit, nextOffset: offset + n }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // MODO 2: varre faturas PAGAS na Lytex e concilia com contribuições abertas no sistema
    if (body.mode === "paid_scan") {
      const page = Number(body.page ?? 1);
      const perPage = Math.min(Number(body.perPage ?? 100), 100);
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
        status: "paid",
      });
      const listRes = await fetch(`${LYTEX_BASE}/v2/invoices?${qs}`, { headers: H });
      const listJson: any = await listRes.json().catch(() => ({}));
      if (!listRes.ok) throw new Error(`Lytex list ${listRes.status}: ${JSON.stringify(listJson).slice(0, 300)}`);

      const items: any[] = listJson?.results || listJson?.data || listJson?.items || [];
      const totalItems = listJson?.paginate ?? null;

      let matchedPaid = 0;
      let alreadyPaid = 0;
      let notFound = 0;
      const unmatchedSamples: unknown[] = [];

      for (const inv of items) {
        const invId = inv?._id || inv?.id;
        if (!invId) continue;
        if (body.onlyCnpj && String(inv?.client?.cpfCnpj || "").replace(/\D/g, "") !== body.onlyCnpj) continue;
        // Pode haver linhas duplicadas com o mesmo boleto: prefere a que ainda está em aberto.
        const { data: byIdRows } = await supabase
          .from("employer_contributions")
          .select("id, status")
          .eq("clinic_id", clinicId)
          .eq("lytex_invoice_id", invId);
        const rowsById = byIdRows || [];
        let target: any = rowsById.find((r: any) => r.status === "pending" || r.status === "overdue")
          ?? rowsById.find((r: any) => r.status === "paid") ?? null;
        if (!target && rowsById.length) { alreadyPaid++; continue; }

        if (!target) {
          // fallback: casa por CNPJ do pagador + valor + vencimento aproximado
          const cnpj = String(inv?.client?.cpfCnpj || "").replace(/\D/g, "");
          const valueCents = (inv?.items || []).reduce((s: number, i: any) => s + (Number(i?.value) || 0) * (Number(i?.quantity) || 1), 0);
          const due = inv?.dueDate ? new Date(inv.dueDate) : null;
          if (cnpj && due) {
            const dueLocal = new Date(due.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
            const { data: emps } = await supabase
              .from("employers")
              .select("id")
              .eq("clinic_id", clinicId)
              .or(`cnpj.eq.${cnpj},cnpj.eq.${cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`);
            const empIds = (emps || []).map((e: any) => e.id);
            if (empIds.length) {
              const { data: cands } = await supabase
                .from("employer_contributions")
                .select("id, status, value, due_date, competence_month, competence_year")
                .eq("clinic_id", clinicId)
                .in("employer_id", empIds)
                .in("status", ["pending", "overdue"])
                .eq("value", valueCents)
                .gte("due_date", new Date(new Date(dueLocal).getTime() - 10 * 864e5).toISOString().slice(0, 10))
                .lte("due_date", new Date(new Date(dueLocal).getTime() + 10 * 864e5).toISOString().slice(0, 10));

              let list = cands || [];
              const comp = parseCompetence(String(inv?.items?.[0]?.name || ""));
              if (list.length > 1 && comp) {
                const narrowed = list.filter(
                  (c: any) => c.competence_month === comp.month && c.competence_year === comp.year,
                );
                if (narrowed.length) list = narrowed;
              }
              target = list.length === 1 ? list[0] : null;
            }
          }
        }

        if (!target) {
          notFound++;
          if (unmatchedSamples.length < (body.onlyCnpj ? 200 : 5)) unmatchedSamples.push({ invId, cnpj: inv?.client?.cpfCnpj, dueDate: inv?.dueDate, items: inv?.items });
          continue;
        }
        if (target.status === "paid") {
          alreadyPaid++;
          continue;
        }

        const payload: Record<string, unknown> = {
          status: "paid",
          lytex_invoice_id: invId,
          lytex_raw_data: inv,
          paid_at: extractPaidAt(inv) || new Date().toISOString(),
        };
        const pv = extractPaidValue(inv);
        if (pv !== null) payload.paid_value = pv;

        const { error: upErr } = await supabase
          .from("employer_contributions")
          .update(payload)
          .eq("id", target.id);
        if (upErr) {
          notFound++;
          continue;
        }
        matchedPaid++;
      }

      await supabase.from("lytex_sync_logs").insert({
        clinic_id: clinicId,
        sync_type: "reconcile_paid_scan",
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        invoices_updated: matchedPaid,
        details: { page, processed: items.length, matchedPaid, alreadyPaid, notFound },
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "paid_scan",
          page,
          processed: items.length,
          totalItems,
          matchedPaid,
          alreadyPaid,
          notFound,
          unmatchedSamples: body.debug ? unmatchedSamples : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const { data: rows, error, count } = await supabase
      .from("employer_contributions")
      .select("id, status, due_date, lytex_invoice_id, lytex_invoice_url", { count: "exact" })
      .eq("clinic_id", clinicId)
      .in("status", statuses)
      .not("lytex_invoice_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    let paid = 0;
    let cancelled = 0;
    let otherUpdates = 0;
    let unchanged = 0;
    const errors: string[] = [];

    const samples: unknown[] = [];
    for (const row of rows || []) {
      try {
        const res = await fetch(`${LYTEX_BASE}/v2/invoices/${row.lytex_invoice_id}`, { headers: H });
        const raw = await res.json().catch(() => ({}));
        if (body.debug && samples.length < 3) {
          samples.push({ id: row.id, dbStatus: row.status, httpStatus: res.status, raw });
        }
        if (!res.ok) {
          errors.push(`${row.lytex_invoice_id}: HTTP ${res.status}`);
          continue;
        }

        const newStatus = mapLytexStatus(raw, row.due_date);
        if (newStatus === row.status) {
          unchanged++;
          continue;
        }

        const payload: Record<string, unknown> = { status: newStatus, lytex_raw_data: raw };
        if (newStatus === "paid") {
          const pv = extractPaidValue(raw);
          const pa = extractPaidAt(raw);
          if (pv !== null) payload.paid_value = pv;
          payload.paid_at = pa || new Date().toISOString();
        }

        const { error: updErr } = await supabase
          .from("employer_contributions")
          .update(payload)
          .eq("id", row.id);

        if (updErr) {
          errors.push(`${row.id}: ${updErr.message}`);
          continue;
        }
        if (newStatus === "paid") paid++;
        else if (newStatus === "cancelled") cancelled++;
        else otherUpdates++;
      } catch (e: any) {
        errors.push(`${row.lytex_invoice_id}: ${e?.message || "erro"}`);
      }
    }

    const processed = (rows || []).length;
    const nextOffset = offset + processed;
    const done = nextOffset >= (count ?? nextOffset);

    await supabase.from("lytex_sync_logs").insert({
      clinic_id: clinicId,
      sync_type: "reconcile_open_contributions",
      status: errors.length > 0 && paid + cancelled + otherUpdates === 0 ? "failed" : "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      invoices_updated: paid + cancelled + otherUpdates,
      error_message: errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
      details: { offset, processed, paid, cancelled, otherUpdates, unchanged, errors: errors.slice(0, 50) },
    });

    return new Response(
      JSON.stringify({ success: true, total: count, offset, processed, nextOffset, done, paid, cancelled, otherUpdates, unchanged, errors: errors.slice(0, 20), samples: body.debug ? samples : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("lytex-reconcile-open error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
