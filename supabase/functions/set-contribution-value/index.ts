import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatCNPJ = (cnpj: string) => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return cnpj;
};

const formatDate = (dateStr: string) => {
  const dateOnly = (dateStr || "").slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

async function sendManagerNotification(params: {
  managerEmail: string;
  clinicName: string;
  employerName: string;
  employerCnpj: string;
  contributionType: string;
  competenceMonth: number;
  competenceYear: number;
  dueDate: string;
  value: number;
  invoiceUrl: string;
}): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM");

  if (!resendApiKey || !resendFrom) {
    console.log("[SetValue] Notificacao de gestor ignorada: RESEND nao configurado");
    return;
  }

  const competence = `${MONTHS[params.competenceMonth - 1]}/${params.competenceYear}`;
  
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
            Novo Valor de Contribuicao Informado
          </h1>
          <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 14px;">
            ${params.clinicName}
          </p>
        </div>
        
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Uma empresa informou o valor de uma contribuicao atraves do link publico:
          </p>
          
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; background: #f9fafb;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 140px;">Empresa:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${params.employerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">CNPJ:</td>
                <td style="padding: 8px 0; color: #1f2937;">${formatCNPJ(params.employerCnpj)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Tipo:</td>
                <td style="padding: 8px 0; color: #1f2937;">${params.contributionType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Competencia:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${competence}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Vencimento:</td>
                <td style="padding: 8px 0; color: #1f2937;">${formatDate(params.dueDate)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Valor Informado:</td>
                <td style="padding: 8px 0; color: #059669; font-weight: 600; font-size: 18px;">${formatCurrency(params.value)}</td>
              </tr>
            </table>
          </div>
          
          <div style="margin-top: 20px; text-align: center;">
            <a href="${params.invoiceUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
              Ver Boleto Gerado
            </a>
          </div>
        </div>
        
        <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            Notificacao automatica do sistema de contribuicoes
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const subject = `Valor Informado - ${params.contributionType} ${competence} - ${params.employerName}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [params.managerEmail],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[SetValue] Erro ao enviar notificacao ao gestor:", errorData);
    } else {
      console.log("[SetValue] Notificacao enviada ao gestor:", params.managerEmail);
    }
  } catch (error) {
    console.error("[SetValue] Erro ao enviar notificacao ao gestor:", error);
  }
}

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

    // Buscar contribuição com dados da clínica para notificação
    const { data: contribution, error: contribError } = await supabase
      .from("employer_contributions")
      .select(`
        *,
        employer:employers(id, name, cnpj, email, phone, clinic_id),
        contribution_type:contribution_types(name, clinic_id)
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

    // Buscar dados da clínica para notificação
    const clinicId = contribution.employer?.clinic_id || contribution.contribution_type?.clinic_id || contribution.clinic_id;
    let clinicData: { name: string; email: string | null } | null = null;
    
    if (clinicId) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name, email")
        .eq("id", clinicId)
        .single();
      clinicData = clinic;
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

      // Enviar notificação ao gestor da clínica via email (apenas para links públicos)
      if (portal_type === "public_token" && clinicData?.email) {
        try {
          await sendManagerNotification({
            managerEmail: clinicData.email,
            clinicName: clinicData.name,
            employerName: contribution.employer?.name || "Empresa",
            employerCnpj: contribution.employer?.cnpj || "",
            contributionType: contribution.contribution_type?.name || "Contribuição",
            competenceMonth: contribution.competence_month,
            competenceYear: contribution.competence_year,
            dueDate: contribution.due_date,
            value: valueInCents,
            invoiceUrl: invoice.invoiceUrl,
          });
        } catch (notifError) {
          console.error("[SetValue] Erro ao enviar notificacao (nao critico):", notifError);
          // Não bloqueia o fluxo principal
        }
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
