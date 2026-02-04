import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LYTEX_API_URL = Deno.env.get("LYTEX_API_URL") || "https://api-pay.lytex.com.br/v2";

// Cache para token de acesso da conta de assinaturas
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

interface LytexAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function getSubscriptionLytexToken(): Promise<string> {
  const now = Date.now();
  
  if (accessToken && tokenExpiresAt > now + 300000) {
    return accessToken;
  }

  const clientId = Deno.env.get("LYTEX_SUBSCRIPTION_CLIENT_ID");
  const clientSecret = Deno.env.get("LYTEX_SUBSCRIPTION_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Lytex para assinaturas não configuradas (LYTEX_SUBSCRIPTION_CLIENT_ID/SECRET)");
  }

  console.log("[Subscription Billing] Obtendo token Lytex para assinaturas...");

  const response = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Subscription Billing] Erro de autenticação Lytex:", errorText);
    throw new Error(`Erro de autenticação Lytex: ${response.status}`);
  }

  const data: LytexAuthResponse = await response.json();
  accessToken = data.accessToken;
  tokenExpiresAt = now + (data.expiresIn * 1000);

  console.log("[Subscription Billing] Token obtido com sucesso");
  return accessToken;
}

interface CreateInvoiceParams {
  clinicId: string;
  clinicName: string;
  clinicCnpj: string;
  clinicEmail?: string;
  clinicPhone?: string;
  planName: string;
  valueCents: number;
  dueDate: string;
  competenceMonth: number;
  competenceYear: number;
}

async function createLytexInvoice(params: CreateInvoiceParams): Promise<any> {
  const token = await getSubscriptionLytexToken();

  const cleanCnpj = params.clinicCnpj.replace(/\D/g, "");
  
  const invoicePayload = {
    client: {
      type: cleanCnpj.length === 14 ? "pj" : "pf",
      name: params.clinicName,
      cpfCnpj: cleanCnpj,
      email: params.clinicEmail || undefined,
      cellphone: params.clinicPhone?.replace(/\D/g, "").slice(-11) || undefined,
    },
    items: [
      {
        name: `Assinatura ${params.planName} - ${String(params.competenceMonth).padStart(2, "0")}/${params.competenceYear}`,
        quantity: 1,
        value: params.valueCents,
      },
    ],
    dueDate: params.dueDate,
    paymentMethods: {
      pix: { enable: true },
      boleto: { enable: true },
      creditCard: { enable: false },
    },
    referenceId: `sub-${params.clinicId}-${params.competenceYear}-${params.competenceMonth}`,
  };

  console.log("[Subscription Billing] Criando fatura Lytex:", JSON.stringify(invoicePayload, null, 2));

  const response = await fetch(`${LYTEX_API_URL}/invoices`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(invoicePayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Subscription Billing] Erro ao criar fatura:", errorText);
    throw new Error(`Erro ao criar fatura Lytex: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[Subscription Billing] Fatura criada:", result);
  return result.data || result;
}

async function fetchInvoiceDetails(invoiceId: string): Promise<any> {
  const token = await getSubscriptionLytexToken();

  const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar fatura: ${response.status}`);
  }

  const result = await response.json();
  return result.data || result;
}

function mapLytexStatus(invoice: any): "paid" | "pending" | "overdue" | "cancelled" {
  const status = String(invoice?.paymentStatus || invoice?.status || "").toLowerCase().replace(/[\s\-]+/g, "_");
  
  if (["paid", "payed", "approved", "confirmed", "settled", "completed"].includes(status) || invoice?.paid === true) {
    return "paid";
  }
  if (["canceled", "cancelled", "voided", "reversed"].includes(status)) {
    return "cancelled";
  }
  
  const dueDate = invoice?.dueDate || invoice?.due_date;
  if (status === "overdue" || (dueDate && new Date(dueDate) < new Date())) {
    return "overdue";
  }
  
  return "pending";
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[Subscription Billing] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();
    console.log("[Subscription Billing] Action:", action);

    switch (action) {
      case "generate_invoice": {
        // Gerar boleto para uma clínica específica
        const { clinicId, month, year } = params;

        // Buscar dados da clínica e assinatura
        const { data: clinic, error: clinicError } = await supabase
          .from("clinics")
          .select("id, name, cnpj, email, phone")
          .eq("id", clinicId)
          .single();

        if (clinicError || !clinic) {
          throw new Error("Clínica não encontrada");
        }

        if (!clinic.cnpj) {
          throw new Error("Clínica sem CNPJ cadastrado");
        }

        // Buscar assinatura ativa
        const { data: subscription, error: subError } = await supabase
          .from("subscriptions")
          .select("id, plan_id, billing_day, subscription_plans(id, name, monthly_price)")
          .eq("clinic_id", clinicId)
          .eq("status", "active")
          .single();

        if (subError || !subscription) {
          throw new Error("Clínica sem assinatura ativa");
        }

        const plan = subscription.subscription_plans as any;
        if (!plan?.monthly_price || plan.monthly_price <= 0) {
          throw new Error("Plano sem valor configurado");
        }

        // Verificar se já existe boleto para esse mês
        const { data: existing } = await supabase
          .from("subscription_invoices")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("competence_month", month)
          .eq("competence_year", year)
          .maybeSingle();

        if (existing) {
          throw new Error(`Já existe boleto para ${month}/${year}`);
        }

        // Calcular data de vencimento
        const billingDay = subscription.billing_day || 10;
        const dueDate = new Date(year, month - 1, billingDay);
        if (dueDate < new Date()) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        // Criar fatura no Lytex
        const valueCents = Math.round(plan.monthly_price * 100);
        const lytexInvoice = await createLytexInvoice({
          clinicId: clinic.id,
          clinicName: clinic.name,
          clinicCnpj: clinic.cnpj,
          clinicEmail: clinic.email,
          clinicPhone: clinic.phone,
          planName: plan.name,
          valueCents,
          dueDate: dueDate.toISOString().split("T")[0],
          competenceMonth: month,
          competenceYear: year,
        });

        // Salvar no banco
        const { data: invoice, error: insertError } = await supabase
          .from("subscription_invoices")
          .insert({
            clinic_id: clinicId,
            subscription_id: subscription.id,
            plan_id: plan.id,
            competence_month: month,
            competence_year: year,
            value_cents: valueCents,
            due_date: dueDate.toISOString().split("T")[0],
            status: "pending",
            lytex_invoice_id: lytexInvoice.id,
            lytex_client_id: lytexInvoice.clientId,
            invoice_url: lytexInvoice.url || lytexInvoice.paymentUrl,
            digitable_line: lytexInvoice.boleto?.digitableLine || lytexInvoice.digitableLine,
            pix_code: lytexInvoice.pix?.code || lytexInvoice.pixCode,
            description: `Assinatura ${plan.name} - ${String(month).padStart(2, "0")}/${year}`,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[Subscription Billing] Erro ao salvar:", insertError);
          throw new Error("Erro ao salvar boleto");
        }

        return new Response(
          JSON.stringify({ success: true, invoice }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "generate_bulk": {
        // Gerar boletos para todas as clínicas ativas
        const { month, year } = params;

        // Buscar todas as assinaturas ativas
        const { data: subscriptions, error: subError } = await supabase
          .from("subscriptions")
          .select(`
            id, clinic_id, plan_id, billing_day,
            clinics(id, name, cnpj, email, phone),
            subscription_plans(id, name, monthly_price)
          `)
          .eq("status", "active");

        if (subError) throw subError;

        const results = { success: 0, skipped: 0, errors: [] as string[] };

        for (const sub of subscriptions || []) {
          const clinic = sub.clinics as any;
          const plan = sub.subscription_plans as any;

          if (!clinic?.cnpj) {
            results.skipped++;
            continue;
          }

          if (!plan?.monthly_price || plan.monthly_price <= 0) {
            results.skipped++;
            continue;
          }

          // Verificar se já existe
          const { data: existing } = await supabase
            .from("subscription_invoices")
            .select("id")
            .eq("clinic_id", clinic.id)
            .eq("competence_month", month)
            .eq("competence_year", year)
            .maybeSingle();

          if (existing) {
            results.skipped++;
            continue;
          }

          try {
            const billingDay = sub.billing_day || 10;
            const dueDate = new Date(year, month - 1, billingDay);
            if (dueDate < new Date()) {
              dueDate.setMonth(dueDate.getMonth() + 1);
            }

            const valueCents = Math.round(plan.monthly_price * 100);
            const lytexInvoice = await createLytexInvoice({
              clinicId: clinic.id,
              clinicName: clinic.name,
              clinicCnpj: clinic.cnpj,
              clinicEmail: clinic.email,
              clinicPhone: clinic.phone,
              planName: plan.name,
              valueCents,
              dueDate: dueDate.toISOString().split("T")[0],
              competenceMonth: month,
              competenceYear: year,
            });

            await supabase.from("subscription_invoices").insert({
              clinic_id: clinic.id,
              subscription_id: sub.id,
              plan_id: plan.id,
              competence_month: month,
              competence_year: year,
              value_cents: valueCents,
              due_date: dueDate.toISOString().split("T")[0],
              status: "pending",
              lytex_invoice_id: lytexInvoice.id,
              lytex_client_id: lytexInvoice.clientId,
              invoice_url: lytexInvoice.url || lytexInvoice.paymentUrl,
              digitable_line: lytexInvoice.boleto?.digitableLine || lytexInvoice.digitableLine,
              pix_code: lytexInvoice.pix?.code || lytexInvoice.pixCode,
              description: `Assinatura ${plan.name} - ${String(month).padStart(2, "0")}/${year}`,
            });

            results.success++;
          } catch (err: any) {
            results.errors.push(`${clinic.name}: ${err.message}`);
          }
        }

        return new Response(
          JSON.stringify({ success: true, results }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sync_status": {
        // Sincronizar status de faturas pendentes
        const { data: pendingInvoices, error } = await supabase
          .from("subscription_invoices")
          .select("id, lytex_invoice_id")
          .in("status", ["pending", "overdue"])
          .not("lytex_invoice_id", "is", null);

        if (error) throw error;

        let updated = 0;
        for (const inv of pendingInvoices || []) {
          try {
            const lytexData = await fetchInvoiceDetails(inv.lytex_invoice_id!);
            const newStatus = mapLytexStatus(lytexData);

            if (newStatus !== "pending") {
              await supabase
                .from("subscription_invoices")
                .update({
                  status: newStatus,
                  paid_at: newStatus === "paid" ? lytexData.paidAt || new Date().toISOString() : null,
                  paid_value_cents: lytexData.payedValue || lytexData.totalValue,
                  payment_method: lytexData.paymentMethod,
                  fee_cents: lytexData.fee || 0,
                  net_value_cents: lytexData.netValue || null,
                })
                .eq("id", inv.id);
              updated++;
            }
          } catch (err) {
            console.error(`[Subscription Billing] Erro ao sincronizar ${inv.id}:`, err);
          }
        }

        return new Response(
          JSON.stringify({ success: true, updated, total: pendingInvoices?.length || 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "check_credentials": {
        // Verificar se as credenciais estão configuradas
        const clientId = Deno.env.get("LYTEX_SUBSCRIPTION_CLIENT_ID");
        const clientSecret = Deno.env.get("LYTEX_SUBSCRIPTION_CLIENT_SECRET");

        if (!clientId || !clientSecret) {
          return new Response(
            JSON.stringify({ configured: false, message: "Credenciais não configuradas" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          await getSubscriptionLytexToken();
          return new Response(
            JSON.stringify({ configured: true, valid: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch {
          return new Response(
            JSON.stringify({ configured: true, valid: false, message: "Credenciais inválidas" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação não reconhecida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("[Subscription Billing] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
