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

    const body = await req.json();
    const { 
      contribution_id, 
      contributionId, // alias 
      new_due_date, 
      newDueDate, // alias
      portal_type, 
      contributionType, // 'employer' ou 'member'
      portal_id,
      requestedBy 
    } = body;

    const actualContributionId = contribution_id || contributionId;
    const actualNewDueDate = new_due_date || newDueDate;
    const actualContributionType = contributionType || "employer";

    if (!actualContributionId || !actualNewDueDate) {
      return new Response(
        JSON.stringify({ error: "ID da contribuição e nova data de vencimento são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar que a nova data é futura
    const [year, month, day] = actualNewDueDate.split("-").map(Number);
    const newDueDateObj = new Date(year, month - 1, day, 12, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDueDateObj < today) {
      return new Response(
        JSON.stringify({ error: "A nova data de vencimento deve ser futura" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar tabela baseado no tipo
    const contributionTable = actualContributionType === "member" 
      ? "member_contributions" 
      : "employer_contributions";
    const entityTable = actualContributionType === "member" ? "members" : "employers";
    const entityField = actualContributionType === "member" ? "member" : "employer";
    const entityIdField = actualContributionType === "member" ? "member_id" : "employer_id";

    // Buscar a contribuição
    const { data: contribution, error: contribError } = await supabase
      .from(contributionTable)
      .select(`
        *,
        ${entityField}:${entityTable}(id, name, ${actualContributionType === "member" ? "cpf" : "cnpj"}, email, phone),
        contribution_type:contribution_types(name)
      `)
      .eq("id", actualContributionId)
      .single();

    if (contribError || !contribution) {
      console.error("[Reissue] Contribuição não encontrada:", contribError);
      return new Response(
        JSON.stringify({ error: "Contribuição não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const entity = contribution[entityField];
    const entityIdentifier = actualContributionType === "member" ? entity.cpf : entity.cnpj;

    // Validações para portais
    const isFromPortal = portal_type || requestedBy === "portal";
    
    if (isFromPortal) {
      if (contribution.status === 'pending') {
        return new Response(
          JSON.stringify({ 
            error: "2ª via só disponível para boletos vencidos. Aguarde o vencimento." 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dueDate = new Date(contribution.due_date);
      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 90) {
        return new Response(
          JSON.stringify({ 
            error: "Boletos com mais de 90 dias de atraso só podem ser alterados pelo gestor." 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentReissueCount = contribution.portal_reissue_count || 0;
      if (currentReissueCount >= 2) {
        return new Response(
          JSON.stringify({ 
            error: "Limite de 2 reemissões atingido. Contate o gestor." 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Cancelar boleto antigo na Lytex
    const lytexInvoiceId = contribution.lytex_invoice_id;
    if (lytexInvoiceId) {
      try {
        await cancelInvoice(lytexInvoiceId, contribution.due_date, contribution.value);
      } catch (err) {
        console.error("[Reissue] Erro ao cancelar boleto antigo:", err);
      }
    }

    // Atualizar contribuição antiga para cancelada
    await supabase
      .from(contributionTable)
      .update({ status: "cancelled" })
      .eq("id", actualContributionId);

    // Calcular novo contador de reemissões
    const newReissueCount = isFromPortal 
      ? (contribution.portal_reissue_count || 0) + 1 
      : contribution.portal_reissue_count || 0;

    // Criar nova contribuição
    const newContribData: Record<string, any> = {
      [entityIdField]: contribution[entityIdField],
      clinic_id: contribution.clinic_id,
      contribution_type_id: contribution.contribution_type_id,
      competence_month: contribution.competence_month,
      competence_year: contribution.competence_year,
      value: contribution.value,
      due_date: actualNewDueDate,
      status: "pending",
      notes: `2ª via gerada em ${new Date().toLocaleDateString("pt-BR")}. Original: ${contribution.id}`,
      portal_reissue_count: newReissueCount,
    };

    const { data: newContribution, error: newContribError } = await supabase
      .from(contributionTable)
      .insert(newContribData)
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
          cnpj: entityIdentifier,
          name: entity.name,
          email: entity.email,
          phone: entity.phone,
        },
        value: contribution.value,
        dueDate: actualNewDueDate,
        description,
        contributionId: newContribution.id,
      });

      // Atualizar nova contribuição com dados do boleto
      await supabase
        .from(contributionTable)
        .update({
          lytex_invoice_id: invoice._id,
          lytex_invoice_url: invoice.invoiceUrl,
          lytex_boleto_barcode: invoice.boleto?.barCode || null,
          lytex_boleto_digitable_line: invoice.boleto?.digitableLine || null,
          lytex_pix_code: invoice.pix?.code || null,
          lytex_pix_qrcode: invoice.pix?.qrCode || null,
        })
        .eq("id", newContribution.id);

      // Registrar log se veio do portal
      if (actualContributionType === "member" && isFromPortal) {
        await supabase.from("member_portal_logs").insert({
          member_id: contribution.member_id,
          action: "generate_reissue",
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { 
            original_contribution_id: actualContributionId,
            new_contribution_id: newContribution.id,
            new_due_date: actualNewDueDate,
          },
        });
      } else if (portal_id) {
        const logTable = portal_type === "accounting_office" 
          ? "accounting_office_portal_logs" 
          : "employer_portal_logs";
        const logData = portal_type === "accounting_office"
          ? { accounting_office_id: portal_id, action: "generate_reissue" }
          : { employer_id: portal_id, action: "generate_reissue" };

        await supabase.from(logTable).insert({
          ...logData,
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { 
            original_contribution_id: actualContributionId,
            new_contribution_id: newContribution.id,
            new_due_date: actualNewDueDate,
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
      
      return new Response(
        JSON.stringify({
          success: true,
          new_contribution_id: newContribution.id,
          lytex_invoice_url: null,
          message: "Contribuição criada, mas houve erro ao gerar boleto.",
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
