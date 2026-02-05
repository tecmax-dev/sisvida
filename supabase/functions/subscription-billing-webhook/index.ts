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
     fee?: number;
     netValue?: number;
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
 
 function mapToSubscriptionStatus(payload: LytexWebhookPayload): "paid" | "cancelled" | "pending" | "overdue" {
   const webhookType = normalizeLytexStatus(payload.webhookType);
   const status = normalizeLytexStatus(payload.data?.status);
 
   // Sinais de pagamento confirmado
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
 
   // Sinais de cancelamento
   const cancelledSignals = new Set([
     "cancelinvoice",
     "cancel_invoice",
     "invoicecancelled",
     "invoice_cancelled",
     "invoicecanceled",
     "invoice_canceled",
   ]);
   if (cancelledSignals.has(webhookType)) return "cancelled";
 
   // Fallback pelo status
   const paidStatuses = new Set(["paid", "payed", "approved", "confirmed", "settled", "completed"]);
   if (paidStatuses.has(status)) return "paid";
 
   const cancelledStatuses = new Set(["canceled", "cancelled", "voided", "reversed"]);
   if (cancelledStatuses.has(status)) return "cancelled";
 
   const overdueStatuses = new Set(["overdue", "expired"]);
   if (overdueStatuses.has(status)) return "overdue";
 
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
   const webhookSecret = Deno.env.get("LYTEX_SUBSCRIPTION_WEBHOOK_SECRET");
 
   try {
     const payload: LytexWebhookPayload = await req.json();
 
     const invoiceId = payload.data?.invoiceId;
     const referenceId = payload.data?.referenceId;
     console.log("[Subscription Webhook] Recebido:", payload.webhookType, invoiceId, referenceId);
 
     // Validar assinatura se secret estiver configurado
     if (webhookSecret && payload.signature && payload.data) {
       const isValid = await verifySignature(payload.data, payload.signature, webhookSecret);
       if (!isValid) {
         console.error("[Subscription Webhook] Assinatura inválida");
         return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
           status: 401,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
     }
 
     // Buscar fatura de assinatura pelo lytex_invoice_id ou referenceId
     let invoice: {
       id: string;
       clinic_id: string;
       status: string | null;
       paid_at: string | null;
     } | null = null;
 
     // Tentar pelo referenceId primeiro (formato: sub-{clinic_id}-{year}-{month})
     if (referenceId && referenceId.startsWith("sub-")) {
       const parts = referenceId.split("-");
       if (parts.length >= 4) {
         const clinicId = parts[1];
         const year = parseInt(parts[2]);
         const month = parseInt(parts[3]);
 
         const { data } = await supabase
           .from("subscription_invoices")
           .select("id, clinic_id, status, paid_at")
           .eq("clinic_id", clinicId)
           .eq("competence_year", year)
           .eq("competence_month", month)
           .maybeSingle();
         invoice = data;
       }
     }
 
     // Fallback pelo lytex_invoice_id
     if (!invoice && invoiceId) {
       const { data } = await supabase
         .from("subscription_invoices")
         .select("id, clinic_id, status, paid_at")
         .eq("lytex_invoice_id", invoiceId)
         .maybeSingle();
       invoice = data;
     }
 
     // Registrar log do webhook (sempre)
     await supabase.from("subscription_webhook_logs").insert({
       clinic_id: invoice?.clinic_id || null,
       invoice_id: invoice?.id || null,
       webhook_type: payload.webhookType || "unknown",
       payload: payload,
       processed: !!invoice,
     });
 
     if (!invoice) {
       console.log("[Subscription Webhook] Fatura não encontrada para:", invoiceId, referenceId);
       return new Response(JSON.stringify({ success: true, message: "Fatura não encontrada" }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     const newStatus = mapToSubscriptionStatus(payload);
 
     // Dados de pagamento
     const paidAt = payload.data?.paidAt || null;
     const payedValue = payload.data?.payedValue;
     const paymentMethod = payload.data?.paymentMethod || null;
     const fee = payload.data?.fee;
     const netValue = payload.data?.netValue;
 
     const updateData: Record<string, unknown> = {
       status: newStatus,
     };
 
     if (newStatus === "paid") {
       updateData.paid_at = paidAt || invoice.paid_at || new Date().toISOString();
       // Lytex envia payedValue em CENTAVOS
       if (typeof payedValue === "number") updateData.paid_value_cents = Math.round(payedValue);
       if (paymentMethod) updateData.payment_method = paymentMethod;
       if (typeof fee === "number") updateData.fee_cents = Math.round(fee);
       if (typeof netValue === "number") updateData.net_value_cents = Math.round(netValue);
     }
 
     if (newStatus === "cancelled") {
       updateData.cancelled_at = payload.data?.canceledAt || new Date().toISOString();
     }
 
     const { error } = await supabase
       .from("subscription_invoices")
       .update(updateData)
       .eq("id", invoice.id);
 
     if (error) {
       console.error("[Subscription Webhook] Erro ao atualizar fatura:", error);
     } else {
       console.log("[Subscription Webhook] Atualizado:", invoice.id, "=>", newStatus);
     }
 
     return new Response(JSON.stringify({ success: true, status: newStatus }), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error: unknown) {
     const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
     console.error("[Subscription Webhook] Erro:", errorMessage);
     return new Response(JSON.stringify({ error: errorMessage }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });