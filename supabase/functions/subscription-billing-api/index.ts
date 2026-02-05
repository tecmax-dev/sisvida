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
  clinicDocument: string;
  ownerName?: string;
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

  const cleanDoc = params.clinicDocument.replace(/\D/g, "");
  const isPF = cleanDoc.length <= 11;
  
  const invoicePayload = {
    client: {
      type: isPF ? "pf" : "pj",
      name: isPF && params.ownerName ? params.ownerName : params.clinicName,
      cpfCnpj: cleanDoc,
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

async function updateLytexInvoice(invoiceId: string, updates: {
  dueDate?: string;
  valueCents?: number;
  itemName?: string;
}): Promise<any> {
  const token = await getSubscriptionLytexToken();

  const updatePayload: any = {};

  if (updates.dueDate) {
    updatePayload.dueDate = updates.dueDate;
  }

  if (updates.valueCents !== undefined && updates.itemName) {
    updatePayload.items = [
      {
        name: updates.itemName,
        quantity: 1,
        value: updates.valueCents,
      },
    ];
    // Flag obrigatório para a API Lytex interpretar o valor corretamente em centavos
    updatePayload.valueIsInCents = true;
  }

  console.log("[Subscription Billing] Atualizando fatura Lytex:", invoiceId, JSON.stringify(updatePayload, null, 2));

  const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Subscription Billing] Erro ao atualizar fatura:", errorText);
    throw new Error(`Erro ao atualizar fatura Lytex: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[Subscription Billing] Fatura atualizada:", result);
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

function extractLytexInvoiceIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Prefer UUIDs if present
  const uuid = url.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  )?.[0];
  if (uuid) return uuid;

  // Fallback: last path segment
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return seg || null;
  } catch {
    const seg = url.split("?")[0].split("/").filter(Boolean).pop();
    return seg || null;
  }
}

async function cancelLytexInvoice(invoiceId: string): Promise<any> {
  const token = await getSubscriptionLytexToken();

  const tryCancel = async (statusValue: "cancelled" | "canceled") => {
    console.log(`[Subscription Billing] Cancelando fatura Lytex (${statusValue}): ${invoiceId}`);

    const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ status: statusValue }),
    });

    const responseText = await response.text();
    let responseData: any = {};
    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }
    }

    console.log(`[Subscription Billing] Lytex cancel response: ${response.status}`, responseText);

    const lower = (responseText || "").toLowerCase();
    const alreadyCancelled =
      lower.includes("already cancel") ||
      lower.includes("já cancel");

    if (response.ok) return { ok: true, data: responseData };

    // Considerar como sucesso idempotente apenas quando claramente "já cancelado"
    if (alreadyCancelled) return { ok: true, data: responseData, alreadyCancelled: true };

    return { ok: false, status: response.status, text: responseText, data: responseData };
  };

  // 1) Tentativa padrão
  const first = await tryCancel("cancelled");
  if (first.ok) {
    console.log("[Subscription Billing] Cancelamento confirmado na Lytex");
    return { success: true, ...first.data, alreadyCancelled: first.alreadyCancelled };
  }

  // 2) Retry com grafia alternativa (algumas APIs usam "canceled")
  const second = await tryCancel("canceled");
  if (second.ok) {
    console.log("[Subscription Billing] Cancelamento confirmado na Lytex (retry)");
    return { success: true, ...second.data, alreadyCancelled: second.alreadyCancelled };
  }

  throw new Error(`Erro ao cancelar fatura na Lytex: ${second.status} - ${second.text}`);
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
        const { clinicId, month, year, discountCents, discountReason } = params;

        // Buscar dados da clínica e assinatura
        const { data: clinic, error: clinicError } = await supabase
          .from("clinics")
          .select("id, name, cnpj, owner_cpf, owner_name, email, phone")
          .eq("id", clinicId)
          .single();

        if (clinicError || !clinic) {
          throw new Error("Clínica não encontrada");
        }

        // Determinar documento para faturamento (CNPJ ou CPF do responsável)
        const billingDocument = clinic.cnpj || clinic.owner_cpf;
        if (!billingDocument) {
          throw new Error("Clínica sem CNPJ ou CPF do responsável cadastrado");
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

        // Calcular valor com desconto
        const originalValueCents = Math.round(plan.monthly_price * 100);
        let valueCents = originalValueCents;
        let discountInfo: string | null = null;
        
        if (discountCents && discountCents > 0) {
          if (discountCents >= originalValueCents) {
            throw new Error("O desconto não pode ser maior ou igual ao valor do plano");
          }
          valueCents = originalValueCents - discountCents;
          const discountBRL = (discountCents / 100).toFixed(2).replace(".", ",");
          discountInfo = discountReason 
            ? `Desconto: R$ ${discountBRL} - ${discountReason}`
            : `Desconto aplicado: R$ ${discountBRL}`;
        }
        
        // Criar fatura no Lytex
        const lytexInvoice = await createLytexInvoice({
          clinicId: clinic.id,
          clinicName: clinic.name,
          clinicDocument: billingDocument,
          ownerName: clinic.owner_name,
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
            description: discountInfo 
              ? `Assinatura ${plan.name} - ${String(month).padStart(2, "0")}/${year} (${discountInfo})`
              : `Assinatura ${plan.name} - ${String(month).padStart(2, "0")}/${year}`,
            notes: discountInfo || null,
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

          // Determinar documento para faturamento
          const billingDocument = clinic?.cnpj || clinic?.owner_cpf;
          if (!billingDocument) {
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
              clinicDocument: billingDocument,
              ownerName: clinic.owner_name,
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

      case "update_invoice": {
        // Atualizar data de vencimento e/ou valor de um boleto existente
        const { invoiceId, newDueDate, newValueCents, discountInfo } = params;
        const { regenerateLytex } = params; // Flag para criar boleto na Lytex se não existir

        if (!invoiceId) {
          throw new Error("ID do boleto é obrigatório");
        }

        if (!newDueDate && newValueCents === undefined) {
          throw new Error("Informe nova data de vencimento ou novo valor");
        }

        // Buscar boleto no banco
        const { data: invoice, error: invoiceError } = await supabase
          .from("subscription_invoices")
          .select(`
            *,
            clinics(id, name),
            subscription_plans(id, name)
          `)
          .eq("id", invoiceId)
          .single();

        if (invoiceError || !invoice) {
          throw new Error("Boleto não encontrado");
        }

        // Não permitir editar boletos já pagos ou cancelados
        if (invoice.status === "paid") {
          throw new Error("Não é possível editar um boleto já pago");
        }
        if (invoice.status === "cancelled") {
          throw new Error("Não é possível editar um boleto cancelado");
        }

        // Validar data futura
        if (newDueDate) {
          const [year, month, day] = newDueDate.split("-").map(Number);
          const dueDateObj = new Date(year, month - 1, day, 12, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (dueDateObj < today) {
            throw new Error("A data de vencimento deve ser futura");
          }
        }

        // Validar valor
        if (newValueCents !== undefined && newValueCents <= 0) {
          throw new Error("O valor deve ser maior que zero");
        }

        // Preparar dados para atualização
        const plan = invoice.subscription_plans as any;
        let itemName = `Assinatura ${plan?.name || "Plano"} - ${String(invoice.competence_month).padStart(2, "0")}/${invoice.competence_year}`;
        
        // Adicionar info do desconto na descrição do item se fornecida
        if (discountInfo && newValueCents !== undefined) {
          itemName = `${itemName} (${discountInfo})`;
        }

        // Atualizar no Lytex se tiver ID
        if (invoice.lytex_invoice_id) {
          try {
            console.log("[Subscription Billing] Tentando atualizar Lytex ID:", invoice.lytex_invoice_id, {
              newDueDate,
              newValueCents,
              discountInfo
            });
            await updateLytexInvoice(invoice.lytex_invoice_id, {
              dueDate: newDueDate || undefined,
              valueCents: newValueCents,
              itemName: newValueCents !== undefined ? itemName : undefined,
            });
            console.log("[Subscription Billing] Lytex atualizado com sucesso");
          } catch (lytexError: any) {
            console.error("[Subscription Billing] Erro ao atualizar Lytex:", lytexError);
            console.error("[Subscription Billing] Stack:", lytexError.stack);
            // Continuar com atualização local mesmo se Lytex falhar, mas loggar o erro
          }
        } else {
          console.log("[Subscription Billing] Boleto sem lytex_invoice_id, atualizando apenas local");
        }
        
        // Se não tem lytex_invoice_id e foi solicitado regenerar, criar na Lytex
        let lytexCreated = false;
        const lytexData: any = {};
        
        if (!invoice.lytex_invoice_id && regenerateLytex) {
          console.log("[Subscription Billing] Criando boleto na Lytex (regenerar)...");
          
          // Buscar dados completos da clínica
          const { data: clinic, error: clinicError } = await supabase
            .from("clinics")
            .select("id, name, cnpj, owner_cpf, owner_name, email, phone")
            .eq("id", invoice.clinic_id)
            .single();

          if (clinicError || !clinic) {
            throw new Error("Clínica não encontrada para gerar boleto");
          }

          const billingDocument = clinic.cnpj || clinic.owner_cpf;
          if (!billingDocument) {
            throw new Error("Clínica sem CNPJ ou CPF cadastrado");
          }

          const finalValue = newValueCents ?? invoice.value_cents;
          const finalDueDate = newDueDate ?? invoice.due_date;

          const lytexInvoice = await createLytexInvoice({
            clinicId: clinic.id,
            clinicName: clinic.name,
            clinicDocument: billingDocument,
            ownerName: clinic.owner_name || undefined,
            clinicEmail: clinic.email || undefined,
            clinicPhone: clinic.phone || undefined,
            planName: plan?.name || "Plano",
            valueCents: finalValue,
            dueDate: finalDueDate,
            competenceMonth: invoice.competence_month,
            competenceYear: invoice.competence_year,
          });

          console.log("[Subscription Billing] Boleto criado na Lytex:", lytexInvoice.id);
          
          lytexCreated = true;
          lytexData.lytex_invoice_id = lytexInvoice.id;
          lytexData.lytex_client_id = lytexInvoice.clientId;
          lytexData.invoice_url = lytexInvoice.url || lytexInvoice.paymentUrl;
          lytexData.digitable_line = lytexInvoice.boleto?.digitableLine || lytexInvoice.digitableLine;
          lytexData.pix_code = lytexInvoice.pix?.code || lytexInvoice.pixCode;
        }

        // Atualizar no banco de dados
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };
        
        // Adicionar dados do Lytex se foi criado
        if (lytexCreated) {
          Object.assign(updateData, lytexData);
        }

        if (newDueDate) {
          updateData.due_date = newDueDate;
          // Recalcular status baseado na nova data
          const [year, month, day] = newDueDate.split("-").map(Number);
          const dueDateObj = new Date(year, month - 1, day, 12, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          updateData.status = dueDateObj >= today ? "pending" : "overdue";
        }

        if (newValueCents !== undefined) {
          updateData.value_cents = newValueCents;
          updateData.description = itemName;
        }

        // Salvar nota do desconto se fornecida
        if (discountInfo) {
          updateData.notes = discountInfo;
        }

        const { data: updatedInvoice, error: updateError } = await supabase
          .from("subscription_invoices")
          .update(updateData)
          .eq("id", invoiceId)
          .select()
          .single();

        if (updateError) {
          console.error("[Subscription Billing] Erro ao atualizar banco:", updateError);
          throw new Error("Erro ao atualizar boleto no banco de dados");
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            invoice: updatedInvoice,
            message: "Boleto atualizado com sucesso"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancel_invoice": {
        // Cancelar boleto
        const { invoiceId } = params;

        if (!invoiceId) {
          throw new Error("ID do boleto é obrigatório");
        }

        // Buscar boleto no banco
        const { data: invoice, error: invoiceError } = await supabase
          .from("subscription_invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        if (invoiceError || !invoice) {
          throw new Error("Boleto não encontrado");
        }

        // Não permitir cancelar boletos já pagos
        if (invoice.status === "paid") {
          throw new Error("Não é possível cancelar um boleto já pago");
        }

        // Não permitir cancelar boletos já cancelados
        if (invoice.status === "cancelled") {
          throw new Error("Boleto já está cancelado");
        }

        // Cancelar na Lytex (OBRIGATÓRIO se houver referência)
        const lytexInvoiceId =
          invoice.lytex_invoice_id || extractLytexInvoiceIdFromUrl(invoice.invoice_url);

        if (!lytexInvoiceId) {
          throw new Error(
            "Não foi possível cancelar na Lytex: boleto sem identificador (lytex_invoice_id/invoice_url) salvo no sistema."
          );
        }

        // Se conseguimos extrair pela URL, persistir para não quebrar novamente
        if (!invoice.lytex_invoice_id && lytexInvoiceId) {
          await supabase
            .from("subscription_invoices")
            .update({ lytex_invoice_id: lytexInvoiceId })
            .eq("id", invoiceId);
        }

        // Se a Lytex falhar, NÃO cancelamos localmente (evita divergência)
        await cancelLytexInvoice(lytexInvoiceId);

        // Atualizar status no banco
        const { data: updatedInvoice, error: updateError } = await supabase
          .from("subscription_invoices")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
            notes: invoice.notes 
              ? `${invoice.notes}\n[Cancelado em ${new Date().toLocaleDateString("pt-BR")}]`
              : `[Cancelado em ${new Date().toLocaleDateString("pt-BR")}]`,
          })
          .eq("id", invoiceId)
          .select()
          .single();

        if (updateError) {
          console.error("[Subscription Billing] Erro ao cancelar no banco:", updateError);
          throw new Error("Erro ao cancelar boleto no banco de dados");
        }

        return new Response(
          JSON.stringify({
            success: true,
            invoice: updatedInvoice,
            message: "Boleto cancelado com sucesso",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
