import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LytexWebhookPayload {
  webhookType?: string;
  signature?: string;
  data?: {
    invoiceId?: string;
    status?: string;
    referenceId?: string;
    payedValue?: number;
    paymentMethod?: string;
    paidAt?: string;
    canceledAt?: string;
    client?: {
      name: string;
      cpfCnpj: string;
      email?: string;
    };
  };
  dueDate?: string;
}

function normalizeLytexStatus(input: unknown): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_");
}

function mapToContributionStatus(payload: LytexWebhookPayload): "paid" | "processing" | "cancelled" | "pending" {
  const webhookType = normalizeLytexStatus(payload.webhookType);
  const status = normalizeLytexStatus(payload.data?.status);

  // Prioriza webhookType, mas faz fallback pelo status.
  const paidSignals = new Set([
    "invoicepayment",
    "invoice_payment",
    "payment",
    "payment_confirmed",
    "invoicepaymentconfirmed",
    "invoice_payment_confirmed",
    "invoicepaid",
    "invoice_paid",
  ]);

  if (paidSignals.has(webhookType)) return "paid";

  const cancelledSignals = new Set([
    "cancelinvoice",
    "cancel_invoice",
    "invoicecancelled",
    "invoice_cancelled",
    "invoicecanceled",
    "invoice_canceled",
  ]);
  if (cancelledSignals.has(webhookType)) return "cancelled";

  const processingSignals = new Set([
    "scheduleinvoicepayment",
    "schedule_invoice_payment",
    "processing",
    "in_process",
  ]);
  if (processingSignals.has(webhookType)) return "processing";

  // Fallback pelo status
  const paidStatuses = new Set(["paid", "payed", "approved", "confirmed", "settled", "completed"]);
  if (paidStatuses.has(status)) return "paid";

  const cancelledStatuses = new Set(["canceled", "cancelled", "voided", "reversed"]);
  if (cancelledStatuses.has(status)) return "cancelled";

  const processingStatuses = new Set(["processing", "in_process", "scheduled", "pending_payment"]);
  if (processingStatuses.has(status)) return "processing";

  return "pending";
}

function verifySignature(data: object, signature: string, secret: string): boolean {
  const expectedSignature = createHmac("sha256", secret)
    .update(JSON.stringify(data))
    .digest("base64");
  return expectedSignature === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const webhookSecret = Deno.env.get("LYTEX_WEBHOOK_SECRET");

  try {
    const payload: LytexWebhookPayload = await req.json();

    const invoiceId = payload.data?.invoiceId;
    const referenceId = payload.data?.referenceId;
    console.log("[Lytex Webhook] Recebido:", payload.webhookType, invoiceId, referenceId);

    // Validar assinatura se secret estiver configurado
    if (webhookSecret && payload.signature && payload.data) {
      const isValid = verifySignature(payload.data, payload.signature, webhookSecret);
      if (!isValid) {
        console.error("[Lytex Webhook] Assinatura inválida");
        return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Buscar contribuição pelo ID interno (referenceId) OU pelo invoiceId
    let contribution: { id: string; clinic_id: string; status: string | null; paid_at: string | null } | null = null;

    if (referenceId) {
      const { data } = await supabase
        .from("employer_contributions")
        .select("id, clinic_id, status, paid_at")
        .eq("id", referenceId)
        .maybeSingle();
      contribution = data;
    }

    if (!contribution && invoiceId) {
      const { data } = await supabase
        .from("employer_contributions")
        .select("id, clinic_id, status, paid_at")
        .eq("lytex_invoice_id", invoiceId)
        .maybeSingle();
      contribution = data;
    }

    // Registrar log do webhook (sempre)
    await supabase.from("lytex_webhook_logs").insert({
      clinic_id: contribution?.clinic_id || null,
      contribution_id: contribution?.id || null,
      webhook_type: payload.webhookType || "unknown",
      payload: payload,
      processed: !!contribution,
    });

    if (!contribution) {
      console.log("[Lytex Webhook] Contribuição não encontrada para:", invoiceId, referenceId);
      return new Response(JSON.stringify({ success: true, message: "Contribuição não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = mapToContributionStatus(payload);

    // Só gravar paid_at quando for pago, e nunca sobrescrever por null
    const paidAt = payload.data?.paidAt || null;
    const payedValue = payload.data?.payedValue;
    const paymentMethod = payload.data?.paymentMethod || null;

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    if (newStatus === "paid") {
      updateData.paid_at = paidAt || contribution.paid_at || new Date().toISOString();
      // IMPORTANTE: Lytex envia payedValue em CENTAVOS, NÃO multiplicar por 100!
      if (typeof payedValue === "number") updateData.paid_value = Math.round(payedValue);
      if (paymentMethod) updateData.payment_method = paymentMethod;
    }

    const { error } = await supabase
      .from("employer_contributions")
      .update(updateData)
      .eq("id", contribution.id);

    if (error) {
      console.error("[Lytex Webhook] Erro ao atualizar contribuição:", error);
    } else {
      console.log("[Lytex Webhook] Atualizado:", contribution.id, "=>", newStatus);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Lytex Webhook] Erro:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

