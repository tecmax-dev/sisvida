import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Estados do fluxo de boleto
type BoletoState = 
  | 'INIT'
  | 'SELECT_BOLETO_TYPE'        // (1) A vencer (2) Vencido
  | 'WAITING_CNPJ'              // Aguardando CNPJ
  | 'CONFIRM_EMPLOYER'          // Confirmação da empresa encontrada
  | 'SELECT_CONTRIBUTION_TYPE'  // Tipo de contribuição
  | 'WAITING_COMPETENCE'        // Competência (mês/ano)
  | 'WAITING_VALUE'             // Valor a recolher
  | 'SELECT_CONTRIBUTION'       // Selecionar contribuição vencida existente
  | 'WAITING_NEW_DUE_DATE'      // Nova data de vencimento
  | 'CONFIRM_BOLETO'            // Confirmação final
  | 'FINISHED'
  | 'ERROR';

interface BoletoSession {
  id: string;
  clinic_id: string;
  phone: string;
  state: BoletoState;
  employer_id: string | null;
  employer_cnpj: string | null;
  employer_name: string | null;
  contribution_id: string | null;
  contribution_type_id: string | null;
  competence_month: number | null;
  competence_year: number | null;
  value_cents: number | null;
  new_due_date: string | null;
  boleto_type: 'a_vencer' | 'vencido' | null;
  available_contributions: any[] | null;
  flow_context: any;
  expires_at: string;
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

// ==========================================
// LYTEX API INTEGRATION
// ==========================================

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

  console.log("[boleto-flow] Obtendo novo access token Lytex...");

  const response = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[boleto-flow] Erro ao autenticar Lytex:", errorText);
    throw new Error(`Erro de autenticação Lytex: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.accessToken;
  tokenExpiresAt = now + (data.expiresIn * 1000);

  console.log("[boleto-flow] Token Lytex obtido com sucesso");
  return accessToken!;
}

async function cancelLytexInvoice(invoiceId: string): Promise<void> {
  const token = await getAccessToken();

  console.log("[boleto-flow] Cancelando cobrança Lytex:", invoiceId);

  const response = await fetch(`${LYTEX_API_URL}/invoices/${invoiceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ status: "cancelled" }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[boleto-flow] Erro ao cancelar cobrança:", errorText);
  }
}

async function createLytexInvoice(params: {
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

  console.log("[boleto-flow] Criando cobrança Lytex:", JSON.stringify(invoicePayload, null, 2));

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
    console.error("[boleto-flow] Erro ao criar cobrança:", JSON.stringify(responseData));
    throw new Error(responseData.message || `Erro ao criar cobrança: ${response.status}`);
  }

  const invoiceUrl = responseData.linkCheckout || responseData.linkBoleto || responseData.invoiceUrl || null;

  console.log("[boleto-flow] Cobrança criada:", responseData._id, "URL:", invoiceUrl);
  
  return {
    ...responseData,
    invoiceUrl,
  };
}

// ==========================================
// WHATSAPP MESSAGE SENDER
// ==========================================

