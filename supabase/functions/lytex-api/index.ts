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

async function createInvoice(params: CreateInvoiceRequest): Promise<any> {
  const token = await getAccessToken();

  // Formatar CPF/CNPJ (remover caracteres especiais)
  const cleanCnpj = params.employer.cnpj.replace(/\D/g, "");

  const invoicePayload: any = {
    client: {
      type: cleanCnpj.length === 14 ? "pj" : "pf",
      name: params.employer.name,
      cpfCnpj: cleanCnpj,
      email: params.employer.email || undefined,
      cellphone: params.employer.phone?.replace(/\D/g, "") || undefined,
    },
    items: [
      {
        name: params.description,
        quantity: 1,
        value: params.value,
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

  const responseData = await response.json();

  if (!response.ok) {
    console.error("[Lytex] Erro ao criar cobrança:", JSON.stringify(responseData));
    throw new Error(responseData.message || `Erro ao criar cobrança: ${response.status}`);
  }

  console.log("[Lytex] Cobrança criada com sucesso:", responseData._id);
  return responseData;
}

async function getInvoice(invoiceId: string): Promise<any> {
  const token = await getAccessToken();

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
  const responseData = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    console.error("[Lytex] Erro ao atualizar cobrança:", JSON.stringify(responseData));
    throw new Error(responseData.message || `Erro ao atualizar cobrança: ${response.status}`);
  }

  console.log("[Lytex] Cobrança atualizada com sucesso");
  return responseData;
}

async function cancelInvoice(params: { invoiceId: string; dueDate: string; value?: number }): Promise<any> {
  console.log(`[Lytex] Cancelando cobrança ${params.invoiceId} via update (status=cancelled)...`);

  // A Lytex exige dueDate em validações no PUT; então cancelamos via update
  return await updateInvoice({
    invoiceId: params.invoiceId,
    dueDate: params.dueDate,
    value: params.value,
    status: "cancelled",
  });
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
      case "create_invoice": {
        // Criar cobrança na Lytex
        const invoice = await createInvoice(params as CreateInvoiceRequest);

        // Atualizar contribuição no banco com os dados da Lytex
        const { error: updateError } = await supabase
          .from("employer_contributions")
          .update({
            lytex_invoice_id: invoice._id,
            lytex_invoice_url: invoice.invoiceUrl,
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

        result = { success: true, invoice };
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
            paid_value: invoice.payedValue || null,
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
        if (!params.clinicId) {
          throw new Error("clinicId é obrigatório");
        }

        const { data: pendingContributions, error: listError } = await supabase
          .from("employer_contributions")
          .select("id, lytex_invoice_id, status")
          .eq("clinic_id", params.clinicId)
          .not("lytex_invoice_id", "is", null)
          .in("status", ["pending", "overdue", "processing"]);

        if (listError) {
          throw new Error("Erro ao buscar contribuições pendentes");
        }

        console.log(`[Lytex] Sincronizando ${pendingContributions?.length || 0} contribuições...`);

        const results: Array<{ id: string; status: string; synced: boolean; error?: string }> = [];

        for (const contrib of pendingContributions || []) {
          try {
            const invoice = await getInvoice(contrib.lytex_invoice_id);

            let newStatus = "pending";
            if (invoice.status === "paid") {
              newStatus = "paid";
            } else if (invoice.status === "canceled" || invoice.status === "cancelled") {
              newStatus = "cancelled";
            } else if (invoice.status === "overdue" || (invoice.dueDate && new Date(invoice.dueDate) < new Date())) {
              newStatus = "overdue";
            }

            if (newStatus !== contrib.status) {
              const { error: updateErr } = await supabase
                .from("employer_contributions")
                .update({
                  status: newStatus,
                  paid_at: invoice.paidAt || null,
                  paid_value: invoice.payedValue || null,
                  payment_method: invoice.paymentMethod || null,
                })
                .eq("id", contrib.id);

              if (updateErr) {
                results.push({ id: contrib.id, status: newStatus, synced: false, error: updateErr.message });
              } else {
                results.push({ id: contrib.id, status: newStatus, synced: true });
              }
            } else {
              results.push({ id: contrib.id, status: newStatus, synced: true });
            }
          } catch (e: any) {
            console.error(`[Lytex] Erro ao sincronizar ${contrib.id}:`, e.message);
            results.push({ id: contrib.id, status: contrib.status, synced: false, error: e.message });
          }
        }

        const syncedCount = results.filter(r => r.synced).length;
        const updatedCount = results.filter(r => r.synced && r.status !== "pending").length;
        console.log(`[Lytex] Sincronização concluída: ${syncedCount}/${results.length} sucesso, ${updatedCount} atualizados`);

        result = { success: true, total: results.length, synced: syncedCount, updated: updatedCount, details: results };
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

        // Criar log de sincronização
        const { data: syncLog, error: logError } = await supabase
          .from("lytex_sync_logs")
          .insert({
            clinic_id: params.clinicId,
            sync_type: "full",
            status: "running",
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
            }

            page++;
            if (clients.length < 100) hasMore = false;
          }

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

          // Buscar ou criar tipo de contribuição padrão (1 vez)
          let { data: contribType } = await supabase
            .from("contribution_types")
            .select("id")
            .eq("clinic_id", params.clinicId)
            .eq("name", "Mensalidade")
            .maybeSingle();

          if (!contribType) {
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
            contribType = newType;
          }

          if (!contribType?.id) {
            throw new Error("Tipo de contribuição padrão (Mensalidade) não disponível");
          }
          const contributionTypeId = contribType.id;

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

                const competenceMonth = dueDate.getMonth() + 1;
                const competenceYear = dueDate.getFullYear();

                let status = "pending";
                if (invoice.status === "paid") status = "paid";
                else if (invoice.status === "canceled" || invoice.status === "cancelled") status = "cancelled";
                else if (invoice.status === "overdue") status = "overdue";
                else if (invoice.status === "processing") status = "processing";

                const value = invoice.items?.reduce((sum: number, item: any) => sum + (item.value || 0), 0) || 0;

                // A Lytex retorna linkCheckout (página de pagamento) ou linkBoleto (PDF do boleto)
                const invoiceUrl = invoice.linkCheckout || invoice.linkBoleto || invoice.invoiceUrl || null;

                // Log para debug (apenas primeiras faturas)
                if (page === 1 && invoices.indexOf(invoice) < 2) {
                  console.log(`[Lytex] Invoice ${invoice._id}: linkCheckout=${invoice.linkCheckout}, linkBoleto=${invoice.linkBoleto}`);
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
                  paid_value: invoice.payedValue || null,
                  payment_method: invoice.paymentMethod || null,
                };

                const key = `${employerId}|${competenceMonth}|${competenceYear}`;
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
                      onConflict: "employer_id,contribution_type_id,competence_month,competence_year",
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
                  }
                }
              }

              page++;
              if (invoices.length < 100) hasMore = false;
            }
          }

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
                details: { errors },
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
            details: {
              clients: clientDetails,
              invoices: invoiceDetails,
            },
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
