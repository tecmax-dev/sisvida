import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// ============================================================================
// CORS HEADERS - CENTRALIZADOS (não duplicar em nenhum outro lugar)
// ============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ============================================================================
// HELPER: Resposta com CORS garantido (usar em TODAS as respostas)
// ============================================================================
function corsResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function corsError(message: string, status = 500, details?: unknown): Response {
  console.error(`[send-boleto-email] Erro (${status}):`, message, details || "");
  return corsResponse({ error: message }, status);
}

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
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const origin = req.headers.get("Origin") || req.headers.get("origin") || "unknown";
  const method = req.method;
  
  console.log(`[send-boleto-email][${requestId}] ====== NOVA REQUISIÇÃO ======`);
  console.log(`[send-boleto-email][${requestId}] Method: ${method}, Origin: ${origin}`);

  // CORS Preflight - resposta imediata
  if (method === "OPTIONS") {
    console.log(`[send-boleto-email][${requestId}] Preflight OPTIONS - respondendo com CORS headers`);
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpFrom = Deno.env.get("SMTP_FROM");

    console.log(`[send-boleto-email][${requestId}] SMTP Config: host=${smtpHost}, port=${smtpPort}, user=${smtpUser ? "***" : "N/A"}`);

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      console.error(`[send-boleto-email][${requestId}] SMTP não configurado completamente`);
      return corsError("Configuracao SMTP incompleta.", 500);
    }

    const data: SendBoletoEmailRequest = await req.json();
    console.log(`[send-boleto-email][${requestId}] Destinatário: ${data.recipientEmail}, Boletos: ${data.boletos?.length || 0}`);

    if (!data.recipientEmail || !data.recipientName || !data.clinicName || !data.boletos?.length) {
      return corsError("Campos obrigatorios nao preenchidos", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.recipientEmail)) {
      return corsError("Email do destinatario invalido", 400);
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

    console.log(`[send-boleto-email][${requestId}] Iniciando envio SMTP para: ${toAddresses.join(", ")}`);

    // Criar cliente SMTP com timeout
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
      console.log(`[send-boleto-email][${requestId}] Conectando ao servidor SMTP...`);
      
      await client.send({
        from: smtpFrom,
        to: toAddresses,
        subject: subject,
        html: html,
      });

      console.log(`[send-boleto-email][${requestId}] Email enviado com sucesso!`);
      
      try { 
        await client.close(); 
        console.log(`[send-boleto-email][${requestId}] Conexão SMTP fechada`);
      } catch (closeErr) {
        console.warn(`[send-boleto-email][${requestId}] Aviso ao fechar SMTP:`, closeErr);
      }

      const elapsed = Date.now() - startTime;
      console.log(`[send-boleto-email][${requestId}] ✓ Sucesso em ${elapsed}ms`);
      
      return corsResponse({ success: true, message: "Email enviado com sucesso" });
      
    } catch (smtpError: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[send-boleto-email][${requestId}] ✗ Erro SMTP após ${elapsed}ms`);
      console.error(`[send-boleto-email][${requestId}] SMTP Error Name:`, smtpError?.name);
      console.error(`[send-boleto-email][${requestId}] SMTP Error Message:`, smtpError?.message);
      console.error(`[send-boleto-email][${requestId}] SMTP Error Stack:`, smtpError?.stack);
      
      try { await client.close(); } catch (_) {}
      
      // Não lançar exceção - retornar erro estruturado diretamente
      return corsError(`Erro SMTP: ${smtpError.message || smtpError}`, 500);
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[send-boleto-email][${requestId}] ✗ Erro geral após ${elapsed}ms`);
    console.error(`[send-boleto-email][${requestId}] Error:`, error?.message, error?.stack);
    
    return corsError(error.message || "Erro ao enviar email", 500);
  }
};

serve(handler);