async function sendWhatsAppMessage(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[boleto-flow] Sending message to ${formattedPhone}`);

    const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[boleto-flow] WhatsApp API error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[boleto-flow] Error sending WhatsApp:', error);
    return false;
  }
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

async function getOrCreateSession(
  supabase: any,
  clinicId: string,
  phone: string
): Promise<BoletoSession | null> {
  // Check for existing active session
  const { data: existingSession } = await supabase
    .from('whatsapp_boleto_sessions')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('phone', phone)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSession) {
    return existingSession as BoletoSession;
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from('whatsapp_boleto_sessions')
    .insert({
      clinic_id: clinicId,
      phone: phone,
      state: 'INIT',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[boleto-flow] Error creating session:', error);
    return null;
  }

  return newSession as BoletoSession;
}

async function updateSession(
  supabase: any,
  sessionId: string,
  updates: Partial<BoletoSession>
): Promise<void> {
  await supabase
    .from('whatsapp_boleto_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .eq('id', sessionId);
}

async function logAction(
  supabase: any,
  sessionId: string,
  clinicId: string,
  phone: string,
  action: string,
  details: any,
  success: boolean,
  errorMessage?: string,
  lytexRequest?: any,
  lytexResponse?: any,
  contributionId?: string
): Promise<void> {
  await supabase.from('whatsapp_boleto_logs').insert({
    session_id: sessionId,
    clinic_id: clinicId,
    phone: phone,
    action: action,
    details: details,
    success: success,
    error_message: errorMessage,
    lytex_request: lytexRequest,
    lytex_response: lytexResponse,
    contribution_id: contributionId,
  });
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function validateCnpj(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;
  
  // Validation algorithm
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cleanCnpj.charAt(12)) !== digit1) return false;

  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cleanCnpj.charAt(13)) !== digit2) return false;

  return true;
}

function formatCnpj(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function parseCompetence(text: string): { month: number; year: number } | null {
  // Try formats: 01/2025, 1/2025, janeiro/2025, jan/2025, 01-2025, 012025
  const cleanText = text.trim().toLowerCase();
  
  // Month names
  const monthNames: Record<string, number> = {
    'janeiro': 1, 'jan': 1, 'fevereiro': 2, 'fev': 2, 'março': 3, 'marco': 3, 'mar': 3,
    'abril': 4, 'abr': 4, 'maio': 5, 'mai': 5, 'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7, 'agosto': 8, 'ago': 8, 'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10, 'novembro': 11, 'nov': 11, 'dezembro': 12, 'dez': 12
  };
  
  // Try month name format
  for (const [name, num] of Object.entries(monthNames)) {
    const regex = new RegExp(`^${name}[/\\-\\s]*(\\d{4})$`);
    const match = cleanText.match(regex);
    if (match) {
      return { month: num, year: parseInt(match[1]) };
    }
  }
  
  // Try numeric formats
  const numericMatch = cleanText.match(/^(\d{1,2})[/\-]?(\d{4})$/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1]);
    const year = parseInt(numericMatch[2]);
    if (month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
      return { month, year };
    }
  }
  
  return null;
}

function parseCurrency(text: string): number | null {
  // Remove currency symbol and spaces
  const clean = text.replace(/[R$\s.]/g, '').replace(',', '.');
  const value = parseFloat(clean);
  if (isNaN(value) || value <= 0) return null;
  return Math.round(value * 100); // Convert to cents
}

function parseDate(text: string): string | null {
  // Try formats: DD/MM/YYYY, DD-MM-YYYY
  const match = text.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (!match) return null;
  
  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);
  
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2024) return null;
  
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (date <= today) return null; // Must be future date
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ==========================================
// FLOW MESSAGES
// ==========================================

const MESSAGES = {
  welcome: `🏢 *2ª Via de Boleto Empresarial*

Vou te ajudar a emitir uma segunda via do boleto de contribuição.

O boleto é:

1️⃣ *A vencer* (novo boleto)
2️⃣ *Vencido* (atualizar data)

_Digite o número da opção desejada._`,

  askCnpj: `📋 Por favor, informe o *CNPJ* da empresa (apenas números):

_Exemplo: 12345678000199_`,

  invalidCnpj: `❌ *CNPJ inválido*

Por favor, verifique e digite novamente apenas os 14 números do CNPJ.`,

  employerNotFound: (cnpj: string) => `❌ *Empresa não encontrada*

Não localizamos nenhuma empresa cadastrada com o CNPJ *${formatCnpj(cnpj)}*.

Por favor, verifique o CNPJ e tente novamente, ou entre em contato com o sindicato.`,

  confirmEmployer: (name: string, cnpj: string) => `✅ *Empresa identificada*

🏢 *${name}*
📋 CNPJ: ${formatCnpj(cnpj)}

Esta é a empresa correta?

1️⃣ *Sim*
2️⃣ *Não*`,

  selectContributionType: (types: Array<{ id: string; name: string }>) => {
    let msg = `📝 Qual o *tipo de contribuição*?\n\n`;
    types.forEach((t, i) => {
      msg += `${i + 1}️⃣ ${t.name}\n`;
    });
    msg += `\n_Digite o número da opção._`;
    return msg;
  },

  askCompetence: `📅 Qual a *competência* (período) da contribuição?

_Exemplos: 01/2025, Janeiro/2025, jan/2025_`,

  invalidCompetence: `❌ Formato de competência inválido.

Por favor, informe no formato *mês/ano*.
_Exemplos: 01/2025, Janeiro/2025_`,

  askValue: `💰 Qual o *valor* a recolher?

_Exemplo: 150,00 ou R$ 150,00_`,

  invalidValue: `❌ Valor inválido.

Por favor, informe um valor válido.
_Exemplo: 150,00 ou R$ 150,00_`,

  selectContribution: (contributions: any[]) => {
    let msg = `📋 Encontramos as seguintes contribuições vencidas:\n\n`;
    contributions.forEach((c, i) => {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const competence = `${monthNames[c.competence_month - 1]}/${c.competence_year}`;
      const value = c.value > 0 ? formatCurrency(c.value) : '_Valor não definido_';
      const dueDate = formatDate(c.due_date);
      msg += `${i + 1}️⃣ ${c.contribution_type?.name || 'Contribuição'}\n   📅 ${competence} | Venc: ${dueDate}\n   💰 ${value}\n\n`;
    });
    msg += `_Digite o número da contribuição desejada._`;
    return msg;
  },

  noOverdueContributions: `ℹ️ Não encontramos contribuições *vencidas* para esta empresa.

Se deseja gerar um novo boleto, selecione a opção "A vencer".

_Digite MENU para recomeçar._`,

  askNewDueDate: (currentDueDate: string) => `📅 Informe a *nova data de vencimento*:

Data atual: ${formatDate(currentDueDate)}

_Formato: DD/MM/AAAA (ex: 15/02/2025)_`,

  invalidDueDate: `❌ Data inválida.

A data deve ser uma data *futura* no formato DD/MM/AAAA.
_Exemplo: 15/02/2025_`,

  confirmBoleto: (data: {
    employerName: string;
    contributionType: string;
    competence: string;
    value: string;
    dueDate: string;
    isReissue: boolean;
  }) => `✅ *Confirmação do Boleto*

🏢 Empresa: *${data.employerName}*
📋 Tipo: *${data.contributionType}*
📅 Competência: *${data.competence}*
💰 Valor: *${data.value}*
📆 Vencimento: *${data.dueDate}*
${data.isReissue ? '🔄 _Segunda via_' : '🆕 _Novo boleto_'}

Confirma a geração do boleto?

1️⃣ *Confirmar*
2️⃣ *Cancelar*`,

  processing: `⏳ Gerando seu boleto, aguarde...`,

  boletoGenerated: (invoiceUrl: string, pixCode?: string) => `✅ *Boleto gerado com sucesso!*

🔗 *Link do boleto:*
${invoiceUrl}

${pixCode ? `📱 *Código PIX:*\n\`${pixCode}\`\n` : ''}
💡 Você pode pagar via boleto bancário ou PIX.

Obrigado por utilizar nosso serviço! 😊`,

  boletoError: (error: string) => `❌ *Erro ao gerar boleto*

${error}

Por favor, tente novamente ou entre em contato com o sindicato.

_Digite MENU para recomeçar._`,

  cancelled: `❌ Operação cancelada.

Se precisar de ajuda, digite *MENU* para recomeçar.`,

  sessionExpired: `⏰ *Sessão expirada*

Por favor, selecione novamente a opção de 2ª via de boleto no menu principal.`,

  invalidOption: `❌ Opção inválida.

Por favor, digite apenas o *número* da opção desejada.`,
};

// ==========================================
// FLOW STATE HANDLERS
// ==========================================

async function handleBoletoFlow(
  supabase: any,
  evolutionConfig: EvolutionConfig,
  clinicId: string,
  phone: string,
  messageText: string,
  session: BoletoSession
): Promise<{ response: string; newState?: BoletoState }> {
  const text = messageText.trim().toLowerCase();
  
  console.log(`[boleto-flow] State: ${session.state}, Message: "${messageText}"`);

  // Check for menu/restart command
  if (/^(menu|voltar|sair|cancelar)$/i.test(text)) {
    return { response: MESSAGES.cancelled, newState: 'FINISHED' };
  }

  switch (session.state) {
    case 'INIT':
    case 'SELECT_BOLETO_TYPE': {
      if (text === '1' || /a\s*vencer/i.test(text)) {
        await updateSession(supabase, session.id, { 
          state: 'WAITING_CNPJ', 
          boleto_type: 'a_vencer' 
        });
        return { response: MESSAGES.askCnpj, newState: 'WAITING_CNPJ' };
      } else if (text === '2' || /vencid[oa]/i.test(text)) {
        await updateSession(supabase, session.id, { 
          state: 'WAITING_CNPJ', 
          boleto_type: 'vencido' 
        });
        return { response: MESSAGES.askCnpj, newState: 'WAITING_CNPJ' };
      }
      return { response: MESSAGES.invalidOption };
    }

    case 'WAITING_CNPJ': {
      const cleanCnpj = messageText.replace(/\D/g, '');
      
      if (!validateCnpj(cleanCnpj)) {
        return { response: MESSAGES.invalidCnpj };
      }

      // Search for employer
      const { data: employer } = await supabase
        .from('employers')
        .select('id, name, cnpj, email, phone')
        .eq('clinic_id', clinicId)
        .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${formatCnpj(cleanCnpj)}`)
        .eq('is_active', true)
        .maybeSingle();

      if (!employer) {
        await logAction(supabase, session.id, clinicId, phone, 'cnpj_not_found', 
          { cnpj: cleanCnpj }, false, 'Employer not found');
        return { response: MESSAGES.employerNotFound(cleanCnpj) };
      }

      await updateSession(supabase, session.id, {
        state: 'CONFIRM_EMPLOYER',
        employer_id: employer.id,
        employer_cnpj: cleanCnpj,
        employer_name: employer.name,
        flow_context: { employer }
      });

      await logAction(supabase, session.id, clinicId, phone, 'employer_found', 
        { employer_id: employer.id, name: employer.name }, true);

      return { 
        response: MESSAGES.confirmEmployer(employer.name, cleanCnpj), 
        newState: 'CONFIRM_EMPLOYER' 
      };
    }

    case 'CONFIRM_EMPLOYER': {
      if (text === '1' || /^sim/i.test(text)) {
        if (session.boleto_type === 'vencido') {
          // Search for overdue contributions
          const today = new Date().toISOString().split('T')[0];
          const { data: contributions } = await supabase
            .from('employer_contributions')
            .select(`
              id, competence_month, competence_year, value, due_date, status,
              contribution_type:contribution_types(id, name)
            `)
            .eq('employer_id', session.employer_id)
            .eq('clinic_id', clinicId)
            .lt('due_date', today)
            .in('status', ['pending', 'overdue'])
            .order('due_date', { ascending: false })
            .limit(10);

          if (!contributions || contributions.length === 0) {
            return { response: MESSAGES.noOverdueContributions };
          }

          await updateSession(supabase, session.id, {
            state: 'SELECT_CONTRIBUTION',
            available_contributions: contributions
          });

          return { 
            response: MESSAGES.selectContribution(contributions), 
            newState: 'SELECT_CONTRIBUTION' 
          };
        } else {
          // New boleto - ask for contribution type
          const { data: types } = await supabase
            .from('contribution_types')
            .select('id, name')
            .eq('clinic_id', clinicId)
            .eq('is_active', true)
            .order('name');

          if (!types || types.length === 0) {
            return { 
              response: '❌ Nenhum tipo de contribuição cadastrado. Entre em contato com o sindicato.' 
            };
          }

          await updateSession(supabase, session.id, {
            state: 'SELECT_CONTRIBUTION_TYPE',
            flow_context: { ...session.flow_context, contribution_types: types }
          });

          return { 
            response: MESSAGES.selectContributionType(types), 
            newState: 'SELECT_CONTRIBUTION_TYPE' 
          };
        }
      } else if (text === '2' || /^n[aã]o/i.test(text)) {
        await updateSession(supabase, session.id, {
          state: 'WAITING_CNPJ',
          employer_id: null,
          employer_cnpj: null,
          employer_name: null
        });
        return { response: MESSAGES.askCnpj, newState: 'WAITING_CNPJ' };
      }
      return { response: MESSAGES.invalidOption };
    }

    case 'SELECT_CONTRIBUTION_TYPE': {
      const types = session.flow_context?.contribution_types || [];
      const optionNum = parseInt(text);
      
      if (isNaN(optionNum) || optionNum < 1 || optionNum > types.length) {
        return { response: MESSAGES.invalidOption };
      }

      const selectedType = types[optionNum - 1];
      await updateSession(supabase, session.id, {
        state: 'WAITING_COMPETENCE',
        contribution_type_id: selectedType.id,
        flow_context: { ...session.flow_context, selected_type: selectedType }
      });

      return { response: MESSAGES.askCompetence, newState: 'WAITING_COMPETENCE' };
    }

    case 'WAITING_COMPETENCE': {
      const competence = parseCompetence(messageText);
      
      if (!competence) {
        return { response: MESSAGES.invalidCompetence };
      }

      await updateSession(supabase, session.id, {
        state: 'WAITING_VALUE',
        competence_month: competence.month,
        competence_year: competence.year
      });

      return { response: MESSAGES.askValue, newState: 'WAITING_VALUE' };
    }

    case 'WAITING_VALUE': {
      const valueCents = parseCurrency(messageText);
      
      if (!valueCents) {
        return { response: MESSAGES.invalidValue };
      }

      // Calculate default due date (10 business days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const competence = `${monthNames[session.competence_month! - 1]}/${session.competence_year}`;

      await updateSession(supabase, session.id, {
        state: 'CONFIRM_BOLETO',
        value_cents: valueCents,
        new_due_date: dueDateStr
      });

      return { 
        response: MESSAGES.confirmBoleto({
          employerName: session.employer_name!,
          contributionType: session.flow_context?.selected_type?.name || 'Contribuição',
          competence: competence,
          value: formatCurrency(valueCents),
          dueDate: formatDate(dueDateStr),
          isReissue: false
        }), 
        newState: 'CONFIRM_BOLETO' 
      };
    }

    case 'SELECT_CONTRIBUTION': {
      const contributions = session.available_contributions || [];
      const optionNum = parseInt(text);
      
      if (isNaN(optionNum) || optionNum < 1 || optionNum > contributions.length) {
        return { response: MESSAGES.invalidOption };
      }

      const selected = contributions[optionNum - 1];
      
      // If contribution has no value, ask for it
      if (!selected.value || selected.value === 0) {
        await updateSession(supabase, session.id, {
          state: 'WAITING_VALUE',
          contribution_id: selected.id,
          contribution_type_id: selected.contribution_type?.id,
          competence_month: selected.competence_month,
          competence_year: selected.competence_year,
          flow_context: { ...session.flow_context, selected_contribution: selected }
        });

        return { response: MESSAGES.askValue, newState: 'WAITING_VALUE' };
      }

      // Has value - ask for new due date
      await updateSession(supabase, session.id, {
        state: 'WAITING_NEW_DUE_DATE',
        contribution_id: selected.id,
        contribution_type_id: selected.contribution_type?.id,
        competence_month: selected.competence_month,
        competence_year: selected.competence_year,
        value_cents: selected.value,
        flow_context: { ...session.flow_context, selected_contribution: selected }
      });

      return { 
        response: MESSAGES.askNewDueDate(selected.due_date), 
        newState: 'WAITING_NEW_DUE_DATE' 
      };
    }

    case 'WAITING_NEW_DUE_DATE': {
      const newDueDate = parseDate(messageText);
      
      if (!newDueDate) {
        return { response: MESSAGES.invalidDueDate };
      }

      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const competence = `${monthNames[session.competence_month! - 1]}/${session.competence_year}`;
      const typeName = session.flow_context?.selected_contribution?.contribution_type?.name || 'Contribuição';

      await updateSession(supabase, session.id, {
        state: 'CONFIRM_BOLETO',
        new_due_date: newDueDate
      });

      return { 
        response: MESSAGES.confirmBoleto({
          employerName: session.employer_name!,
          contributionType: typeName,
          competence: competence,
          value: formatCurrency(session.value_cents!),
          dueDate: formatDate(newDueDate),
          isReissue: true
        }), 
        newState: 'CONFIRM_BOLETO' 
      };
    }

    case 'CONFIRM_BOLETO': {
      if (text === '1' || /^confirm/i.test(text) || /^sim/i.test(text)) {
        await sendWhatsAppMessage(evolutionConfig, phone, MESSAGES.processing);
        
        try {
          const employer = session.flow_context?.employer;
          const isReissue = !!session.contribution_id;
          
          let contributionId = session.contribution_id;
          const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const typeName = session.flow_context?.selected_type?.name || 
                          session.flow_context?.selected_contribution?.contribution_type?.name || 
                          'Contribuição';
          const description = `${typeName} - ${monthNames[session.competence_month! - 1]}/${session.competence_year}`;

          if (isReissue) {
            // Cancel old invoice if exists (in Lytex)
            const oldContribution = session.flow_context?.selected_contribution;
            if (oldContribution?.lytex_invoice_id) {
              try {
                await cancelLytexInvoice(oldContribution.lytex_invoice_id);
              } catch (e) {
                console.error('[boleto-flow] Error cancelling old invoice:', e);
              }
            }

            // For reissue: UPDATE the existing contribution with new due_date
            // This avoids unique constraint violation on active_competence_key
            const { data: updatedContrib, error: updateError } = await supabase
              .from('employer_contributions')
              .update({
                due_date: session.new_due_date,
                value: session.value_cents, // In case value was also updated
                lytex_invoice_id: null, // Clear old Lytex data
                lytex_invoice_url: null,
                lytex_boleto_barcode: null,
                lytex_boleto_digitable_line: null,
                lytex_pix_code: null,
                lytex_pix_qrcode: null,
                status: 'pending',
                notes: (oldContribution?.notes || '') + ` | 2ª via emitida via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}`,
                portal_reissue_count: (oldContribution?.portal_reissue_count || 0) + 1
              })
              .eq('id', session.contribution_id)
              .select()
              .single();

            if (updateError) {
              console.error('[boleto-flow] Error updating contribution:', updateError);
              throw new Error('Erro ao atualizar contribuição');
            }
            
            contributionId = updatedContrib.id;
            console.log(`[boleto-flow] Updated contribution ${contributionId} with new due_date: ${session.new_due_date}`);
          } else {
            // Create new contribution (boleto a vencer)
            const { data: newContrib, error: newContribError } = await supabase
              .from('employer_contributions')
              .insert({
                employer_id: session.employer_id,
                clinic_id: clinicId,
                contribution_type_id: session.contribution_type_id,
                competence_month: session.competence_month,
                competence_year: session.competence_year,
                value: session.value_cents,
                due_date: session.new_due_date,
                status: 'pending',
                notes: 'Criado via WhatsApp',
                origin: 'whatsapp'
              })
              .select()
              .single();

            if (newContribError) {
              console.error('[boleto-flow] Error creating contribution:', newContribError);
              throw new Error('Erro ao criar contribuição');
            }
            contributionId = newContrib.id;
          }

          // Create invoice in Lytex
          const invoice = await createLytexInvoice({
            employer: {
              cnpj: session.employer_cnpj!,
              name: session.employer_name!,
              email: employer?.email,
              phone: employer?.phone
            },
            value: session.value_cents!,
            dueDate: session.new_due_date!,
            description: description,
            contributionId: contributionId!
          });

          // Update contribution with Lytex data
          await supabase
            .from('employer_contributions')
            .update({
              lytex_invoice_id: invoice._id,
              lytex_invoice_url: invoice.invoiceUrl,
              lytex_boleto_barcode: invoice.boleto?.barCode || null,
              lytex_boleto_digitable_line: invoice.boleto?.digitableLine || null,
              lytex_pix_code: invoice.pix?.code || null,
              lytex_pix_qrcode: invoice.pix?.qrCode || null,
            })
            .eq('id', contributionId);

          await logAction(supabase, session.id, clinicId, phone, 'boleto_generated', 
            { contribution_id: contributionId, is_reissue: isReissue }, 
            true, undefined, undefined, invoice, contributionId || undefined);

          await updateSession(supabase, session.id, { state: 'FINISHED' });

          return { 
            response: MESSAGES.boletoGenerated(invoice.invoiceUrl, invoice.pix?.code), 
            newState: 'FINISHED' 
          };
        } catch (error: any) {
          console.error('[boleto-flow] Error generating boleto:', error);
          
          await logAction(supabase, session.id, clinicId, phone, 'boleto_error', 
            { error: error.message }, false, error.message);

          return { response: MESSAGES.boletoError(error.message) };
        }
      } else if (text === '2' || /^cancel/i.test(text) || /^n[aã]o/i.test(text)) {
        await updateSession(supabase, session.id, { state: 'FINISHED' });
        return { response: MESSAGES.cancelled, newState: 'FINISHED' };
      }
      return { response: MESSAGES.invalidOption };
    }

    default:
      return { response: MESSAGES.welcome, newState: 'SELECT_BOLETO_TYPE' };
  }
}

// ==========================================
// MAIN HANDLER
// ==========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clinic_id, phone, message, evolution_config, action } = await req.json();

    if (!clinic_id || !phone) {
      return new Response(
        JSON.stringify({ error: 'clinic_id and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create session
    const session = await getOrCreateSession(supabase, clinic_id, phone);
    
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle initialization (when coming from main menu)
    if (action === 'start' || session.state === 'INIT') {
      await updateSession(supabase, session.id, { state: 'SELECT_BOLETO_TYPE' });
      
      if (evolution_config) {
        await sendWhatsAppMessage(evolution_config, phone, MESSAGES.welcome);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          response: MESSAGES.welcome,
          session_id: session.id,
          state: 'SELECT_BOLETO_TYPE'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process message through flow
    const result = await handleBoletoFlow(
      supabase,
      evolution_config,
      clinic_id,
      phone,
      message || '',
      session
    );

    // Send response via WhatsApp if config provided
    if (evolution_config && result.response) {
      await sendWhatsAppMessage(evolution_config, phone, result.response);
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: result.response,
        session_id: session.id,
        state: result.newState || session.state
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[boleto-flow] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
