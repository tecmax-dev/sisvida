import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const LYTEX_API_URL =
  Deno.env.get("LYTEX_API_URL") || "https://api-pay.lytex.com.br/v2";

let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessToken && tokenExpiresAt > now + 300000) return accessToken;

  const clientId = Deno.env.get("LYTEX_CLIENT_ID");
  const clientSecret = Deno.env.get("LYTEX_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Lytex não configuradas");
  }

  const response = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ChangeValue] Erro ao autenticar Lytex:", errorText);
    throw new Error(`Erro de autenticação Lytex: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.accessToken;
  tokenExpiresAt = now + data.expiresIn * 1000;
  return accessToken!;
}

async function cancelInvoice(invoiceId: string) {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!response.ok) {
      const txt = await response.text();
      console.error("[ChangeValue] Erro ao cancelar boleto antigo:", txt);
    }
  } catch (e) {
    console.error("[ChangeValue] Falha ao cancelar boleto antigo:", e);
  }
}

async function createInvoice(params: {
  employer: { cnpj: string; name: string; email?: string; phone?: string };
  value: number;
  dueDate: string;
  description: string;
  contributionId: string;
}) {
  const token = await getAccessToken();
  const cleanCnpj = params.employer.cnpj.replace(/\D/g, "");

  const payload = {
    client: {
      type: cleanCnpj.length === 14 ? "pj" : "pf",
      name: params.employer.name,
      cpfCnpj: cleanCnpj,
      email: params.employer.email || undefined,
      cellphone: params.employer.phone?.replace(/\D/g, "") || undefined,
    },
    items: [
      { name: params.description, quantity: 1, value: params.value },
    ],
    dueDate: params.dueDate,
    paymentMethods: {
      pix: { enable: true },
      boleto: { enable: true },
      creditCard: { enable: false },
    },
    referenceId: params.contributionId,
  };

  const response = await fetch(`${LYTEX_API_URL}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("[ChangeValue] Erro ao criar nova cobranca:", JSON.stringify(data));
    throw new Error(data.message || `Erro ao criar cobrança: ${response.status}`);
  }

  const invoiceUrl =
    data.linkCheckout || data.linkBoleto || data.invoiceUrl || null;
  return { ...data, invoiceUrl };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { contribution_id, value, portal_type, portal_id } = body || {};

    if (!contribution_id || value === undefined || value === null) {
      return new Response(
        JSON.stringify({ error: "contribution_id e value são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const valueInCents = Math.round(Number(value));
    if (isNaN(valueInCents) || valueInCents <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor deve ser maior que zero" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: contribution, error: contribError } = await supabase
      .from("employer_contributions")
      .select(`
        *,
        employer:employers(id, name, cnpj, email, phone, clinic_id),
        contribution_type:contribution_types(name)
      `)
      .eq("id", contribution_id)
      .single();

    if (contribError || !contribution) {
      return new Response(
        JSON.stringify({ error: "Contribuição não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Regra 1: somente boletos pendentes (já emitidos) podem ter valor alterado
    if (contribution.status !== "pending") {
      return new Response(
        JSON.stringify({
          error:
            "Somente boletos pendentes (a vencer) podem ter o valor alterado.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Regra 2: nao permite alterar boletos vencidos
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = String(contribution.due_date).slice(0, 10).split("-").map(Number);
    const dueDate = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    if (dueDate < today) {
      return new Response(
        JSON.stringify({
          error:
            "Este boleto já está vencido. A alteração de valor só é permitida para boletos a vencer.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validacao de permissao por portal e limite de 1 alteracao
    const isPortal = portal_type === "employer" || portal_type === "accounting_office";

    if (isPortal) {
      if (!portal_id) {
        return new Response(
          JSON.stringify({ error: "portal_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (portal_type === "employer") {
        if (contribution.employer_id !== portal_id) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para acessar esta contribuição" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        const { data: link } = await supabase
          .from("accounting_office_employers")
          .select("id")
          .eq("accounting_office_id", portal_id)
          .eq("employer_id", contribution.employer_id)
          .maybeSingle();
        if (!link) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para acessar esta contribuição" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Regra 3: somente 1 alteracao via portal; depois disso somente o gestor
      const currentCount = contribution.portal_value_change_count || 0;
      if (currentCount >= 1) {
        return new Response(
          JSON.stringify({
            error:
              "Este boleto já foi alterado uma vez pelo portal. Para novas alterações, entre em contato com o gestor do sindicato.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Dados do pagador
    const employer = contribution.employer as {
      cnpj?: string; name?: string; email?: string; phone?: string;
    } | null;
    if (!employer?.cnpj || !employer?.name) {
      return new Response(
        JSON.stringify({
          error:
            "Dados da empresa estão incompletos para reemitir o boleto. Verifique o cadastro (CNPJ e Razão Social).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cancelar boleto antigo
    if (contribution.lytex_invoice_id) {
      await cancelInvoice(contribution.lytex_invoice_id);
    }

    const monthNames = [
      "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
    ];
    const typeName = contribution.contribution_type?.name || "Contribuição";
    const description = `${typeName} - ${monthNames[contribution.competence_month - 1]}/${contribution.competence_year}`;

    let invoice: any = null;
    try {
      invoice = await createInvoice({
        employer: {
          cnpj: employer.cnpj,
          name: employer.name,
          email: employer.email,
          phone: employer.phone,
        },
        value: valueInCents,
        dueDate: String(contribution.due_date).slice(0, 10),
        description,
        contributionId: contribution.id,
      });
    } catch (lytexError: any) {
      console.error("[ChangeValue] Erro Lytex:", lytexError);
      return new Response(
        JSON.stringify({ error: lytexError.message || "Erro ao reemitir boleto" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newCount = isPortal
      ? (contribution.portal_value_change_count || 0) + 1
      : (contribution.portal_value_change_count || 0);

    const oldValue = contribution.value;
    const oldNotes = contribution.notes || "";
    const changeNote = `Valor alterado em ${new Date().toLocaleDateString("pt-BR")} de R$ ${(oldValue / 100).toFixed(2)} para R$ ${(valueInCents / 100).toFixed(2)}${isPortal ? ` (portal ${portal_type})` : " (gestor)"}.`;

    const { error: updateError } = await supabase
      .from("employer_contributions")
      .update({
        value: valueInCents,
        lytex_invoice_id: invoice._id,
        lytex_invoice_url: invoice.invoiceUrl,
        lytex_boleto_barcode: invoice.boleto?.barCode || null,
        lytex_boleto_digitable_line: invoice.boleto?.digitableLine || null,
        lytex_pix_code: invoice.pix?.code || null,
        lytex_pix_qrcode: invoice.pix?.qrCode || null,
        portal_value_change_count: newCount,
        notes: oldNotes ? `${oldNotes}\n${changeNote}` : changeNote,
      })
      .eq("id", contribution_id);

    if (updateError) {
      console.error("[ChangeValue] Erro ao atualizar contribuicao:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar dados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log de portal
    if (isPortal && portal_id) {
      const logTable = portal_type === "accounting_office"
        ? "accounting_office_portal_logs"
        : "employer_portal_logs";
      const logData = portal_type === "accounting_office"
        ? { accounting_office_id: portal_id, action: "change_value" }
        : { employer_id: portal_id, action: "change_value" };

      try {
        await supabase.from(logTable).insert({
          ...logData,
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: {
            contribution_id,
            old_value: oldValue,
            new_value: valueInCents,
            new_change_count: newCount,
          },
        });
      } catch (e) {
        console.error("[ChangeValue] warn log insert failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Valor alterado e novo boleto gerado com sucesso!",
        lytex_invoice_url: invoice.invoiceUrl,
        portal_value_change_count: newCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[ChangeValue] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});