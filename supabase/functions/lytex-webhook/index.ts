import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // A Lytex pode enviar webhookType "invoice_payment" durante sincronizações internas
  // mesmo quando o status real da fatura ainda é "pending". O status explícito
  // da fatura deve prevalecer para evitar marcar boletos não pagos como pagos.
  const paidStatuses = new Set(["paid", "payed", "approved", "confirmed", "settled", "completed"]);
  const cancelledStatuses = new Set(["canceled", "cancelled", "voided", "reversed"]);
  const processingStatuses = new Set(["processing", "in_process", "scheduled", "pending_payment"]);
  const pendingStatuses = new Set(["pending", "open", "created", "waiting_payment", "awaiting_payment"]);

  if (paidStatuses.has(status)) return "paid";
  if (cancelledStatuses.has(status)) return "cancelled";
  if (processingStatuses.has(status)) return "processing";
  if (pendingStatuses.has(status)) return "pending";

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

  return "pending";
}

async function verifySignature(data: object, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(data)));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
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

    // Validar assinatura: quando o secret está configurado, a assinatura é OBRIGATÓRIA
    if (webhookSecret) {
      if (!payload.signature || !payload.data) {
        console.error("[Lytex Webhook] Requisição sem assinatura - rejeitada");
        return new Response(JSON.stringify({ error: "Signature required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isValid = await verifySignature(payload.data, payload.signature, webhookSecret);
      if (!isValid) {
        console.error("[Lytex Webhook] Assinatura inválida");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
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

    // ====== NOVO: Buscar em negotiation_installments se não encontrou em employer_contributions ======
    let negotiationInstallment: { id: string; negotiation_id: string; status: string | null; paid_at: string | null; clinic_id: string } | null = null;

    if (!contribution && invoiceId) {
      const { data } = await supabase
        .from("negotiation_installments")
        .select("id, negotiation_id, status, paid_at, debt_negotiations!inner(clinic_id)")
        .eq("lytex_invoice_id", invoiceId)
        .maybeSingle();
      if (data) {
        negotiationInstallment = {
          id: data.id,
          negotiation_id: data.negotiation_id,
          status: data.status,
          paid_at: data.paid_at,
          clinic_id: (data.debt_negotiations as any)?.clinic_id,
        };
      }
    }

    if (!contribution && referenceId) {
      const { data } = await supabase
        .from("negotiation_installments")
        .select("id, negotiation_id, status, paid_at, debt_negotiations!inner(clinic_id)")
        .eq("id", referenceId)
        .maybeSingle();
      if (data) {
        negotiationInstallment = {
          id: data.id,
          negotiation_id: data.negotiation_id,
          status: data.status,
          paid_at: data.paid_at,
          clinic_id: (data.debt_negotiations as any)?.clinic_id,
        };
      }
    }

    // Registrar log do webhook (sempre)
    await supabase.from("lytex_webhook_logs").insert({
      clinic_id: contribution?.clinic_id || negotiationInstallment?.clinic_id || null,
      contribution_id: contribution?.id || negotiationInstallment?.id || null,
      webhook_type: payload.webhookType || "unknown",
      payload: payload,
      processed: !!(contribution || negotiationInstallment),
    });

    if (!contribution && !negotiationInstallment) {
      console.log("[Lytex Webhook] Contribuição/Parcela não encontrada para:", invoiceId, referenceId);
      return new Response(JSON.stringify({ success: true, message: "Contribuição não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = mapToContributionStatus(payload);
    const paidAt = payload.data?.paidAt || null;
    const payedValue = payload.data?.payedValue;
    const paymentMethod = payload.data?.paymentMethod || null;

    // ====== Fluxo para CONTRIBUIÇÕES normais ======
    if (contribution) {
      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      if (newStatus === "paid") {
        updateData.paid_at = paidAt || contribution.paid_at || new Date().toISOString();
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
        console.log("[Lytex Webhook] Contribuição atualizada:", contribution.id, "=>", newStatus);
      }
    }

    // ====== Fluxo para PARCELAS DE NEGOCIAÇÃO ======
    if (negotiationInstallment) {
      const instUpdateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "paid") {
        // negotiation_installments.paid_value é em REAIS, Lytex envia em centavos
        instUpdateData.paid_at = paidAt || negotiationInstallment.paid_at || new Date().toISOString();
        if (typeof payedValue === "number") instUpdateData.paid_value = payedValue / 100;
        if (paymentMethod) instUpdateData.payment_method = paymentMethod;
      }

      const { error: instError } = await supabase
        .from("negotiation_installments")
        .update(instUpdateData)
        .eq("id", negotiationInstallment.id);

      if (instError) {
        console.error("[Lytex Webhook] Erro ao atualizar parcela de negociação:", instError);
      } else {
        console.log("[Lytex Webhook] Parcela de negociação atualizada:", negotiationInstallment.id, "=>", newStatus);

        // Se pagou, atualizar contribuições vinculadas e verificar conclusão da negociação
        if (newStatus === "paid") {
          try {
            // Atualizar contribuições vinculadas para "negotiated"
            const { data: linkedItems } = await supabase
              .from("negotiation_items")
              .select("contribution_id")
              .eq("negotiation_id", negotiationInstallment.negotiation_id)
              .not("contribution_id", "is", null);

            if (linkedItems && linkedItems.length > 0) {
              const contribIds = linkedItems.map((item: any) => item.contribution_id).filter(Boolean);
              if (contribIds.length > 0) {
                await supabase
                  .from("employer_contributions")
                  .update({ status: "negotiated", is_negotiated_debt: true, updated_at: new Date().toISOString() })
                  .in("id", contribIds)
                  .not("status", "eq", "negotiated");
              }
            }

            // Verificar se todas as parcelas estão pagas → completar negociação
            const { data: allInst } = await supabase
              .from("negotiation_installments")
              .select("id, status")
              .eq("negotiation_id", negotiationInstallment.negotiation_id);

            if (allInst && allInst.length > 0 && allInst.every((i: any) => i.status === "paid")) {
              await supabase
                .from("debt_negotiations")
                .update({ status: "completed", finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq("id", negotiationInstallment.negotiation_id)
                .neq("status", "completed");
              console.log("[Lytex Webhook] ✅ Negociação completada automaticamente:", negotiationInstallment.negotiation_id);
            }
          } catch (linkErr: any) {
            console.error("[Lytex Webhook] Erro ao atualizar vínculos da negociação:", linkErr?.message);
          }
        }
      }
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

