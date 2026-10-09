import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
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

// Regra de valor mínimo por categoria de empregador (aplicada em /sindicato,
// portal empresa e portal contador). Baseia-se no nome da categoria vinculada
// ao employer.category_id.
function getEmployerCategoryMinimum(categoryName: string | null | undefined): { min: number; label: string } | null {
  const normalized = (categoryName || "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("varejista")) {
    return { min: 3260, label: "Comércio Varejista" };
  }
  if (normalized.includes("supermercado") || normalized.includes("atacadista")) {
    return { min: 3250, label: "Comércio Atacadista (Supermercados)" };
  }
  return null;
}

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

const escHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// E-mail ao sindicato: empresa/contador informou valor de contribuição zerada pelo portal.
async function notifyUnionValueChange(p: {
  supabase: any;
  clinicId: string;
  clinicEmail: string | null;
  employerId: string | null;
  employerName: string;
  documentNumber: string;
  invoiceUrl: string | null;
  byAccounting: boolean;
  logId?: string | null;
}): Promise<string> {
  const { data: ue } = await p.supabase
    .from("union_entities")
    .select("email_institucional, email_contato")
    .eq("clinic_id", p.clinicId)
    .limit(1)
    .maybeSingle();
  const to = p.clinicEmail || ue?.email_institucional || ue?.email_contato;
  if (p.logId && to) await p.supabase.from("contribution_value_email_logs").update({ recipient: to }).eq("id", p.logId);
  if (!to) throw new Error("Sindicato sem e-mail cadastrado");

  let regNumber = "";
  if (p.employerId) {
    const { data: emp } = await p.supabase.from("employers").select("registration_number").eq("id", p.employerId).maybeSingle();
    regNumber = emp?.registration_number ? `${emp.registration_number} - ` : "";
  }

  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASSWORD");
  const from = Deno.env.get("SMTP_FROM") || "noreply@prosindweb.com.br";
  const port = Number(Deno.env.get("SMTP_PORT") || "587");
  if (!host || !user || !pass) throw new Error("Envio de e-mail não configurado");

  const who = p.byAccounting ? "um escritório de contabilidade" : "uma empresa";
  const link = p.invoiceUrl
    ? `<p style="margin:24px 0"><a href="${escHtml(p.invoiceUrl)}" target="_blank" style="display:inline-block;padding:12px 28px;background:#16a394;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Imprimir boleto</a></p>`
    : "";
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
<h2 style="margin:0 0 16px;color:#0f766e">Alteração do valor do boleto</h2>
<p>Prezado(s),</p>
<p>Estou passando aqui para notificar que ${who} alterou o valor do boleto.</p>
<p>A empresa <strong>${escHtml(regNumber + p.employerName)}</strong> acabou de alterar o valor do boleto.</p>
<p>N° documento <strong>${escHtml(p.documentNumber)}</strong></p>
${p.invoiceUrl ? "<p>Segue abaixo link para acessar o boleto:</p>" : ""}
${link}
<p style="margin-top:24px;font-size:12px;color:#9ca3af">Notificação automática do sistema.</p>
</div></body></html>`;

  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
  const client = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } } });
  try {
    await client.send({ from, to, subject: "Alteração do valor do boleto", html, content: "auto" });
  } finally {
    await client.close();
  }
  return to;
}

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
        <div style="background: #1e3a8a; padding: 32px 24px; text-align: center;">
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

  // Normaliza telefone: apenas dígitos e máximo de 11 caracteres
  // (Lytex rejeita números maiores). Se ficar < 10, omite para evitar erro.
  const rawPhone = (params.employer.phone || "").replace(/\D/g, "");
  const normalizedPhone = rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;
  const cellphone = normalizedPhone.length >= 10 ? normalizedPhone : undefined;

  const invoicePayload = {
    client: {
      type: cleanCnpj.length === 14 ? "pj" : "pf",
      name: params.employer.name,
      cpfCnpj: cleanCnpj,
      email: params.employer.email || undefined,
      cellphone,
    },
    items: [
      {
        name: params.description,
        quantity: 1,
        value: params.value,
      },
    ],
    dueDate: params.dueDate.includes("T") ? params.dueDate : `${params.dueDate}T12:00:00`,
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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("[SetValue] Request body:", JSON.stringify(body));
    
    const { contribution_id, value, due_date, portal_type, portal_id } = body;

    if (!contribution_id || value === undefined || value === null) {
      console.error("[SetValue] Missing required fields:", { contribution_id, value });
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

    const requestedDueDate = typeof due_date === "string" ? due_date.slice(0, 10) : "";
    if (requestedDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDueDate)) {
      return new Response(
        JSON.stringify({ error: "Nova data de vencimento inválida" }),
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

    // Página exclusiva do WhatsApp: só competência a vencer (vencidas apenas pelo Portal da Empresa)
    if (body.due_only === true && (contribution.status !== "awaiting_value" || !isDueCompetence(contribution))) {
      return new Response(
        JSON.stringify({ error: "Esta competência já venceu. Gere o boleto pelo Portal da Empresa." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce valor mínimo por categoria do empregador
    // Exceção única: boleto de teste de homologação Sicoob (TECMAX, R$ 5,00, 10/2026)
    const SICOOB_HOMOLOG_TEST_ID = "51490cde-4a67-4b0e-b7d5-25b118073773";
    if (contribution.employer_id && contribution.id !== SICOOB_HOMOLOG_TEST_ID) {
      const { data: empCat } = await supabase
        .from("employers")
        .select("category:employer_categories(name)")
        .eq("id", contribution.employer_id)
        .maybeSingle();
      const rule = getEmployerCategoryMinimum((empCat as any)?.category?.name);
      if (rule && valueInCents < rule.min) {
        return new Response(
          JSON.stringify({
            error: `O valor mínimo para emissão de contribuição da categoria ${rule.label} é ${formatBRL(rule.min)}. Valor informado: ${formatBRL(valueInCents)}.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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

    // Portal precisa ser identificado; chamadas sem portal são recusadas
    if (!["public_token", "employer", "accounting_office"].includes(portal_type) || !portal_id) {
      return new Response(
        JSON.stringify({ error: "Origem do lançamento não identificada" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Etapa obrigatória: relação de trabalhadores validada por IA,
    // vinculada à MESMA empresa, ao MESMO lançamento e ao mesmo portal.
    let workerListValidationId: string | null = null;
    if (portal_type === "employer" || portal_type === "accounting_office") {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: validation } = await supabase
        .from("contribution_worker_list_validations")
        .select("id")
        .eq("id", String(body.worker_list_validation_id || "00000000-0000-0000-0000-000000000000"))
        .eq("contribution_id", contribution.id)
        .eq("employer_id", contribution.employer_id)
        .eq("portal_type", portal_type)
        .eq("portal_id", portal_id)
        .eq("status", "valid")
        .is("used_at", null)
        .gte("created_at", sinceIso)
        .maybeSingle();
      if (!validation) {
        return new Response(
          JSON.stringify({
            error: "Envie e valide a relação de trabalhadores desta empresa antes de informar o valor.",
            code: "WORKER_LIST_NOT_VALIDATED",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      workerListValidationId = validation.id;
    }

    // Gerar boleto na Lytex
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const typeName = contribution.contribution_type?.name || "Contribuição";
    const description = `${typeName} - ${monthNames[contribution.competence_month - 1]}/${contribution.competence_year}`;

    // Se o portal informou uma nova data para boleto vencido, usa esta data.
    // Caso contrário, preserva a data original quando válida e evita enviar data passada à Lytex.
    let effectiveDueDate: string = requestedDueDate || String(contribution.due_date || "").slice(0, 10);
    try {
      // Usar fuso de São Paulo para evitar que o servidor (UTC) considere
      // o dia seguinte como "hoje" e rejeite datas válidas escolhidas pelo usuário.
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const todayStr = fmt.format(new Date()); // YYYY-MM-DD
      if (requestedDueDate && requestedDueDate < todayStr) {
        return new Response(
          JSON.stringify({ error: "A nova data de vencimento deve ser futura" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!effectiveDueDate || effectiveDueDate < todayStr) {
        console.log("[SetValue] Vencimento no passado, reagendando:", {
          original: effectiveDueDate,
          novo: todayStr,
        });
        effectiveDueDate = todayStr;
      }
    } catch (dateErr) {
      console.error("[SetValue] Erro ao normalizar dueDate (nao critico):", dateErr);
    }

    // Garantir que temos dados consistentes do pagador
    const employer = contribution.employer as { cnpj?: string; name?: string; email?: string; phone?: string } | null;
    if (!employer?.cnpj || !employer?.name) {
      console.error("[SetValue] Dados do pagador ausentes na contribuição:", {
        contribution_id,
        employer_id: contribution.employer_id,
        employer,
      });
      return new Response(
        JSON.stringify({
          error:
            "Dados da empresa estão incompletos para emitir o boleto. Verifique o cadastro da empresa (CNPJ e Razão Social) e tente novamente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prevenir o erro Lytex: "Pagador não pode ser igual ao Emissor"
    // (isso ocorre quando o CNPJ/CPF do pagador está igual ao do sindicato/entidade emissora)
    try {
      const cleanEmployerDoc = String(employer.cnpj).replace(/\D/g, "");

      let issuerCnpj: string | null = null;
      if (contribution.union_entity_id) {
        const { data: unionEntity } = await supabase
          .from("union_entities")
          .select("cnpj")
          .eq("id", contribution.union_entity_id)
          .maybeSingle();
        issuerCnpj = unionEntity?.cnpj ?? null;
      } else if (clinicId) {
        const { data: unionEntity } = await supabase
          .from("union_entities")
          .select("cnpj")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        issuerCnpj = unionEntity?.cnpj ?? null;
      }

      const cleanIssuerDoc = String(issuerCnpj || "").replace(/\D/g, "");

      if (cleanIssuerDoc && cleanEmployerDoc && cleanIssuerDoc === cleanEmployerDoc) {
        console.error("[SetValue] Pagador igual ao emissor - bloqueando emissão:", {
          contribution_id,
          employer_id: contribution.employer_id,
          payer_doc: cleanEmployerDoc,
          issuer_doc: cleanIssuerDoc,
          portal_type,
          portal_id,
        });

        return new Response(
          JSON.stringify({
            error:
              "Não foi possível emitir o boleto porque o CNPJ/CPF do pagador está igual ao do emissor. Corrija o cadastro da empresa vinculada e tente novamente.",
            code: "PAYER_EQUALS_ISSUER",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (issuerCheckError) {
      // Não bloqueia o fluxo principal (apenas impede a validação preventiva)
      console.error("[SetValue] Falha ao validar emissor vs pagador (nao critico):", issuerCheckError);
    }

    try {
      // Atualizar valor e vencimento antes de invocar a Lytex (a função lytex-api
      // gravará os campos lytex_* e o status=pending após criar a cobrança).
      const { error: preUpdateError } = await supabase
        .from("employer_contributions")
        .update({ value: valueInCents, due_date: effectiveDueDate })
        .eq("id", contribution_id);
      if (preUpdateError) {
        console.error("[SetValue] Erro ao salvar valor/vencimento:", preUpdateError);
        throw new Error("Erro ao salvar dados");
      }

      // Delegar a criação da cobrança ao lytex-api (caminho oficial e validado).
      // Inclui matrícula, endereço (quando disponível) e tratamento de erros da Lytex.
      const employerAddressStr = (employer as any)?.address as string | undefined;
      const employerCity = (employer as any)?.city as string | undefined;
      const employerState = (employer as any)?.state as string | undefined;
      const employerCep = (employer as any)?.cep as string | undefined;
      const employerNeighborhood = (employer as any)?.neighborhood as string | undefined;

      const employerPayload: any = {
        cnpj: employer.cnpj,
        name: employer.name,
        email: employer.email,
        phone: employer.phone,
      };
      if (employerAddressStr && employerCity && employerState && employerCep && employerNeighborhood) {
        employerPayload.address = {
          street: employerAddressStr,
          number: "S/N",
          zone: employerNeighborhood,
          city: employerCity,
          state: employerState,
          zip: String(employerCep).replace(/\D/g, ""),
        };
      }

      const { data: lytexResp, error: invokeErr } = await supabase.functions.invoke(
        "lytex-api",
        {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: {
            action: "create_invoice",
            contributionId: contribution.id,
            clinicId: clinicId || "",
            value: valueInCents,
            valueIsInCents: true,
            dueDate: effectiveDueDate,
            description,
            enableBoleto: true,
            enablePix: true,
            employer: employerPayload,
          },
        },
      );

      if (invokeErr) {
        throw new Error(invokeErr.message || "Falha ao invocar lytex-api");
      }
      if (lytexResp?.error) {
        throw new Error(lytexResp.error);
      }

      const invoice = {
        _id: lytexResp?.invoice?._id || lytexResp?.invoice?.id || null,
        invoiceUrl: lytexResp?.invoiceUrl || lytexResp?.invoice?.invoiceUrl || null,
        boleto: lytexResp?.invoice?.boleto || null,
        pix: lytexResp?.invoice?.pix || null,
      };

      // Registrar log se for portal
      if (portal_type && portal_id) {
        const logTable =
          portal_type === "accounting_office" ? "accounting_office_portal_logs" : "employer_portal_logs";
        const logData =
          portal_type === "accounting_office"
            ? { accounting_office_id: portal_id, action: "set_value" }
            : { employer_id: portal_id, action: "set_value" };

        await supabase.from(logTable).insert({
          ...logData,
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { contribution_id, value: valueInCents, due_date: effectiveDueDate },
        });
      }

      // Enviar notificação ao gestor da clínica via email (apenas para links públicos)
      if (portal_type === "public_token" && clinicData?.email) {
        try {
          await sendManagerNotification({
            managerEmail: clinicData.email,
            clinicName: clinicData.name,
            employerName: employer?.name || "Empresa",
            employerCnpj: employer?.cnpj || "",
            contributionType: contribution.contribution_type?.name || "Contribuição",
            competenceMonth: contribution.competence_month,
            competenceYear: contribution.competence_year,
            dueDate: effectiveDueDate,
            value: valueInCents,
            invoiceUrl: invoice.invoiceUrl,
          });
        } catch (notifError) {
          console.error("[SetValue] Erro ao enviar notificacao (nao critico):", notifError);
          // Não bloqueia o fluxo principal
        }
      }

      // Notificar o sindicato por e-mail quando empresa/contador informa valor pelo portal
      if ((portal_type === "employer" || portal_type === "accounting_office") && clinicId) {
        let logId: string | null = null;
        const docNum = String(
          invoice.boleto?.ourNumber || invoice.boleto?.nossoNumero || invoice.boleto?.documentNumber ||
          lytexResp?.invoice?.referenceId || invoice._id || contribution.id,
        );
        try {
          const { data: logRow } = await supabase.from("contribution_value_email_logs").insert({
            clinic_id: clinicId, contribution_id: contribution.id, employer_id: contribution.employer_id,
            employer_name: employer?.name || contribution.employer?.name || null, portal_type,
            document_number: docNum, invoice_url: invoice.invoiceUrl, status: "pending",
          }).select("id").maybeSingle();
          logId = logRow?.id ?? null;
        } catch (_) { /* log não crítico */ }
        try {
          await notifyUnionValueChange({
            logId,
            supabase,
            clinicId,
            clinicEmail: clinicData?.email || null,
            employerId: contribution.employer_id,
            employerName: employer?.name || contribution.employer?.name || "Empresa",
            documentNumber: String(
              invoice.boleto?.ourNumber || invoice.boleto?.nossoNumero || invoice.boleto?.documentNumber ||
              lytexResp?.invoice?.referenceId || invoice._id || contribution.id,
            ),
            invoiceUrl: invoice.invoiceUrl,
            byAccounting: portal_type === "accounting_office",
          });
          if (logId) await supabase.from("contribution_value_email_logs").update({ status: "sent" }).eq("id", logId);
        } catch (notifError: any) {
          console.error("[SetValue] Erro ao notificar sindicato (nao critico):", notifError);
          if (logId) await supabase.from("contribution_value_email_logs").update({ status: "failed", error_message: String(notifError?.message || notifError).slice(0, 500) }).eq("id", logId);
        }
      }

      if (workerListValidationId) {
        await supabase
          .from("contribution_worker_list_validations")
          .update({ used_at: new Date().toISOString() })
          .eq("id", workerListValidationId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          lytex_invoice_url: invoice.invoiceUrl,
          message: "Valor definido e boleto gerado com sucesso!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (lytexError: any) {
      console.error("[SetValue] Erro Lytex:", lytexError);

      // IMPORTANTE: retornar 200 para que os portais consigam exibir a mensagem real,
      // evitando o erro genérico "Edge Function returned a non-2xx status code".
      return new Response(
        JSON.stringify({ error: lytexError.message || "Erro ao gerar boleto" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
