import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  status: string;
  invoiceUrl: string;
  digitableLine?: string;
  pixCode?: string;
}

interface SendBoletoEmailRequest {
  recipientEmail: string;
  recipientName: string;
  ccEmail?: string;
  clinicName: string;
  boletos: BoletoData[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
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
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
};

const generateBoletoCard = (boleto: BoletoData): string => {
  const competence = `${MONTHS[boleto.competenceMonth - 1]}/${boleto.competenceYear}`;
  const statusLabel = boleto.status === "overdue" ? "🔴 Vencido" : "🟡 Pendente";
  const statusBg = boleto.status === "overdue" ? "#fef2f2" : "#fffbeb";
  const statusColor = boleto.status === "overdue" ? "#dc2626" : "#d97706";

  return `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; background: #ffffff;">
      <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; font-weight: 600;">
        📋 ${boleto.contributionType} - ${competence}
      </h3>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 120px;">Empresa:</td>
          <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${boleto.employerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">CNPJ:</td>
          <td style="padding: 8px 0; color: #1f2937;">${formatCNPJ(boleto.employerCnpj)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Vencimento:</td>
          <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${formatDate(boleto.dueDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Valor:</td>
          <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 16px;">${formatCurrency(boleto.value)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Status:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; background: ${statusBg}; color: ${statusColor}; border-radius: 4px; font-size: 12px; font-weight: 500;">
              ${statusLabel}
            </span>
          </td>
        </tr>
      </table>
      
      <div style="margin-top: 20px; text-align: center;">
        <a href="${boleto.invoiceUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
          📥 Baixar Boleto
        </a>
      </div>
      
      ${boleto.digitableLine ? `
        <div style="margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 6px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 500;">Linha Digitável:</p>
          <code style="display: block; word-break: break-all; color: #1f2937; font-size: 13px; font-family: monospace;">
            ${boleto.digitableLine}
          </code>
        </div>
      ` : ""}
      
      ${boleto.pixCode ? `
        <div style="margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
          <p style="margin: 0 0 8px 0; color: #166534; font-size: 12px; font-weight: 500;">💚 Pague via PIX (copie o código):</p>
          <code style="display: block; word-break: break-all; color: #166534; font-size: 11px; font-family: monospace;">
            ${boleto.pixCode}
          </code>
        </div>
      ` : ""}
    </div>
  `;
};

const generateEmailHtml = (data: SendBoletoEmailRequest): string => {
  const totalValue = data.boletos.reduce((sum, b) => sum + b.value, 0);
  const boletoCards = data.boletos.map(generateBoletoCard).join("");

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
            📧 Boleto(s) de Contribuição
          </h1>
          <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">
            ${data.clinicName}
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Prezado(a) <strong>${data.recipientName}</strong>,
          </p>
          <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Seguem abaixo ${data.boletos.length > 1 ? `os ${data.boletos.length} boletos` : "o boleto"} para pagamento:
          </p>
          
          ${boletoCards}
          
          ${data.boletos.length > 1 ? `
            <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; text-align: center;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>Total:</strong> ${formatCurrency(totalValue)} (${data.boletos.length} boletos)
              </p>
            </div>
          ` : ""}
        </div>
        
        <!-- Footer -->
        <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
            Em caso de dúvidas, entre em contato conosco.
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            ${data.clinicName}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-boleto-email: Received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: SendBoletoEmailRequest = await req.json();
    console.log("send-boleto-email: Processing request for", data.recipientEmail, "with", data.boletos.length, "boletos");

    // Validate required fields
    if (!data.recipientEmail || !data.recipientName || !data.clinicName || !data.boletos?.length) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios não preenchidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.recipientEmail)) {
      return new Response(
        JSON.stringify({ error: "Email do destinatário inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.ccEmail && !emailRegex.test(data.ccEmail)) {
      return new Response(
        JSON.stringify({ error: "Email de cópia inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = generateEmailHtml(data);
    const subject = data.boletos.length > 1
      ? `${data.boletos.length} Boletos de Contribuição - ${data.clinicName}`
      : `Boleto de Contribuição - ${data.boletos[0].contributionType} ${MONTHS[data.boletos[0].competenceMonth - 1]}/${data.boletos[0].competenceYear}`;

    const toEmails = [data.recipientEmail];
    const ccEmails = data.ccEmail ? [data.ccEmail] : undefined;

    console.log("send-boleto-email: Sending email to", toEmails, "cc:", ccEmails);

    // Use RESEND_FROM secret or fallback
    const fromAddress = Deno.env.get("RESEND_FROM") || `${data.clinicName} <onboarding@resend.dev>`;
    
    const emailResponse = await resend.emails.send({
      from: fromAddress,
      to: toEmails,
      cc: ccEmails,
      subject,
      html,
    });

    console.log("send-boleto-email: Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-boleto-email: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao enviar email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
