// Sincroniza status e link de boletos/faturas Lytex diretamente na API real.
// Recebe uma lista de contribution ids (employer_contributions) e, para cada
// uma que tenha lytex_invoice_id, consulta a Lytex e atualiza status,
// link do boleto, dados de pagamento e o payload bruto no banco.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  if (s.includes("paid") || s.includes("pago") || s.includes("received") || s.includes("liquidated")) {
    return "paid";
  }
  if (s.includes("cancel") || s.includes("deleted") || s.includes("void")) {
    return "cancelled";
  }
  if (s.includes("expired") || s.includes("overdue") || s.includes("vencid") || s.includes("late")) {
    return "overdue";
  }
  if (s.includes("pending") || s.includes("waiting") || s.includes("open") || s.includes("aberto") || s === "") {
    if (dueDate) {
      const due = new Date(`${dueDate}T23:59:59`);
      if (due.getTime() < Date.now()) return "overdue";
    }
    return "pending";
  }
  return "pending";
}

function extractInvoiceUrl(raw: any): string | null {
  return (
    raw?.boleto?.url ||
    raw?.paymentLink ||
    raw?.invoiceUrl ||
    raw?.url ||
    raw?.checkoutUrl ||
    null
  );
}

function extractPaidValue(raw: any): number | null {
  const v = raw?.lastPayment?.paidValue ?? raw?.paidValue ?? raw?.totalPaid ?? null;
  return typeof v === "number" ? v : null;
}

function extractPaidAt(raw: any): string | null {
  return raw?.lastPayment?.paidAt || raw?.paidAt || raw?.paymentDate || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clinicId, contributionIds } = await req.json();

    if (!clinicId) throw new Error("clinicId obrigatório");
    if (!Array.isArray(contributionIds) || contributionIds.length === 0) {
      throw new Error("contributionIds obrigatório e não vazio");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientId = Deno.env.get("LYTEX_CLIENT_ID");
    const clientSecret = Deno.env.get("LYTEX_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Credenciais Lytex (LYTEX_CLIENT_ID / LYTEX_CLIENT_SECRET) não configuradas");
    }

    const token = await getToken(clientId, clientSecret);
    const H = { Authorization: `Bearer ${token}` };

    const { data: rows, error: fetchErr } = await supabase
      .from("employer_contributions")
      .select("id, status, due_date, lytex_invoice_id, lytex_invoice_url")
      .eq("clinic_id", clinicId)
      .in("id", contributionIds)
      .not("lytex_invoice_id", "is", null);

    if (fetchErr) throw fetchErr;

    let updated = 0;
    let unchanged = 0;
    const errors: string[] = [];

    for (const row of rows || []) {
      try {
        const res = await fetch(`${LYTEX_BASE}/v2/invoices/${row.lytex_invoice_id}`, { headers: H });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) {
          errors.push(`${row.lytex_invoice_id}: ${res.status}`);
          continue;
        }

        const newStatus = mapLytexStatus(raw, row.due_date);
        const newUrl = extractInvoiceUrl(raw) || row.lytex_invoice_url;
        const paidValue = newStatus === "paid" ? extractPaidValue(raw) : null;
        const paidAt = newStatus === "paid" ? extractPaidAt(raw) : null;

        const changed =
          newStatus !== row.status ||
          (newUrl && newUrl !== row.lytex_invoice_url);

        if (changed) {
          const updatePayload: Record<string, unknown> = {
            status: newStatus,
            lytex_invoice_url: newUrl,
            lytex_raw_data: raw,
          };
          if (paidValue !== null) updatePayload.paid_value = paidValue;
          if (paidAt) updatePayload.paid_at = paidAt;

          const { error: updErr } = await supabase
            .from("employer_contributions")
            .update(updatePayload)
            .eq("id", row.id);

          if (updErr) {
            errors.push(`${row.id}: ${updErr.message}`);
          } else {
            updated++;
          }
        } else {
          // Mantém raw_data atualizado mesmo sem mudança de status visível
          await supabase
            .from("employer_contributions")
            .update({ lytex_raw_data: raw })
            .eq("id", row.id);
          unchanged++;
        }
      } catch (e: any) {
        errors.push(`${row.lytex_invoice_id}: ${e?.message || "erro desconhecido"}`);
      }
    }

    await supabase.from("lytex_sync_logs").insert({
      clinic_id: clinicId,
      sync_type: "sync_boletos_generated",
      status: errors.length > 0 && updated === 0 && unchanged === 0 ? "failed" : "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      invoices_updated: updated,
      error_message: errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
      details: { errors },
    });

    return new Response(
      JSON.stringify({ success: true, checked: (rows || []).length, updated, unchanged, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("lytex-refresh-boletos error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
