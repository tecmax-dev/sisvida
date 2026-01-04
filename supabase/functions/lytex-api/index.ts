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
}

async function updateInvoice(params: UpdateInvoiceRequest): Promise<any> {
  const token = await getAccessToken();

  const updatePayload: any = {};
  
  if (params.value !== undefined) {
    updatePayload.items = [{ name: "Contribuição", quantity: 1, value: params.value }];
  }
  
  if (params.dueDate) {
    updatePayload.dueDate = params.dueDate;
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

  const responseData = await response.json();

  if (!response.ok) {
    console.error("[Lytex] Erro ao atualizar cobrança:", JSON.stringify(responseData));
    throw new Error(responseData.message || `Erro ao atualizar cobrança: ${response.status}`);
  }

  console.log("[Lytex] Cobrança atualizada com sucesso");
  return responseData;
}

async function cancelInvoice(invoiceId: string): Promise<any> {
  const token = await getAccessToken();

  // A API Lytex usa POST /invoices/{id}/cancel para cancelar cobranças
  console.log(`[Lytex] Cancelando cobrança ${invoiceId} via POST /cancel...`);
  
  let response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  // Se POST /cancel falhar com 404, tentar PATCH com status
  if (!response.ok && response.status === 404) {
    console.log("[Lytex] POST /cancel não encontrado, tentando PATCH com status...");
    response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
  }

  // Se PATCH falhar, tentar DELETE
  if (!response.ok && (response.status === 404 || response.status === 405)) {
    console.log("[Lytex] PATCH não suportado, tentando DELETE...");
    response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lytex] Erro ao cancelar cobrança:", errorText);
    throw new Error(`Erro ao cancelar cobrança: ${response.status}`);
  }

  console.log("[Lytex] Cobrança cancelada com sucesso");
  
  // Alguns endpoints retornam 204 No Content
  const text = await response.text();
  return text ? JSON.parse(text) : { success: true };
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

        await cancelInvoice(params.invoiceId);

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
