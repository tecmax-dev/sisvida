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

  console.log("[Reissue] Obtendo novo access token Lytex...");

  const response = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Reissue] Erro ao autenticar Lytex:", errorText);
    throw new Error(`Erro de autenticação Lytex: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.accessToken;
  tokenExpiresAt = now + (data.expiresIn * 1000);

  console.log("[Reissue] Token Lytex obtido com sucesso");
  return accessToken!;
}

async function cancelInvoice(invoiceId: string, dueDate: string, value?: number): Promise<void> {
  const token = await getAccessToken();

  const updatePayload: any = {
    dueDate,
    status: "cancelled",
  };

  if (value !== undefined) {
    updatePayload.items = [{ name: "Contribuição", quantity: 1, value }];
  }

  console.log("[Reissue] Cancelando cobrança antiga:", invoiceId);

  const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Reissue] Erro ao cancelar cobrança:", errorText);
    // Não lançar erro, apenas logar - a nova cobrança ainda deve ser criada
  }
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

  console.log("[Reissue] Criando nova cobrança:", JSON.stringify(invoicePayload, null, 2));

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
    console.error("[Reissue] Erro ao criar cobrança:", JSON.stringify(responseData));
    throw new Error(responseData.message || `Erro ao criar cobrança: ${response.status}`);
  }

  // Extrair URL da fatura - Lytex pode retornar em diferentes campos
  const invoiceUrl = responseData.linkCheckout || responseData.linkBoleto || responseData.invoiceUrl || null;

  console.log("[Reissue] Cobrança criada com sucesso:", responseData._id, "URL:", invoiceUrl);
  
  return {
    ...responseData,
    invoiceUrl, // Normaliza o campo para uso consistente
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

    const { contribution_id, new_due_date, portal_type, portal_id } = await req.json();

    if (!contribution_id || !new_due_date) {
      return new Response(
        JSON.stringify({ error: "ID da contribuição e nova data de vencimento são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar que a nova data é futura
    // Usar parsing manual para evitar problemas de timezone
    const [year, month, day] = new_due_date.split("-").map(Number);
    const newDueDate = new Date(year, month - 1, day, 12, 0, 0); // meio-dia para evitar shift de timezone
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDueDate < today) {
      return new Response(
        JSON.stringify({ error: "A nova data de vencimento deve ser futura" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar a contribuição com dados da empresa
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
      console.error("[Reissue] Contribuição não encontrada:", contribError);
      return new Response(
        JSON.stringify({ error: "Contribuição não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se boleto está vencido há mais de 90 dias - apenas gestor pode alterar
    if (portal_type && portal_id) {
      const dueDate = new Date(contribution.due_date);
      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 90) {
        console.log(`[Reissue] Boleto vencido há ${daysDiff} dias - bloqueado para portal`);
        return new Response(
          JSON.stringify({ 
            error: "Boletos com mais de 90 dias de atraso só podem ser alterados pelo gestor. Entre em contato com o sindicato." 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar limite de reemissões via portal (máximo 2)
      const currentReissueCount = contribution.portal_reissue_count || 0;
      if (currentReissueCount >= 2) {
        console.log(`[Reissue] Limite de reemissões atingido: ${currentReissueCount}`);
        return new Response(
          JSON.stringify({ 
            error: "Limite de 2 reemissões atingido. Para novas solicitações, entre em contato com o gestor do sindicato." 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verificar se a contribuição pertence ao portal que está solicitando
    if (portal_type === "employer" && portal_id) {
      if (contribution.employer_id !== portal_id) {
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para acessar esta contribuição" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (portal_type === "accounting_office" && portal_id) {
      // Verificar se a empresa está vinculada ao escritório
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

    // Cancelar boleto antigo na Lytex (se existir)
    if (contribution.lytex_invoice_id) {
      try {
        await cancelInvoice(
          contribution.lytex_invoice_id,
          contribution.due_date,
          contribution.value
        );
      } catch (err) {
        console.error("[Reissue] Erro ao cancelar boleto antigo (continuando):", err);
      }
    }

    // Atualizar status da contribuição antiga para cancelado
    await supabase
      .from("employer_contributions")
      .update({ status: "cancelled" })
      .eq("id", contribution_id);

    // Calcular novo contador de reemissões (incrementa apenas se veio de portal)
    const newReissueCount = portal_type && portal_id 
      ? (contribution.portal_reissue_count || 0) + 1 
      : contribution.portal_reissue_count || 0;

    // Criar nova contribuição com a nova data
    const { data: newContribution, error: newContribError } = await supabase
      .from("employer_contributions")
      .insert({
        employer_id: contribution.employer_id,
        clinic_id: contribution.clinic_id,
        contribution_type_id: contribution.contribution_type_id,
        competence_month: contribution.competence_month,
        competence_year: contribution.competence_year,
        value: contribution.value,
        due_date: new_due_date,
        status: "pending",
        notes: `2ª via gerada em ${new Date().toLocaleDateString("pt-BR")}. Original: ${contribution.id}`,
        portal_reissue_count: newReissueCount,
      })
      .select()
      .single();

    if (newContribError || !newContribution) {
      console.error("[Reissue] Erro ao criar nova contribuição:", newContribError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar nova contribuição" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar novo boleto na Lytex
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
        value: contribution.value,
        dueDate: new_due_date,
        description,
        contributionId: newContribution.id,
      });

      // Atualizar nova contribuição com dados do boleto
      await supabase
        .from("employer_contributions")
        .update({
          lytex_invoice_id: invoice._id,
          lytex_invoice_url: invoice.invoiceUrl,
          lytex_boleto_barcode: invoice.boleto?.barCode || null,
          lytex_boleto_digitable_line: invoice.boleto?.digitableLine || null,
          lytex_pix_code: invoice.pix?.code || null,
          lytex_pix_qrcode: invoice.pix?.qrCode || null,
        })
        .eq("id", newContribution.id);

      // Registrar log
      const logTable = portal_type === "accounting_office" 
        ? "accounting_office_portal_logs" 
        : "employer_portal_logs";
      const logData = portal_type === "accounting_office"
        ? { accounting_office_id: portal_id, action: "generate_reissue" }
        : { employer_id: portal_id, action: "generate_reissue" };

      if (portal_id) {
        await supabase.from(logTable).insert({
          ...logData,
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { 
            original_contribution_id: contribution_id,
            new_contribution_id: newContribution.id,
            new_due_date,
          },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          new_contribution_id: newContribution.id,
          lytex_invoice_url: invoice.invoiceUrl,
          message: "Segunda via gerada com sucesso!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (lytexError: any) {
      console.error("[Reissue] Erro ao criar boleto Lytex:", lytexError);
      
      // Mesmo sem boleto Lytex, a contribuição foi criada
      return new Response(
        JSON.stringify({
          success: true,
          new_contribution_id: newContribution.id,
          lytex_invoice_url: null,
          message: "Contribuição criada, mas houve erro ao gerar boleto. Tente novamente mais tarde.",
          warning: lytexError.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[Reissue] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
