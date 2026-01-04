import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LytexWebhookPayload {
  webhookType: string;
  signature: string;
  data: {
    invoiceId: string;
    status: string;
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

    console.log("[Lytex Webhook] Recebido:", payload.webhookType, payload.data?.invoiceId);

    // Validar assinatura se secret estiver configurado
    if (webhookSecret && payload.signature) {
      const isValid = verifySignature(payload.data, payload.signature, webhookSecret);
      if (!isValid) {
        console.error("[Lytex Webhook] Assinatura inválida");
        return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Buscar contribuição pelo ID da fatura Lytex ou referenceId
    let contribution;
    if (payload.data.referenceId) {
      const { data } = await supabase
        .from("employer_contributions")
        .select("id, clinic_id, status")
        .eq("id", payload.data.referenceId)
        .single();
      contribution = data;
    }

    if (!contribution && payload.data.invoiceId) {
      const { data } = await supabase
        .from("employer_contributions")
        .select("id, clinic_id, status")
        .eq("lytex_invoice_id", payload.data.invoiceId)
        .single();
      contribution = data;
    }

    // Registrar log do webhook
    await supabase.from("lytex_webhook_logs").insert({
      clinic_id: contribution?.clinic_id || null,
      contribution_id: contribution?.id || null,
      webhook_type: payload.webhookType,
      payload: payload,
      processed: !!contribution,
    });

    if (!contribution) {
      console.log("[Lytex Webhook] Contribuição não encontrada para:", payload.data.invoiceId);
      return new Response(JSON.stringify({ success: true, message: "Contribuição não encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processar conforme tipo de webhook
    switch (payload.webhookType) {
      case "invoicePayment": {
        // Pagamento confirmado
        const { error } = await supabase
          .from("employer_contributions")
          .update({
            status: "paid",
            paid_at: payload.data.paidAt || new Date().toISOString(),
            paid_value: payload.data.payedValue,
            payment_method: payload.data.paymentMethod,
          })
          .eq("id", contribution.id);

        if (error) {
          console.error("[Lytex Webhook] Erro ao atualizar pagamento:", error);
        } else {
          console.log("[Lytex Webhook] Pagamento registrado:", contribution.id);
        }
        break;
      }

      case "scheduleInvoicePayment": {
        // Pagamento agendado/em processamento
        const { error } = await supabase
          .from("employer_contributions")
          .update({
            status: "processing",
          })
          .eq("id", contribution.id);

        if (error) {
          console.error("[Lytex Webhook] Erro ao atualizar status:", error);
        } else {
          console.log("[Lytex Webhook] Status atualizado para processing:", contribution.id);
        }
        break;
      }

      case "cancelInvoice": {
        // Cobrança cancelada
        const { error } = await supabase
          .from("employer_contributions")
          .update({
            status: "cancelled",
          })
          .eq("id", contribution.id);

        if (error) {
          console.error("[Lytex Webhook] Erro ao cancelar:", error);
        } else {
          console.log("[Lytex Webhook] Contribuição cancelada:", contribution.id);
        }
        break;
      }

      default:
        console.log("[Lytex Webhook] Tipo não tratado:", payload.webhookType);
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
