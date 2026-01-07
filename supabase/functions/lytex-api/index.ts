import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache para o token de acesso
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

const LYTEX_API_URL = Deno.env.get("LYTEX_API_URL") || "https://api-pay.lytex.com.br/v2";

interface LytexAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface CreateInvoiceRequest {
  contributionId: string;
  clinicId: string;
  employer: {
    cnpj: string;
    name: string;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      number?: string;
      complement?: string;
      zone?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
  value: number; // em centavos
  dueDate: string; // YYYY-MM-DD
  description: string;
  enableBoleto: boolean;
  enablePix: boolean;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  
  // Retorna token em cache se ainda válido (com 5 min de margem)
  if (accessToken && tokenExpiresAt > now + 300000) {
    return accessToken;
  }

  const clientId = Deno.env.get("LYTEX_CLIENT_ID");
  const clientSecret = Deno.env.get("LYTEX_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Lytex não configuradas");
  }

  console.log("[Lytex] Obtendo novo access token...");

  const response = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId,
      clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lytex] Erro ao autenticar:", errorText);
    throw new Error(`Erro de autenticação Lytex: ${response.status}`);
  }

  const data: LytexAuthResponse = await response.json();
  accessToken = data.accessToken;
  tokenExpiresAt = now + (data.expiresIn * 1000);

  console.log("[Lytex] Token obtido com sucesso");
  return accessToken;
}

function extractList(resp: any): any[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.items)) return resp.items;
  if (Array.isArray(resp.results)) return resp.results;
  if (Array.isArray(resp.docs)) return resp.docs;

  const d = resp.data;
  if (d) {
    if (Array.isArray(d.data)) return d.data;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.results)) return d.results;
    if (Array.isArray(d.docs)) return d.docs;
    if (Array.isArray(d.clients)) return d.clients;
    if (Array.isArray(d.invoices)) return d.invoices;
  }

  return [];
}

// Listar clientes/empresas da Lytex
async function listClients(page = 1, limit = 100): Promise<any> {
  const token = await getAccessToken();

  const response = await fetch(`${LYTEX_API_URL}/clients?page=${page}&limit=${limit}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lytex] Erro ao listar clientes:", errorText);
    throw new Error(`Erro ao listar clientes: ${response.status}`);
  }

  return response.json();
}

// Listar faturas da Lytex
async function listInvoices(page = 1, limit = 100, status?: string): Promise<any> {
  const token = await getAccessToken();

  let url = `${LYTEX_API_URL}/invoices?page=${page}&limit=${limit}`;
  if (status) {
    url += `&status=${status}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lytex] Erro ao listar faturas:", errorText);
    throw new Error(`Erro ao listar faturas: ${response.status}`);
  }

  return response.json();
}

function normalizeMoneyToCents(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error("Valor inválido para emissão");
  }

  // A API Lytex exige inteiro em centavos e mínimo de 200.
  // Na prática, o frontend pode enviar em reais (ex: 15) ou em centavos (ex: 1500).
  // Heurística segura:
  // - Se tiver casas decimais, assume reais e converte.
  // - Se for inteiro < 200, assume reais e converte (pois em centavos seria inválido de qualquer forma).
  // - Caso contrário, assume que já está em centavos.
  const hasDecimals = Math.round(value) !== value;
  const isLikelyReais = hasDecimals || value < 200;
  const cents = isLikelyReais ? Math.round(value * 100) : Math.round(value);

  return cents;
}

