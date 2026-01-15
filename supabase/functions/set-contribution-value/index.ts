import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache para o token de acesso Lytex
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

const LYTEX_API_URL = Deno.env.get("LYTEX_API_URL") || "https://api-pay.lytex.com.br/v2";

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  
  if (accessToken && tokenExpiresAt > now + 300000) {
    return accessToken;
  }

  const clientId = Deno.env.get("LYTEX_CLIENT_ID");
  const clientSecret = Deno.env.get("LYTEX_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Lytex não configuradas");
  }

  console.log("[SetValue] Obtendo access token Lytex...");

  const response = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[SetValue] Erro ao autenticar Lytex:", errorText);
    throw new Error(`Erro de autenticação Lytex: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.accessToken;
  tokenExpiresAt = now + (data.expiresIn * 1000);

  console.log("[SetValue] Token Lytex obtido com sucesso");
  return accessToken!;
}

async function createInvoice(params: {
  employer: { cnpj: string; name: string; email?: string; phone?: string };
  value: number;
  dueDate: string;
  description: string;
  contributionId: string;
}): Promise<any> {
  const token = await getAccessToken();

  const cleanCnpj = params.employer.cnpj.replace(/\D/g, "");

  const invoicePayload = {
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
      pix: { enable: true },
      boleto: { enable: true },
      creditCard: { enable: false },
    },
    referenceId: params.contributionId,
  };

  console.log("[SetValue] Criando cobrança Lytex:", JSON.stringify(invoicePayload, null, 2));

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
    console.error("[SetValue] Erro ao criar cobrança:", JSON.stringify(responseData));
    throw new Error(responseData.message || `Erro ao criar cobrança: ${response.status}`);
  }

  // Extrair URL da fatura - Lytex pode retornar em diferentes campos
  const invoiceUrl = responseData.linkCheckout || responseData.linkBoleto || responseData.invoiceUrl || null;

  console.log("[SetValue] Cobrança criada:", responseData._id, "URL:", invoiceUrl);
  
  return {
    ...responseData,
    invoiceUrl,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contribution_id, value, portal_type, portal_id } = await req.json();

    if (!contribution_id || value === undefined || value === null) {
      return new Response(
        JSON.stringify({ error: "contribution_id e value são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valueInCents = Math.round(Number(value));
    if (isNaN(valueInCents) || valueInCents <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor deve ser maior que zero" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar contribuição
    const { data: contribution, error: contribError } = await supabase
      .from("employer_contributions")
      .select(`
        *,
        employer:employers(id, name, cnpj, email, phone),
        contribution_type:contribution_types(name)
      `)
      .eq("id", contribution_id)
      .single();

    if (contribError || !contribution) {
      console.error("[SetValue] Contribuição não encontrada:", contribError);
      return new Response(
        JSON.stringify({ error: "Contribuição não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se status permite alteração
    if (contribution.status !== "awaiting_value") {
      return new Response(
        JSON.stringify({ error: "Apenas contribuições aguardando valor podem ser alteradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar permissões do portal
    if (portal_type === "public_token" && portal_id) {
      // Acesso via token público - validar se token corresponde
      if (contribution.public_access_token !== portal_id) {
        return new Response(
          JSON.stringify({ error: "Token de acesso inválido" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (portal_type === "employer" && portal_id) {
      if (contribution.employer_id !== portal_id) {
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para acessar esta contribuição" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (portal_type === "accounting_office" && portal_id) {
      const { data: link } = await supabase
        .from("accounting_office_employers")
        .select("id")
        .eq("accounting_office_id", portal_id)
        .eq("employer_id", contribution.employer_id)
        .single();

      if (!link) {
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para acessar esta contribuição" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Gerar boleto na Lytex
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const typeName = contribution.contribution_type?.name || "Contribuição";
    const description = `${typeName} - ${monthNames[contribution.competence_month - 1]}/${contribution.competence_year}`;

    try {
      const invoice = await createInvoice({
        employer: {
          cnpj: contribution.employer.cnpj,
          name: contribution.employer.name,
          email: contribution.employer.email,
          phone: contribution.employer.phone,
        },
        value: valueInCents,
        dueDate: contribution.due_date,
        description,
        contributionId: contribution.id,
      });

      // Atualizar contribuição com valor e dados do boleto
      const { error: updateError } = await supabase
        .from("employer_contributions")
        .update({
          value: valueInCents,
          status: "pending",
          lytex_invoice_id: invoice._id,
          lytex_invoice_url: invoice.invoiceUrl,
          lytex_boleto_barcode: invoice.boleto?.barCode || null,
          lytex_boleto_digitable_line: invoice.boleto?.digitableLine || null,
          lytex_pix_code: invoice.pix?.code || null,
          lytex_pix_qrcode: invoice.pix?.qrCode || null,
        })
        .eq("id", contribution_id);

      if (updateError) {
        console.error("[SetValue] Erro ao atualizar contribuição:", updateError);
        throw new Error("Erro ao salvar dados");
      }

      // Registrar log se for portal
      if (portal_type && portal_id) {
        const logTable = portal_type === "accounting_office" 
          ? "accounting_office_portal_logs" 
          : "employer_portal_logs";
        const logData = portal_type === "accounting_office"
          ? { accounting_office_id: portal_id, action: "set_value" }
          : { employer_id: portal_id, action: "set_value" };

        await supabase.from(logTable).insert({
          ...logData,
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { contribution_id, value: valueInCents },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          lytex_invoice_url: invoice.invoiceUrl,
          message: "Valor definido e boleto gerado com sucesso!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (lytexError: any) {
      console.error("[SetValue] Erro Lytex:", lytexError);
      return new Response(
        JSON.stringify({ error: lytexError.message || "Erro ao gerar boleto" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[SetValue] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
