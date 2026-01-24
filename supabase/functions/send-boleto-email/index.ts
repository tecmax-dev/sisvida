import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoletoData {
  employerName: string;
  employerCnpj: string;
  contributionType: string;
  competenceMonth: number;
  competenceYear: number;
  dueDate: string;
  value: number;
  status?: string;
  invoiceUrl: string;
  digitableLine?: string;
  pixCode?: string;
  isAwaitingValue?: boolean;
  isPF?: boolean;
}

interface SendBoletoEmailRequest {
  recipientEmail: string;
  recipientName: string;
  ccEmail?: string;
  clinicName: string;
  clinicId?: string;
  boletos: BoletoData[];
}

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
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return cnpj;
};

const isPFDocument = (doc: string) => {
  const cleaned = (doc || "").replace(/\D/g, "");
  return cleaned.length <= 11 || cleaned === "";
};

const formatDate = (dateStr: string) => {
  const dateOnly = (dateStr || "").slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const generateBoletoCard = (boleto: BoletoData): string => {
  const competence = `${MONTHS[boleto.competenceMonth - 1]}/${boleto.competenceYear}`;
  const isPF = boleto.isPF || isPFDocument(boleto.employerCnpj);
  const entityLabel = isPF ? "Socio" : "Empresa";
  const docLabel = isPF ? "CPF" : "CNPJ";
  
  if (boleto.isAwaitingValue) {
    return `<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; background: #ffffff;">
<h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: 600;">${boleto.contributionType} - ${competence}</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
${boleto.employerName ? `<tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">${entityLabel}:</td><td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${boleto.employerName}</td></tr>` : ""}
${boleto.employerCnpj ? `<tr><td style="padding: 8px 0; color: #6b7280;">${docLabel}:</td><td style="padding: 8px 0; color: #1f2937;">${formatCNPJ(boleto.employerCnpj)}</td></tr>` : ""}
<tr><td style="padding: 8px 0; color: #6b7280;">Vencimento:</td><td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${formatDate(boleto.dueDate)}</td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Status:</td><td style="padding: 8px 0;"><span style="display: inline-block; padding: 4px 12px; background: #eff6ff; color: #2563eb; border-radius: 4px; font-size: 12px; font-weight: 500;">Aguardando Valor</span></td></tr>
</table>
<div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
<p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">Clique no botao abaixo para informar o valor e gerar o boleto.</p>
</div>
<div style="margin-top: 16px; text-align: center;">
<a href="${boleto.invoiceUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">Informar Valor e Gerar Boleto</a>
</div>
</div>`;
  }
  
  const statusLabel = boleto.status === "overdue" ? "Vencido" : "Pendente";
  const statusBg = boleto.status === "overdue" ? "#fef2f2" : "#fffbeb";
  const statusColor = boleto.status === "overdue" ? "#dc2626" : "#d97706";

  return `<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; background: #ffffff;">
<h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: 600;">${boleto.contributionType} - ${competence}</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
${boleto.employerName ? `<tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">${entityLabel}:</td><td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${boleto.employerName}</td></tr>` : ""}
${boleto.employerCnpj ? `<tr><td style="padding: 8px 0; color: #6b7280;">${docLabel}:</td><td style="padding: 8px 0; color: #1f2937;">${formatCNPJ(boleto.employerCnpj)}</td></tr>` : ""}
<tr><td style="padding: 8px 0; color: #6b7280;">Vencimento:</td><td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${formatDate(boleto.dueDate)}</td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Valor:</td><td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 16px;">${formatCurrency(boleto.value)}</td></tr>
<tr><td style="padding: 8px 0; color: #6b7280;">Status:</td><td style="padding: 8px 0;"><span style="display: inline-block; padding: 4px 12px; background: ${statusBg}; color: ${statusColor}; border-radius: 4px; font-size: 12px; font-weight: 500;">${statusLabel}</span></td></tr>
</table>
<div style="margin-top: 20px; text-align: center;">
<a href="${boleto.invoiceUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">Baixar Boleto</a>
</div>
${boleto.digitableLine ? `<div style="margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 6px;"><p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 500;">Linha Digitavel:</p><code style="display: block; word-break: break-all; color: #1f2937; font-size: 13px; font-family: monospace;">${boleto.digitableLine}</code></div>` : ""}
${boleto.pixCode ? `<div style="margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;"><p style="margin: 0 0 8px 0; color: #166534; font-size: 12px; font-weight: 500;">Pague via PIX (copie o codigo):</p><code style="display: block; word-break: break-all; color: #166534; font-size: 11px; font-family: monospace;">${boleto.pixCode}</code></div>` : ""}
</div>`;
};

const generateEmailHtml = (data: SendBoletoEmailRequest, logoUrl?: string): string => {
  const totalValue = data.boletos.reduce((sum, b) => sum + b.value, 0);
  const boletoCards = data.boletos.map(generateBoletoCard).join("");
  
  const logoSection = logoUrl 
    ? `<img src="${logoUrl}" alt="Logo" style="max-height: 50px; max-width: 180px; margin-bottom: 12px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boleto de Contribuicao</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f3f4f6;">
<div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
${logoSection}
<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Boleto(s) de Contribuicao</h1>
<p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">${data.clinicName}</p>
</div>
<div style="padding: 24px;">
<p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">Prezado(a) <strong>${data.recipientName}</strong>,</p>
<p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">Seguem abaixo ${data.boletos.length > 1 ? `os ${data.boletos.length} boletos` : "o boleto"} para pagamento:</p>
${boletoCards}
${data.boletos.length > 1 ? `<div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; text-align: center;"><p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Total:</strong> ${formatCurrency(totalValue)} (${data.boletos.length} boletos)</p></div>` : ""}
</div>
<div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">Em caso de duvidas, entre em contato conosco.</p>
<p style="margin: 0; color: #9ca3af; font-size: 12px;">${data.clinicName}</p>
</div>
</div>
</body>
</html>`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-boleto-email: Received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    console.log("send-boleto-email: SMTP_HOST:", smtpHost);
    console.log("send-boleto-email: SMTP_PORT:", smtpPort);

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      console.error("send-boleto-email: SMTP not fully configured");
      return new Response(
        JSON.stringify({ error: "Configuracao SMTP incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: SendBoletoEmailRequest = await req.json();
    console.log("send-boleto-email: Processing request for", data.recipientEmail, "with", data.boletos.length, "boletos");

    if (!data.recipientEmail || !data.recipientName || !data.clinicName || !data.boletos?.length) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatorios nao preenchidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.recipientEmail)) {
      return new Response(
        JSON.stringify({ error: "Email do destinatario invalido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca logo do sindicato se clinicId foi informado
    let logoUrl: string | undefined;
    if (data.clinicId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      const { data: unionData } = await supabase
        .from('union_entities')
        .select('logo_url')
        .eq('clinic_id', data.clinicId)
        .single();
      
      if (unionData?.logo_url) {
        logoUrl = unionData.logo_url;
      }
    }

    const html = generateEmailHtml(data, logoUrl);
    
    const monthName = MONTHS[data.boletos[0].competenceMonth - 1];
    const subject = data.boletos.length > 1
      ? `${data.boletos.length} Boletos de Contribuicao - ${data.clinicName}`
      : `Boleto de Contribuicao - ${data.boletos[0].contributionType} ${monthName}/${data.boletos[0].competenceYear}`;

    const toAddresses = data.ccEmail 
      ? [data.recipientEmail, data.ccEmail]
      : [data.recipientEmail];

    console.log("send-boleto-email: Sending email via SMTP to:", toAddresses);

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    try {
      await client.send({
        from: smtpFrom,
        to: toAddresses,
        subject: subject,
        content: "Visualize este email em um cliente que suporte HTML.",
        html: html,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          "Content-Transfer-Encoding": "base64",
        },
      });

      await client.close();
      console.log("send-boleto-email: Email sent successfully via SMTP!");

      return new Response(
        JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (smtpError: any) {
      console.error("send-boleto-email: SMTP error:", smtpError);
      try { await client.close(); } catch (_) {}
      throw new Error(`Erro SMTP: ${smtpError.message || smtpError}`);
    }
  } catch (error: any) {
    console.error("send-boleto-email: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao enviar email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