async function createInvoice(params: CreateInvoiceRequest & { registrationNumber?: string }): Promise<any> {
  const token = await getAccessToken();

  // Formatar CPF/CNPJ (remover caracteres especiais)
  const cleanCnpj = params.employer.cnpj.replace(/\D/g, "");

  // Converter valor para centavos (inteiro) - a API Lytex exige isso
  const valueInCents = normalizeMoneyToCents(params.value);

  // Regras conhecidas da Lytex: inteiro em centavos e mínimo de 200 (R$ 2,00)
  if (valueInCents < 200) {
    throw new Error("Valor mínimo para boleto/Pix é R$ 2,00");
  }

  console.log(`[Lytex] Valor original: ${params.value}, Valor em centavos: ${valueInCents}`);

  // Formatar nome com matrícula: "000123 - NOME DA EMPRESA"
  let formattedName = params.employer.name;
  if (params.registrationNumber) {
    const paddedReg = params.registrationNumber.replace(/\D/g, "").padStart(6, "0");
    // Só adiciona prefixo se o nome ainda não começar com número
    if (!/^\d+\s*[-–]/.test(formattedName)) {
      formattedName = `${paddedReg} - ${formattedName}`;
      console.log(`[Lytex] Nome formatado com matrícula: ${formattedName}`);
    }
  }

  const invoicePayload: any = {
    client: {
      type: cleanCnpj.length === 14 ? "pj" : "pf",
      name: formattedName,
      cpfCnpj: cleanCnpj,
      email: params.employer.email || undefined,
      cellphone: params.employer.phone?.replace(/\D/g, "") || undefined,
    },
    items: [
      {
        name: params.description,
        quantity: 1,
        value: valueInCents,
      },
    ],
    dueDate: params.dueDate,
    paymentMethods: {
      pix: { enable: params.enablePix },
      boleto: { enable: params.enableBoleto },
      creditCard: { enable: false },
    },
    referenceId: params.contributionId,
  };

  // Adicionar endereço apenas se estiver completo (a API da Lytex rejeita campos vazios)
  const addr = params.employer.address;
  const zone = addr?.zone?.trim();
  const zip = addr?.zip?.replace(/\D/g, "").trim();
  const city = addr?.city?.trim();
  const state = addr?.state?.trim();
  const street = addr?.street?.trim();

  if (addr && zone && zip && city && state && street) {
    invoicePayload.client.address = {
      street,
      number: addr.number?.trim() || "S/N",
      complement: addr.complement?.trim() || undefined,
      zone,
      city,
      state,
      zip,
    };
  }

  console.log("[Lytex] Criando cobrança:", JSON.stringify(invoicePayload, null, 2));

  const response = await fetch(`${LYTEX_API_URL}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(invoicePayload),
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

  if (!response.ok) {
    console.error("[Lytex] Erro ao criar cobrança:", JSON.stringify(responseData));
    const msg =
      responseData?.message ||
      responseData?.error ||
      (typeof responseData?.raw === "string" ? responseData.raw : null) ||
      `Erro ao criar cobrança: ${response.status}`;
    throw new Error(msg);
  }

  console.log("[Lytex] Cobrança criada com sucesso:", responseData?._id || responseData?.id || "(sem id)");
  return responseData;
}

async function getInvoice(invoiceId: string): Promise<any> {
  const token = await getAccessToken();
  return getInvoiceWithToken(invoiceId, token);
}

// Versão otimizada que aceita token direto (evita múltiplas autenticações em batch)
async function getInvoiceWithToken(invoiceId: string, token: string): Promise<any> {
  const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lytex] Erro ao consultar cobrança:", errorText);
    throw new Error(`Erro ao consultar cobrança: ${response.status}`);
  }

  return response.json();
}

interface UpdateInvoiceRequest {
  invoiceId: string;
  value?: number; // em centavos
  dueDate?: string; // YYYY-MM-DD
  status?: string; // ex: 'cancelled'
}

async function updateInvoice(params: UpdateInvoiceRequest): Promise<any> {
  const token = await getAccessToken();

  const updatePayload: any = {};

  // A Lytex valida dueDate em alguns cenários (ex: PUT). Sempre envie quando disponível.
  if (params.dueDate) {
    updatePayload.dueDate = params.dueDate;
  }

  // Em várias rotas, a API espera items (mesmo quando só atualiza status)
  if (params.value !== undefined) {
    updatePayload.items = [{ name: "Contribuição", quantity: 1, value: params.value }];
  }

  if (params.status) {
    updatePayload.status = params.status;
  }

  console.log("[Lytex] Atualizando cobrança:", params.invoiceId, JSON.stringify(updatePayload));

  const response = await fetch(`${LYTEX_API_URL}/invoices/${params.invoiceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(updatePayload),
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

  if (!response.ok) {
    console.error("[Lytex] Erro ao atualizar cobrança:", JSON.stringify(responseData));
    throw new Error(responseData.message || `Erro ao atualizar cobrança: ${response.status}`);
  }

  console.log("[Lytex] Cobrança atualizada com sucesso");
  return responseData;
}

async function cancelInvoice(params: { invoiceId: string; dueDate?: string; value?: number }): Promise<any> {
  const token = await getAccessToken();

  const extractLytexMessage = (bodyText: string | null): string | null => {
    if (!bodyText) return null;
    const trimmed = bodyText.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return (parsed?.message && String(parsed.message)) || (parsed?.error && String(parsed.error)) || trimmed;
    } catch {
      return trimmed;
    }
  };

  console.log(`[Lytex] Cancelando cobrança ${params.invoiceId} via DELETE...`);

  // Tentar cancelar via DELETE primeiro
  const deleteResponse = await fetch(`${LYTEX_API_URL}/invoices/${params.invoiceId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (deleteResponse.ok) {
    console.log("[Lytex] Cobrança cancelada com sucesso via DELETE");
    return { success: true };
  }

  const deleteText = await deleteResponse.text();
  const deleteMsg = extractLytexMessage(deleteText) || `Erro ao cancelar: ${deleteResponse.status}`;
  console.log(`[Lytex] DELETE retornou ${deleteResponse.status}: ${deleteText}`);

  // Se DELETE falhar, tentar via PUT com status cancelled como fallback
  if (params.dueDate) {
    console.log("[Lytex] Tentando cancelar via PUT (fallback)...");
    try {
      return await updateInvoice({
        invoiceId: params.invoiceId,
        dueDate: params.dueDate,
        value: params.value,
        status: "cancelled",
      });
    } catch (putError) {
      console.error("[Lytex] Fallback PUT também falhou:", putError);
      // Propagar o motivo mais útil do DELETE (sem assumir JSON)
      throw new Error(deleteMsg);
    }
  }

  throw new Error(deleteMsg);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    let result: any;

    switch (action) {
      case "createInvoice": {
        // Formato simplificado (usado por negociações): clientId, clientName, clientDocument, value, dueDate, description
        // Criar cobrança diretamente na Lytex sem vincular a uma contribuição
        const clientName = String(params.clientName || "").trim();
        const clientDocumentRaw = String(params.clientDocument || "").trim();
        const cleanCnpj = clientDocumentRaw.replace(/\D/g, "");
        const dueDate = String(params.dueDate || "");
        const dueDateOnly = dueDate.includes("T") ? dueDate.split("T")[0] : dueDate;

        if (!clientName || !cleanCnpj || !dueDateOnly || params.value === undefined || params.value === null) {
          throw new Error("Dados insuficientes para emitir boleto (empresa, documento, valor e vencimento são obrigatórios)");
        }

        // Buscar matrícula do employer pelo CNPJ
        let registrationNumber: string | undefined;
        const { data: employer } = await supabase
          .from("employers")
          .select("registration_number")
          .eq("cnpj", cleanCnpj)
          .maybeSingle();
        
        if (employer?.registration_number) {
          registrationNumber = employer.registration_number;
          console.log(`[Lytex] Matrícula encontrada para CNPJ ${cleanCnpj}: ${registrationNumber}`);
        }

        const invoiceRequest: CreateInvoiceRequest & { registrationNumber?: string } = {
          contributionId: params.installmentId || params.clientId || "",
          clinicId: "",
          employer: {
            cnpj: cleanCnpj,
            name: clientName,
          },
          value: Number(params.value),
          dueDate: dueDateOnly,
          description: params.description || "Negociação",
          enableBoleto: true,
          enablePix: true,
          registrationNumber,
        };

        const invoice = await createInvoice(invoiceRequest);

        const extractedInvoiceId = invoice?._id || invoice?.id || null;
        const extractedInvoiceUrl =
          invoice?.invoiceUrl ||
          invoice?.linkCheckout ||
          invoice?.linkBoleto ||
          invoice?.checkoutUrl ||
          invoice?.url ||
          invoice?.links?.checkout ||
          null;

        console.log(
          `[Lytex] createInvoice retorno: id=${extractedInvoiceId} url=${extractedInvoiceUrl} installmentId=${params.installmentId || "-"}`,
        );

        // Se for uma parcela de negociação, salvar os dados no banco
        if (params.installmentId) {
          const { error: updateError } = await supabase
            .from("negotiation_installments")
            .update({
              lytex_invoice_id: extractedInvoiceId,
              lytex_invoice_url: extractedInvoiceUrl,
              lytex_boleto_barcode: invoice?.boleto?.barCode || null,
              lytex_boleto_digitable_line: invoice?.boleto?.digitableLine || null,
              lytex_pix_code: invoice?.pix?.code || null,
              lytex_pix_qrcode: invoice?.pix?.qrCode || null,
            })
            .eq("id", params.installmentId);

          if (updateError) {
            console.error("[Lytex] Falha ao salvar boleto na parcela:", updateError);
            throw updateError;
          }
        }

        result = { success: true, invoice };
        break;
      }

      case "create_invoice": {
        // Criar cobrança na Lytex (usado por contribuições)
        // Buscar matrícula do employer
        let registrationNumber2: string | undefined;
        const employerCnpj = params.employer?.cnpj?.replace(/\D/g, "");
        if (employerCnpj) {
          const { data: employer2 } = await supabase
            .from("employers")
            .select("registration_number")
            .eq("cnpj", employerCnpj)
            .maybeSingle();
          
          if (employer2?.registration_number) {
            registrationNumber2 = employer2.registration_number;
            console.log(`[Lytex] Matrícula encontrada para CNPJ ${employerCnpj}: ${registrationNumber2}`);
          }
        }

        const invoiceParams = { ...params, registrationNumber: registrationNumber2 } as CreateInvoiceRequest & { registrationNumber?: string };
        const invoice = await createInvoice(invoiceParams);

        // Extrair URL da fatura - Lytex pode retornar em diferentes campos
        const extractedInvoiceUrl =
          invoice?.linkCheckout ||
          invoice?.linkBoleto ||
          invoice?.invoiceUrl ||
          invoice?.checkoutUrl ||
          invoice?.url ||
          null;

        console.log(`[Lytex] create_invoice: id=${invoice?._id} url=${extractedInvoiceUrl}`);

        // Atualizar contribuição no banco com os dados da Lytex
        const { error: updateError } = await supabase
          .from("employer_contributions")
          .update({
            lytex_invoice_id: invoice._id,
            lytex_invoice_url: extractedInvoiceUrl,
            lytex_boleto_barcode: invoice.boleto?.barCode || null,
            lytex_boleto_digitable_line: invoice.boleto?.digitableLine || null,
            lytex_pix_code: invoice.pix?.code || null,
            lytex_pix_qrcode: invoice.pix?.qrCode || null,
            status: "pending",
          })
          .eq("id", params.contributionId);

        if (updateError) {
          console.error("[Lytex] Erro ao atualizar contribuição:", updateError);
          throw new Error("Erro ao salvar dados da cobrança");
        }

        result = { success: true, invoice, invoiceUrl: extractedInvoiceUrl };
        break;
      }

      case "get_invoice": {
        if (!params.invoiceId) {
          throw new Error("invoiceId é obrigatório");
        }
        result = await getInvoice(params.invoiceId);
        break;
      }

      case "cancel_invoice": {
        if (!params.invoiceId || !params.contributionId) {
          throw new Error("invoiceId e contributionId são obrigatórios");
        }

        // Buscar dados necessários para cancelamento (a API exige dueDate no PUT)
        const { data: contrib, error: contribError } = await supabase
          .from("employer_contributions")
          .select("due_date,value")
          .eq("id", params.contributionId)
          .single();

        if (contribError || !contrib?.due_date) {
          console.error("[Lytex] Não foi possível buscar due_date da contribuição:", contribError);
          throw new Error("Não foi possível cancelar: dados da contribuição incompletos");
        }

        await cancelInvoice({
          invoiceId: params.invoiceId,
          dueDate: contrib.due_date,
          value: typeof contrib.value === "number" ? contrib.value : undefined,
        });

        // Atualizar status no banco
        const { error: updateError } = await supabase
          .from("employer_contributions")
          .update({ status: "cancelled" })
          .eq("id", params.contributionId);

        if (updateError) {
          console.error("[Lytex] Erro ao atualizar contribuição:", updateError);
        }

        result = { success: true };
        break;
      }

      case "update_invoice": {
        if (!params.invoiceId || !params.contributionId) {
          throw new Error("invoiceId e contributionId são obrigatórios");
        }

        const updatedInvoice = await updateInvoice({
          invoiceId: params.invoiceId,
          value: params.value,
          dueDate: params.dueDate,
        });

        // Atualizar dados no banco
        const updateData: any = {};
        if (params.value !== undefined) updateData.value = params.value;
        if (params.dueDate) updateData.due_date = params.dueDate;
        if (params.status) updateData.status = params.status;
        
        if (Object.keys(updateData).length > 0) {
          const { error: dbError } = await supabase
            .from("employer_contributions")
            .update(updateData)
            .eq("id", params.contributionId);

          if (dbError) {
            console.error("[Lytex] Erro ao atualizar contribuição no banco:", dbError);
          }
        }

        result = { success: true, invoice: updatedInvoice };
        break;
      }

      case "sync_status": {
        // Sincronizar status de uma contribuição
        if (!params.contributionId) {
          throw new Error("contributionId é obrigatório");
        }

        const { data: contribution, error: fetchError } = await supabase
          .from("employer_contributions")
          .select("lytex_invoice_id")
          .eq("id", params.contributionId)
          .single();

        if (fetchError || !contribution?.lytex_invoice_id) {
          throw new Error("Contribuição não encontrada ou sem cobrança Lytex");
        }

        const invoice = await getInvoice(contribution.lytex_invoice_id);

        // Mapear status da Lytex para nosso status
        let newStatus = "pending";
        if (invoice.status === "paid") {
          newStatus = "paid";
        } else if (invoice.status === "canceled") {
          newStatus = "cancelled";
        } else if (invoice.status === "overdue" || new Date(invoice.dueDate) < new Date()) {
          newStatus = "overdue";
        }

        const { error: updateError2 } = await supabase
          .from("employer_contributions")
          .update({
            status: newStatus,
            paid_at: invoice.paidAt || null,
            // Lytex returns payedValue in REAIS, convert to CENTS
            paid_value: invoice.payedValue ? Math.round(invoice.payedValue * 100) : null,
            payment_method: invoice.paymentMethod || null,
          })
          .eq("id", params.contributionId);

        if (updateError2) {
          console.error("[Lytex] Erro ao atualizar status:", updateError2);
        }

        result = { success: true, status: newStatus, invoice };
        break;
      }

      case "sync_all_pending": {
        // Sincronizar status de TODAS as contribuições pendentes da clínica
        // Usa processamento em lotes paralelos para evitar timeout
        if (!params.clinicId) {
          throw new Error("clinicId é obrigatório");
        }

        const { data: pendingContributions, error: listError } = await supabase
          .from("employer_contributions")
          .select("id, lytex_invoice_id, status, employer:employers(name, cnpj), value, competence_month, competence_year")
          .eq("clinic_id", params.clinicId)
          .not("lytex_invoice_id", "is", null)
          .in("status", ["pending", "overdue", "processing"]);

        if (listError) {
          throw new Error("Erro ao buscar contribuições pendentes");
        }

        const total = pendingContributions?.length || 0;
        console.log(`[Lytex] Sincronizando ${total} contribuições em lotes paralelos...`);

        // Criar log de sincronização no início
        const { data: syncLog, error: logError } = await supabase
          .from("lytex_sync_logs")
          .insert({
            clinic_id: params.clinicId,
            sync_type: "sync_all_pending",
            status: "running",
            details: { 
              progress: { phase: "syncing", total, processed: 0 }
            }
          })
          .select("id")
          .single();

        if (logError) {
          console.error("[Lytex] Erro ao criar log de sincronização:", logError);
        }

        // Obter token UMA VEZ no início para reutilizar em todas as requisições
        const lytexToken = await getAccessToken();

        const results: Array<{ 
          id: string; 
          status: string; 
          previousStatus: string;
          synced: boolean; 
          error?: string;
          employerName?: string;
          employerCnpj?: string;
          value?: number;
          competence?: string;
        }> = [];

        // Função para sincronizar uma única contribuição
        const syncSingleContrib = async (contrib: any) => {
          const previousStatus = contrib.status;
          const employerName = contrib.employer?.name || "Desconhecido";
          const employerCnpj = contrib.employer?.cnpj || "";
          const value = contrib.value;
          const competence = `${String(contrib.competence_month).padStart(2, "0")}/${contrib.competence_year}`;

          try {
            // Usar getInvoiceWithToken para evitar múltiplas autenticações
            const invoice = await getInvoiceWithToken(contrib.lytex_invoice_id, lytexToken);

            let newStatus = "pending";
            if (invoice.status === "paid") {
              newStatus = "paid";
            } else if (invoice.status === "canceled" || invoice.status === "cancelled") {
              newStatus = "cancelled";
            } else if (invoice.status === "overdue" || (invoice.dueDate && new Date(invoice.dueDate) < new Date())) {
              newStatus = "overdue";
            }

            if (newStatus !== previousStatus) {
              const { error: updateErr } = await supabase
                .from("employer_contributions")
                .update({
                  status: newStatus,
                  paid_at: invoice.paidAt || null,
                  paid_value: invoice.payedValue ? Math.round(invoice.payedValue * 100) : null,
                  payment_method: invoice.paymentMethod || null,
                })
                .eq("id", contrib.id);

              if (updateErr) {
                return { id: contrib.id, status: newStatus, previousStatus, synced: false, error: updateErr.message, employerName, employerCnpj, value, competence };
              }
              return { id: contrib.id, status: newStatus, previousStatus, synced: true, employerName, employerCnpj, value, competence };
            }
            return { id: contrib.id, status: newStatus, previousStatus, synced: true, employerName, employerCnpj, value, competence };
          } catch (e: any) {
            console.error(`[Lytex] Erro ao sincronizar ${contrib.id}:`, e.message);
            return { id: contrib.id, status: previousStatus, previousStatus, synced: false, error: e.message, employerName, employerCnpj, value, competence };
          }
        };

        // Processar em lotes paralelos de 10
        const BATCH_SIZE = 10;
        for (let i = 0; i < (pendingContributions?.length || 0); i += BATCH_SIZE) {
          const batch = (pendingContributions || []).slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(batch.map(syncSingleContrib));
          results.push(...batchResults);
          
          // Atualizar progresso no log
          if (syncLog?.id) {
            await supabase
              .from("lytex_sync_logs")
              .update({
                details: { 
                  progress: { phase: "syncing", total, processed: results.length }
                }
              })
              .eq("id", syncLog.id);
          }
          
          // Log de progresso a cada lote
          if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= total) {
            console.log(`[Lytex] Progresso: ${Math.min(i + BATCH_SIZE, total)}/${total}`);
          }
        }

        const syncedCount = results.filter(r => r.synced).length;
        const updatedCount = results.filter(r => r.synced && r.status !== r.previousStatus).length;
        console.log(`[Lytex] Sincronização concluída: ${syncedCount}/${results.length} sucesso, ${updatedCount} atualizados`);

        // Atualizar log com resultado final
        if (syncLog?.id) {
          await supabase
            .from("lytex_sync_logs")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              invoices_updated: updatedCount,
              details: {
                total: results.length,
                synced: syncedCount,
                updated: updatedCount,
                invoices: results.map(r => ({
                  id: r.id,
                  employerName: r.employerName,
                  employerCnpj: r.employerCnpj,
                  value: r.value,
                  competence: r.competence,
                  previousStatus: r.previousStatus,
                  newStatus: r.status,
                  changed: r.status !== r.previousStatus,
                  synced: r.synced,
                  error: r.error
                }))
              }
            })
            .eq("id", syncLog.id);
        }

        result = { success: true, total: results.length, synced: syncedCount, updated: updatedCount, syncLogId: syncLog?.id };
        break;
      }

      case "delete_contribution": {
        if (!params.contributionId) {
          throw new Error("contributionId é obrigatório");
        }

        // Buscar contribuição para verificar se tem boleto
        const { data: contrib, error: fetchErr } = await supabase
          .from("employer_contributions")
          .select("lytex_invoice_id, status")
          .eq("id", params.contributionId)
          .single();

        if (fetchErr) {
          throw new Error("Contribuição não encontrada");
        }

        // Se tem boleto na Lytex e não está cancelado, cancelar primeiro
        if (contrib.lytex_invoice_id && contrib.status !== "cancelled") {
          try {
            await cancelInvoice(contrib.lytex_invoice_id);
            console.log("[Lytex] Boleto cancelado antes da exclusão");
          } catch (e) {
            console.warn("[Lytex] Erro ao cancelar boleto (pode já estar cancelado):", e);
          }
        }

        // Excluir do banco
        const { error: deleteError } = await supabase
          .from("employer_contributions")
          .delete()
          .eq("id", params.contributionId);

        if (deleteError) {
          console.error("[Lytex] Erro ao excluir contribuição:", deleteError);
          throw new Error("Erro ao excluir contribuição");
        }

        console.log("[Lytex] Contribuição excluída:", params.contributionId);
        result = { success: true };
        break;
      }

      case "import_from_lytex": {
        // Importar clientes e faturas da Lytex para o sistema
        if (!params.clinicId) {
          throw new Error("clinicId é obrigatório");
        }

        console.log("[Lytex] Iniciando importação para clínica:", params.clinicId);

        // Criar log de sincronização com campos de progresso
        const { data: syncLog, error: logError } = await supabase
          .from("lytex_sync_logs")
          .insert({
            clinic_id: params.clinicId,
            sync_type: "full",
            status: "running",
            details: { 
              progress: { 
                phase: "starting", 
                clientsProcessed: 0, 
                invoicesProcessed: 0,
                totalClients: 0,
                totalInvoices: 0,
              } 
            },
          })
          .select()
          .single();

        if (logError) {
          console.error("[Lytex] Erro ao criar log:", logError);
        }

        let clientsImported = 0;
        let clientsUpdated = 0;
        let invoicesImported = 0;
        let invoicesUpdated = 0;
        const errors: string[] = [];
        
        // Arrays para armazenar detalhes para exibição
        const clientDetails: Array<{ name: string; cnpj: string; action: "imported" | "updated" }> = [];
        const invoiceDetails: Array<{ employerName: string; competence: string; value: number; status: string; action: "imported" | "updated" }> = [];

        // Função helper para atualizar progresso
        let lastProgressUpdate = 0;
        const updateProgress = async (phase: string, clientsProcessed: number, invoicesProcessed: number, totalClients?: number, totalInvoices?: number) => {
          if (!syncLog?.id) return;
          const now = Date.now();
          // Atualizar no máximo a cada 500ms para não sobrecarregar
          if (now - lastProgressUpdate < 500) return;
          lastProgressUpdate = now;
          
          await supabase
            .from("lytex_sync_logs")
            .update({
              details: {
                progress: {
                  phase,
                  clientsProcessed,
                  invoicesProcessed,
                  totalClients: totalClients || 0,
                  totalInvoices: totalInvoices || 0,
                },
              },
            })
            .eq("id", syncLog.id);
        };

        try {
          // 1. Importar clientes
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const clientsResponse = await listClients(page, 100);
            const clients = extractList(clientsResponse);

            if (page === 1) {
              console.log("[Lytex] Payload clientes (chaves):", Object.keys(clientsResponse || {}));
              console.log(`[Lytex] Clientes recebidos (page=1): ${clients.length}`);
            }

            if (clients.length === 0) {
              hasMore = false;
              break;
            }

            for (const client of clients) {
              const cnpj = client.cpfCnpj?.replace(/\D/g, "");
              if (!cnpj) continue;

              // Verificar se já existe pelo lytex_client_id ou CNPJ
              const { data: existing } = await supabase
                .from("employers")
                .select("id, lytex_client_id")
                .eq("clinic_id", params.clinicId)
                .or(`lytex_client_id.eq.${client._id},cnpj.eq.${cnpj}`)
                .maybeSingle();

              if (existing) {
                // Atualizar se necessário
                if (!existing.lytex_client_id) {
                  await supabase
                    .from("employers")
                    .update({ lytex_client_id: client._id })
                    .eq("id", existing.id);
                  clientsUpdated++;
                  clientDetails.push({
                    name: client.name || "Sem nome",
                    cnpj: cnpj,
                    action: "updated",
                  });
                }
              } else {
                // Criar nova empresa
                const { error: insertError } = await supabase
                  .from("employers")
                  .insert({
                    clinic_id: params.clinicId,
                    name: client.name,
                    cnpj: cnpj,
                    email: client.email || null,
                    phone: client.cellphone || null,
                    address: client.address?.street || null,
                    city: client.address?.city || null,
                    state: client.address?.state || null,
                    lytex_client_id: client._id,
                    is_active: true,
                  });

                if (insertError) {
                  console.error("[Lytex] Erro ao inserir empresa:", insertError);
                  errors.push(`Empresa ${client.name}: ${insertError.message}`);
                } else {
                  clientsImported++;
                  clientDetails.push({
                    name: client.name || "Sem nome",
                    cnpj: cnpj,
                    action: "imported",
                  });
                }
              }
              
              // Atualizar progresso a cada cliente processado
              await updateProgress("clients", clientsImported + clientsUpdated, 0);
            }

            page++;
            if (clients.length < 100) hasMore = false;
          }

          // Atualizar fase para faturas
          await updateProgress("invoices_preparing", clientsImported + clientsUpdated, 0);
          console.log(`[Lytex] Clientes importados: ${clientsImported}, atualizados: ${clientsUpdated}`);

          // 2. Importar faturas
          // A API da Lytex pode (ou não) exigir filtro por status. Para garantir que boletos
          // a vencer (abertos) também venham, tentamos primeiro SEM filtro (todas as faturas).
          // Se a Lytex não retornar nada sem filtro, caímos para uma varredura por status.

          const fallbackInvoiceStatuses = [
            "pending",
            "processing",
            "overdue",
            "paid",
            "canceled",
            "cancelled",
          ];

          // Otimização: carregar mapa de empresas uma vez (evita 1 SELECT por fatura)
          const { data: employersForMap, error: employersMapError } = await supabase
            .from("employers")
            .select("id, cnpj, name")
            .eq("clinic_id", params.clinicId);

          if (employersMapError) {
            throw new Error(`Erro ao carregar empresas para importação: ${employersMapError.message}`);
          }

          const employerByCnpj = new Map<string, string>();
          const employerNameById = new Map<string, string>();
          for (const e of employersForMap || []) {
            if (e?.cnpj) employerByCnpj.set(String(e.cnpj).replace(/\D/g, ""), e.id);
            if (e?.id && e?.name) employerNameById.set(e.id, e.name);
          }

          // Carregar todos os tipos de contribuição para mapeamento dinâmico
          const { data: allContribTypes } = await supabase
            .from("contribution_types")
            .select("id, name")
            .eq("clinic_id", params.clinicId);

          // Mapa por nome completo (para compatibilidade)
          const contribTypeByName = new Map<string, string>();
          // Mapa por código base (124, 125, 126) para vincular ao tipo base correto
          const contribTypeByCode = new Map<string, string>();
          
          for (const ct of allContribTypes || []) {
            const nameUpper = ct.name.trim().toUpperCase();
            contribTypeByName.set(nameUpper, ct.id);
            
            // Extrair código base do nome do tipo (ex: "124 - MENSALIDADE SINDICAL" -> "124")
            const codeMatch = ct.name.match(/^(\d{3})\s*-/);
            if (codeMatch) {
              contribTypeByCode.set(codeMatch[1], ct.id);
            }
          }

          // Função para determinar o tipo de contribuição baseado no "Pedido" da Lytex
          // Mapeia códigos especiais (756) e palavras-chave para os tipos base corretos
          const resolveContributionType = (orderName: string): string | null => {
            const upper = orderName.toUpperCase().trim();
            
            // Extrair código do início (ex: "124 - ...", "756 - ...")
            const codeMatch = upper.match(/^(\d{3})\s*-/);
            const code = codeMatch ? codeMatch[1] : null;
            
            // Código 756: mapear pelo conteúdo textual
            if (code === "756") {
              if (upper.includes("MENSALIDADE SINDICAL")) {
                return contribTypeByCode.get("124") || null;
              }
              if (upper.includes("TAXA NEGOCIAL") && (upper.includes("MERCADOS") || upper.includes("MERCADO"))) {
                return contribTypeByCode.get("125") || null;
              }
              if (upper.includes("TAXA NEGOCIAL") && (upper.includes("VAREJISTA") || upper.includes("VEREJ"))) {
                return contribTypeByCode.get("126") || null;
              }
              // Se não conseguir mapear, tenta o código diretamente ou fallback
              return null;
            }
            
            // Códigos padrão (124, 125, 126, 127, 128): buscar diretamente
            if (code && contribTypeByCode.has(code)) {
              return contribTypeByCode.get(code) || null;
            }
            
            // Fallback por palavras-chave (tipos sem código numérico)
            if (upper.includes("DEBITO NEGOCIADO") || upper.includes("NEGOCIAÇÃO DE DÉBITO") || upper.includes("NEGOCIACAO DE DEBITO")) {
              return contribTypeByCode.get("127") || null;
            }
            if (upper.includes("MENSALIDADE INDIVIDUAL") || upper.includes("CONTRIBUIÇÃO INDIVIDUAL") || upper.includes("CONTRIBUICAO INDIVIDUAL")) {
              return contribTypeByCode.get("128") || null;
            }
            
            // Buscar pelo nome completo no mapa
            return contribTypeByName.get(upper) || null;
          };

          // Tipo padrão (fallback) se não encontrar correspondência
          let defaultTypeId = contribTypeByName.get("MENSALIDADE") || null;
          if (!defaultTypeId) {
            const { data: newType, error: newTypeError } = await supabase
              .from("contribution_types")
              .insert({
                clinic_id: params.clinicId,
                name: "Mensalidade",
                default_value: 0,
                is_active: true,
              })
              .select()
              .single();

            if (newTypeError) {
              throw new Error(`Erro ao criar tipo 'Mensalidade': ${newTypeError.message}`);
            }
            defaultTypeId = newType?.id;
            if (defaultTypeId) {
              contribTypeByName.set("MENSALIDADE", defaultTypeId);
            }
          }

          if (!defaultTypeId) {
            throw new Error("Tipo de contribuição padrão (Mensalidade) não disponível");
          }

          const seenInvoiceIds = new Set<string>();

          // Detectar se listInvoices sem status funciona
          let statusFiltersToUse: (string | undefined)[] = [undefined];
          try {
            const probeResp = await listInvoices(1, 1);
            const probeList = extractList(probeResp);
            if (!probeList || probeList.length === 0) {
              statusFiltersToUse = [...fallbackInvoiceStatuses];
            }
          } catch (e) {
            // Se a rota sem status falhar, usamos o fallback por status
            statusFiltersToUse = [...fallbackInvoiceStatuses];
          }

          for (const statusFilter of statusFiltersToUse) {
            page = 1;
            hasMore = true;

            while (hasMore) {
              const invoicesResponse = await listInvoices(page, 100, statusFilter);
              const invoices = extractList(invoicesResponse);

              const statusLabel = statusFilter ?? "all";

              if (page === 1) {
                console.log(`[Lytex] Payload faturas (status=${statusLabel}) chaves:`, Object.keys(invoicesResponse || {}));
                console.log(`[Lytex] Faturas recebidas (status=${statusLabel}, page=1): ${invoices.length}`);
              }

              if (invoices.length === 0) {
                hasMore = false;
                break;
              }

              const pickStatusRank = (s: string) => {
                // maior = mais “definitivo”
                switch (s) {
                  case "paid":
                    return 5;
                  case "overdue":
                    return 4;
                  case "processing":
                    return 3;
                  case "pending":
                    return 2;
                  case "cancelled":
                    return 1;
                  default:
                    return 0;
                }
              };

              // Deduplicação por chave única do banco: (employer_id, contribution_type_id, competence_month, competence_year)
              // Isso evita:
              // 1) duplicatas dentro do mesmo lote (ex: fatura cancelada + nova no mesmo mês)
              // 2) erro 23505 ao inserir quando já existe registro
              const rowsByKey = new Map<string, any>();

              for (const invoice of invoices) {
                if (!invoice?._id) continue;
                if (seenInvoiceIds.has(invoice._id)) continue;
                seenInvoiceIds.add(invoice._id);

                const clientCnpj = invoice.client?.cpfCnpj?.replace(/\D/g, "");
                if (!clientCnpj) continue;

                const employerId = employerByCnpj.get(clientCnpj);
                if (!employerId) continue;

                const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
                if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

                // Competência é sempre o mês ANTERIOR ao vencimento
                // Ex: vencimento 13/01/2026 -> competência 12/2025
                const compDate = new Date(dueDate);
                compDate.setMonth(compDate.getMonth() - 1);
                const competenceMonth = compDate.getMonth() + 1;
                const competenceYear = compDate.getFullYear();

                let status = "pending";
                if (invoice.status === "paid") status = "paid";
                else if (invoice.status === "canceled" || invoice.status === "cancelled") status = "cancelled";
                else if (invoice.status === "overdue") status = "overdue";
                else if (invoice.status === "processing") status = "processing";

                // IMPORTANT: Lytex returns values in REAIS, but our DB stores CENTS
                const valueInReais = invoice.items?.reduce((sum: number, item: any) => sum + (item.value || 0), 0) || 0;
                const value = Math.round(valueInReais * 100); // Convert to cents

                // A Lytex retorna linkCheckout (página de pagamento) ou linkBoleto (PDF do boleto)
                const invoiceUrl = invoice.linkCheckout || invoice.linkBoleto || invoice.invoiceUrl || null;

                // Log para debug (apenas primeiras faturas)
                if (page === 1 && invoices.indexOf(invoice) < 2) {
                  console.log(`[Lytex] Invoice ${invoice._id}: linkCheckout=${invoice.linkCheckout}, linkBoleto=${invoice.linkBoleto}`);
                }

                // Determinar tipo de contribuição pelo campo "Pedido" (items[0].name)
                // Usa a função resolveContributionType que lida com mapeamento de códigos 756 e palavras-chave
                const orderName = invoice.items?.[0]?.name?.trim() || "";
                
                // Usar a nova função que resolve tipos por código e palavras-chave
                let contributionTypeId = resolveContributionType(orderName);

                // Fallback final para tipo padrão "Mensalidade"
                if (!contributionTypeId) {
                  contributionTypeId = defaultTypeId;
                  console.log(`[Lytex] Tipo não mapeado para "${orderName}", usando Mensalidade como padrão`);
                }

                const patch = {
                  clinic_id: params.clinicId,
                  employer_id: employerId,
                  contribution_type_id: contributionTypeId,
                  competence_month: competenceMonth,
                  competence_year: competenceYear,

                  value,
                  due_date: invoice.dueDate?.split("T")[0],
                  status,
                  lytex_invoice_id: invoice._id,
                  lytex_invoice_url: invoiceUrl,
                  lytex_boleto_barcode: invoice.boleto?.barCode || null,
                  lytex_boleto_digitable_line: invoice.boleto?.digitableLine || null,
                  lytex_pix_code: invoice.pix?.code || null,
                  lytex_pix_qrcode: invoice.pix?.qrCode || null,
                  paid_at: invoice.paidAt || null,
                  // Lytex returns payedValue in REAIS, convert to CENTS
                  paid_value: invoice.payedValue ? Math.round(invoice.payedValue * 100) : null,
                  payment_method: invoice.paymentMethod || null,
                };

                const key = `${employerId}|${contributionTypeId}|${competenceMonth}|${competenceYear}`;
                const current = rowsByKey.get(key);

                if (!current) {
                  rowsByKey.set(key, patch);
                  continue;
                }

                // Se houver mais de uma fatura para a mesma competência, mantém a “melhor”
                // (ex: paid ganha de pending; overdue ganha de pending, etc.)
                const currentRank = pickStatusRank(String(current.status));
                const nextRank = pickStatusRank(status);
                if (nextRank >= currentRank) {
                  rowsByKey.set(key, patch);
                }
              }

              const rows = Array.from(rowsByKey.values());

              if (rows.length > 0) {
                // Upsert em lote (atômico) para evitar 23505 e atualizar registros existentes.
                // IMPORTANTE: o lote NÃO pode conter chaves duplicadas — garantido por rowsByKey.
                const chunkSize = 200;
                for (let i = 0; i < rows.length; i += chunkSize) {
                  const chunk = rows.slice(i, i + chunkSize);

                  const { error: upsertErr } = await supabase
                    .from("employer_contributions")
                    .upsert(chunk, {
                      onConflict: "active_competence_key",
                      ignoreDuplicates: false,
                    });

                  if (upsertErr) {
                    console.error("[Lytex] Erro ao upsert lote de faturas:", upsertErr);
                    errors.push(`Upsert faturas (status=${statusFilter ?? "all"}, page=${page}): ${upsertErr.message}`);
                  } else {
                    // Adicionar detalhes das faturas processadas
                    for (const row of chunk) {
                      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                      invoiceDetails.push({
                        employerName: employerNameById.get(row.employer_id) || "Desconhecido",
                        competence: `${monthNames[row.competence_month - 1]}/${row.competence_year}`,
                        value: row.value || 0,
                        status: row.status,
                        action: "imported", // upsert = treated as imported/updated
                      });
                    }
                    invoicesImported += chunk.length;
                    
                    // Atualizar progresso a cada lote de faturas
                    await updateProgress("invoices", clientsImported + clientsUpdated, invoicesImported + invoicesUpdated);
                  }
                }
              }

              page++;
              if (invoices.length < 100) hasMore = false;
            }
          }

          // Atualizar progresso para fase de finalização
          await updateProgress("finishing", clientsImported + clientsUpdated, invoicesImported + invoicesUpdated);
          console.log(`[Lytex] Faturas processadas: ${invoicesImported}, atualizadas: ${invoicesUpdated}`);

          // Atualizar log
          if (syncLog?.id) {
            await supabase
              .from("lytex_sync_logs")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                clients_imported: clientsImported,
                clients_updated: clientsUpdated,
                invoices_imported: invoicesImported,
                invoices_updated: invoicesUpdated,
                details: { errors, clients: clientDetails, invoices: invoiceDetails },
              })
              .eq("id", syncLog.id);
          }

          result = {
            success: true,
            clientsImported,
            clientsUpdated,
            invoicesImported,
            invoicesUpdated,
            errors: errors.length > 0 ? errors : undefined,
            syncLogId: syncLog?.id,
          };

        } catch (importError: any) {
          console.error("[Lytex] Erro durante importação:", importError);

          if (syncLog?.id) {
            await supabase
              .from("lytex_sync_logs")
              .update({
                status: "failed",
                completed_at: new Date().toISOString(),
                error_message: importError.message,
                clients_imported: clientsImported,
                clients_updated: clientsUpdated,
                invoices_imported: invoicesImported,
                invoices_updated: invoicesUpdated,
              })
              .eq("id", syncLog.id);
          }

          throw importError;
        }
        break;
      }

      case "extract_registration_numbers": {
        // Extrair números de matrícula das descrições das faturas antigas
        // Padrão: "CLIENTE 129 - FOX COMERCIO DE PAPEIS E LIVROS LTDA"
        if (!params.clinicId) {
          throw new Error("clinicId é obrigatório");
        }

        console.log("[Lytex] Iniciando extração de matrículas para clínica:", params.clinicId);

        // Carregar todas as empresas da clínica
        const { data: employers, error: employersError } = await supabase
          .from("employers")
          .select("id, cnpj, name, registration_number")
          .eq("clinic_id", params.clinicId);

        if (employersError) {
          throw new Error(`Erro ao carregar empresas: ${employersError.message}`);
        }

        // Criar mapa de CNPJ para empresa
        const employerByCnpj = new Map<string, { id: string; name: string; registration_number: string | null }>();
        for (const e of employers || []) {
          if (e?.cnpj) {
            employerByCnpj.set(String(e.cnpj).replace(/\D/g, ""), {
              id: e.id,
              name: e.name,
              registration_number: e.registration_number,
            });
          }
        }

        // Mapa para armazenar CNPJ -> número de cliente extraído
        const registrationMap = new Map<string, string>();
        const seenInvoiceIds = new Set<string>();
        const extractedDetails: Array<{ cnpj: string; name: string; registrationNumber: string; action: string }> = [];
        const debugSamples: Array<{
          invoiceId: string;
          status: string;
          rawClientDoc?: string | null;
          normalizedClientDoc?: string | null;
          nameCandidates: string[];
          clientObjectKeys?: string[];
          invoiceTopKeys?: string[];
        }> = [];

        // Listar todas as faturas para extrair os números
        const statusFilters = [undefined, "pending", "paid", "overdue", "cancelled", "canceled"];

        for (const statusFilter of statusFilters) {
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            try {
              console.log(`[Lytex Extract] Buscando faturas: status=${statusFilter ?? "all"}, page=${page}`);
              const invoicesResponse = await listInvoices(page, 100, statusFilter);
              const invoices = extractList(invoicesResponse);
              console.log(`[Lytex Extract] Faturas retornadas: ${invoices.length}`);

              if (invoices.length === 0) {
                hasMore = false;
                break;
              }

              // Log estrutura da primeira fatura para debug
              if (page === 1 && invoices.length > 0) {
                const sample = invoices[0];
                console.log(`[Lytex Extract] Amostra fatura (status=${statusFilter ?? "all"}):`, JSON.stringify({
                  _id: sample._id,
                  clientKeys: sample.client ? Object.keys(sample.client) : null,
                  client: sample.client,
                  topLevelKeys: Object.keys(sample).slice(0, 15),
                }, null, 2));
              }

              for (const invoice of invoices) {
                if (!invoice?._id || seenInvoiceIds.has(invoice._id)) continue;
                seenInvoiceIds.add(invoice._id);

                // Extrair documento do cliente (CNPJ/CPF) - a Lytex pode variar o campo
                const rawClientDoc: string | null =
                  (invoice.client?.cpfCnpj as string | undefined) ??
                  ((invoice as any).client?.cnpj as string | undefined) ??
                  ((invoice as any).client?.document as string | undefined) ??
                  ((invoice as any).client?.taxId as string | undefined) ??
                  ((invoice as any).customer?.cpfCnpj as string | undefined) ??
                  ((invoice as any).customer?.document as string | undefined) ??
                  ((invoice as any).payer?.cpfCnpj as string | undefined) ??
                  ((invoice as any).payer?.document as string | undefined) ??
                  null;

                const normalizedClientDoc = rawClientDoc ? String(rawClientDoc).replace(/\D/g, "") : null;

                // Queremos casar com employers (PJ), então 14 dígitos
                const clientCnpj = normalizedClientDoc && normalizedClientDoc.length === 14 ? normalizedClientDoc : null;
                if (!clientCnpj) {
                  if (debugSamples.length < 10) {
                    debugSamples.push({
                      invoiceId: String(invoice._id || ""),
                      status: String(statusFilter ?? "all"),
                      rawClientDoc,
                      normalizedClientDoc,
                      nameCandidates: [],
                      clientObjectKeys: invoice.client ? Object.keys(invoice.client) : undefined,
                      invoiceTopKeys: invoice ? Object.keys(invoice) : undefined,
                    });
                  }
                  continue;
                }

                // Já temos um número para esse CNPJ?
                if (registrationMap.has(clientCnpj)) continue;

                // APENAS extrair do nome do cliente - formato "129 - NOME DA EMPRESA"
                // IMPORTANTE: O número nos itens (126 - TAXA NEGOCIAL) é código de produto, NÃO matrícula!

                const nameCandidates = [
                  invoice.client?.name,
                  (invoice as any).clientName,
                  (invoice as any).customerName,
                  (invoice as any).payer?.name,
                ].filter(Boolean) as string[];

                // Debug: se não encontrar em nenhuma, logar as primeiras faturas
                const tryExtractFromName = (raw: string) => raw.match(/^(\d{1,6})\s*[-–]\s*/);

                let extractedFrom: string | null = null;
                for (const candidate of nameCandidates) {
                  const m = tryExtractFromName(candidate);
                  if (m?.[1]) {
                    const formattedNumber = m[1].padStart(6, "0");
                    registrationMap.set(clientCnpj, formattedNumber);
                    extractedFrom = candidate;
                    const employer = employerByCnpj.get(clientCnpj);
                    console.log(`[Lytex] Extraído do nome do cliente: CNPJ ${clientCnpj} -> Matrícula ${formattedNumber} (${employer?.name || "não encontrado"}) de: "${candidate.substring(0, 80)}"`);
                    break;
                  }
                }

                if (!extractedFrom && seenInvoiceIds.size <= 10) {
                  console.log(`[Lytex] Sem matrícula no nome (invoice=${invoice._id}):`, {
                    client: invoice.client,
                    clientName: (invoice as any).clientName,
                    customerName: (invoice as any).customerName,
                    payerName: (invoice as any).payer?.name,
                  });
                }

                // NÃO extrair dos itens - os números lá são códigos de produto/taxa, não matrículas
              }

              page++;
              if (invoices.length < 100) hasMore = false;
            } catch (e) {
              console.error(`[Lytex] Erro ao listar faturas (status=${statusFilter}, page=${page}):`, e);
              hasMore = false;
            }
          }
        }

        console.log(`[Lytex] Total de matrículas extraídas: ${registrationMap.size}`);

        // Atualizar as empresas no banco
        let updated = 0;
        let skipped = 0;
        let notFound = 0;

        for (const [cnpj, registrationNumber] of registrationMap.entries()) {
          const employer = employerByCnpj.get(cnpj);
          
          if (!employer) {
            notFound++;
            extractedDetails.push({
              cnpj,
              name: "Empresa não encontrada",
              registrationNumber,
              action: "not_found",
            });
            continue;
          }

          // Verificar se já tem a MESMA matrícula (não precisa atualizar)
          if (employer.registration_number === registrationNumber) {
            skipped++;
            extractedDetails.push({
              cnpj,
              name: employer.name,
              registrationNumber,
              action: "skipped",
            });
            continue;
          }

          // Atualizar a matrícula
          const { error: updateError } = await supabase
            .from("employers")
            .update({ registration_number: registrationNumber })
            .eq("id", employer.id);

          if (updateError) {
            console.error(`[Lytex] Erro ao atualizar matrícula para ${cnpj}:`, updateError);
            extractedDetails.push({
              cnpj,
              name: employer.name,
              registrationNumber,
              action: "error",
            });
          } else {
            updated++;
            extractedDetails.push({
              cnpj,
              name: employer.name,
              registrationNumber,
              action: "updated",
            });
          }
        }

        console.log(`[Lytex] Matrículas atualizadas: ${updated}, puladas: ${skipped}, não encontradas: ${notFound}`);

        result = {
          success: true,
          totalExtracted: registrationMap.size,
          updated,
          skipped,
          notFound,
          details: extractedDetails,
          // Se não encontrou nenhuma matrícula, devolvemos amostras para diagnóstico
          debugSamples: registrationMap.size === 0 ? debugSamples : undefined,
        };
        break;
      }

      case "list_lytex_clients": {
        // Listar clientes diretamente da Lytex
        const page = params.page || 1;
        const limit = params.limit || 100;
        result = await listClients(page, limit);
        break;
      }

      case "list_lytex_invoices": {
        // Listar faturas diretamente da Lytex
        const page = params.page || 1;
        const limit = params.limit || 100;
        result = await listInvoices(page, limit, params.status);
        break;
      }

      case "fix_contribution_types": {
        // Corrigir tipos de contribuição existentes baseado no código base do campo "Pedido" das faturas Lytex
        // Ex: "124 - MENSALIDADE SINDICAL REFERENTE AGOSTO 2024" -> vincula ao tipo "124 - MENSALIDADE SINDICAL"
        console.log("[Lytex] Iniciando correção de tipos de contribuição (vinculação aos tipos base)...");

        // Carregar todos os tipos de contribuição
        const { data: allContribTypes } = await supabase
          .from("contribution_types")
          .select("id, name")
          .eq("clinic_id", params.clinicId);

        // Mapa por código base (124, 125, 126) para vincular ao tipo base correto
        const contribTypeByCode = new Map<string, string>();
        const contribTypeByName = new Map<string, string>();
        
        for (const ct of allContribTypes || []) {
          const nameUpper = ct.name.trim().toUpperCase();
          contribTypeByName.set(nameUpper, ct.id);
          
          // Extrair código base do nome do tipo (ex: "124 - MENSALIDADE SINDICAL" -> "124")
          const codeMatch = ct.name.match(/^(\d{3})\s*-/);
          if (codeMatch) {
            contribTypeByCode.set(codeMatch[1], ct.id);
          }
        }

        // Função para extrair código base do campo "Pedido" da Lytex
        const extractBaseCode = (orderName: string): string | null => {
          const match = orderName.match(/^(\d{3})\s*-/);
          return match ? match[1] : null;
        };

        // Tipo padrão (fallback)
        const defaultTypeId = contribTypeByName.get("MENSALIDADE") || null;

        // Buscar contribuições com lytex_invoice_id
        const { data: contributions, error: contribErr } = await supabase
          .from("employer_contributions")
          .select("id, lytex_invoice_id, contribution_type_id")
          .eq("clinic_id", params.clinicId)
          .not("lytex_invoice_id", "is", null);

        if (contribErr) {
          throw new Error(`Erro ao buscar contribuições: ${contribErr.message}`);
        }

        if (!contributions || contributions.length === 0) {
          result = { success: true, updated: 0, message: "Nenhuma contribuição com boleto Lytex encontrada" };
          break;
        }

        console.log(`[Lytex] ${contributions.length} contribuições a verificar`);

        const token = await getAccessToken();
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        const details: { invoiceId: string; orderName: string; baseCode: string | null; action: string }[] = [];

        // Processar em lotes de 10
        const batchSize = 10;
        for (let i = 0; i < contributions.length; i += batchSize) {
          const batch = contributions.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (contrib) => {
            try {
              const invoice = await getInvoiceWithToken(contrib.lytex_invoice_id!, token);
              const orderName = invoice?.items?.[0]?.name?.trim() || "";

              if (!orderName) {
                skipped++;
                details.push({ invoiceId: contrib.lytex_invoice_id!, orderName: "(vazio)", baseCode: null, action: "skipped" });
                return;
              }

              // Extrair código base (124, 125, 126)
              const baseCode = extractBaseCode(orderName.toUpperCase());
              
              // Primeiro tenta pelo código base (vincula ao tipo existente)
              let targetTypeId = baseCode ? contribTypeByCode.get(baseCode) : null;
              
              // Fallback para tipo padrão (não cria novos tipos)
              if (!targetTypeId) {
                targetTypeId = defaultTypeId;
              }

              if (!targetTypeId) {
                skipped++;
                details.push({ invoiceId: contrib.lytex_invoice_id!, orderName, baseCode, action: "no_type" });
                return;
              }

              // Se já está com o tipo correto, pular
              if (contrib.contribution_type_id === targetTypeId) {
                skipped++;
                details.push({ invoiceId: contrib.lytex_invoice_id!, orderName, baseCode, action: "correct" });
                return;
              }

              // Atualizar tipo
              const { error: updateErr } = await supabase
                .from("employer_contributions")
                .update({ contribution_type_id: targetTypeId })
                .eq("id", contrib.id);

              if (updateErr) {
                errors++;
                console.error(`[Lytex] Erro ao atualizar contrib ${contrib.id}:`, updateErr);
                details.push({ invoiceId: contrib.lytex_invoice_id!, orderName, baseCode, action: "error" });
              } else {
                updated++;
                details.push({ invoiceId: contrib.lytex_invoice_id!, orderName, baseCode, action: "updated" });
              }
            } catch (e) {
              errors++;
              details.push({ invoiceId: contrib.lytex_invoice_id!, orderName: "(erro)", baseCode: null, action: "error" });
            }
          }));
        }

        console.log(`[Lytex] Correção concluída: ${updated} atualizadas, ${skipped} puladas, ${errors} erros`);

        result = {
          success: true,
          total: contributions.length,
          updated,
          skipped,
          errors,
          details: details.slice(0, 100), // Limitar detalhes para evitar payload grande
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Lytex] Erro:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
