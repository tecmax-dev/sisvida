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

  // Adicionar endereço se disponível
  if (params.employer.address) {
    invoicePayload.client.address = {
      street: params.employer.address.street || "",
      number: params.employer.address.number || "S/N",
      complement: params.employer.address.complement || "",
      zone: params.employer.address.zone || "",
      city: params.employer.address.city || "",
      state: params.employer.address.state || "",
      zip: params.employer.address.zip?.replace(/\D/g, "") || "",
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

async function cancelInvoice(invoiceId: string): Promise<any> {
  const token = await getAccessToken();

  const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}/cancel`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lytex] Erro ao cancelar cobrança:", errorText);
    throw new Error(`Erro ao cancelar cobrança: ${response.status}`);
  }

  return response.json();
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

        const { error: updateError } = await supabase
          .from("employer_contributions")
          .update({
            status: newStatus,
            paid_at: invoice.paidAt || null,
            paid_value: invoice.payedValue || null,
            payment_method: invoice.paymentMethod || null,
          })
          .eq("id", params.contributionId);

        if (updateError) {
          console.error("[Lytex] Erro ao atualizar status:", updateError);
        }

        result = { success: true, status: newStatus, invoice };
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
