import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ==========================================
// AI INTENT ANALYSIS - HUMANIZED AGENT
// ==========================================

interface IntentAnalysis {
  intent: 'new_boleto' | 'overdue_boleto' | 'check_status' | 'change_value' | 'resend_link' | 
          'help' | 'confirm' | 'deny' | 'cancel' | 'menu' | 'cnpj_input' | 'number_input' | 
          'date_input' | 'value_input' | 'competence_input' | 'batch_boleto' | 'unclear';
  confidence: number;
  extracted_cnpj?: string;
  extracted_value?: number;
  extracted_date?: string;
  extracted_competence?: { month: number; year: number };
  extracted_number?: number;
  humanized_response?: string;
  batch_items?: BatchBoletoItem[];
  // Detected contribution type from message context
  detected_contribution_type?: 'mensalidade' | 'taxa' | null;
}

// Interface para processamento em lote
interface BatchBoletoItem {
  cnpj: string;
  competence_month: number;
  competence_year: number;
  value_cents: number;
  contribution_type?: 'mensalidade' | 'taxa_mercados' | 'taxa_varejista' | 'taxa_indefinida';
}

// Mapeamento de tipos de contribuição por nome
const CONTRIBUTION_TYPE_MAP = {
  mensalidade: '124 - MENSALIDADE SINDICAL',
  taxa_mercados: '125 - TAXA NEGOCIAL (MERCADOS)',
   taxa_varejista: '126 - TAXA NEGOCIAL (COM VEREJ)'
 } as const;
 
 interface ButtonOption {
   id: string;
   text?: string;
   title?: string;
 }
 
 /**
  * Envia texto livre via Meta Cloud API.
  */
 async function sendMetaText(phone: string, text: string, explicitPhoneId?: string): Promise<boolean> {
   try {
     const PHONE_ID = explicitPhoneId || Deno.env.get('META_PHONE_NUMBER_ID') || "937233212814035";
     const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
     if (!PHONE_ID || !TOKEN) {
       console.error('[meta-text] Missing META_PHONE_NUMBER_ID or META_WHATSAPP_TOKEN');
       return false;
     }
     const digits = phone.replace(/\D/g, '');
     const to = digits.startsWith('55') ? digits : `55${digits}`;
     const r = await fetch(
       `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
       {
         method: 'POST',
         headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
           messaging_product: 'whatsapp',
           to,
           type: 'text',
           text: { body: text },
         }),
       }
     );
     if (!r.ok) {
       console.error('[meta-text] Meta error:', await r.text());
       return false;
     }
     return true;
   } catch (e) {
     console.error('[meta-text] Exception:', e);
     return false;
   }
 }
 
 /**
  * Envia botões interativos via Meta Cloud API.
  */
 async function sendMetaButtons(phone: string, title: string, description: string, buttons: ButtonOption[], footer?: string, explicitPhoneId?: string): Promise<boolean> {
    try {
     const PHONE_ID = explicitPhoneId || Deno.env.get('META_PHONE_NUMBER_ID') || "937233212814035";
      const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
      if (!PHONE_ID || !TOKEN) {
        console.error('[meta-buttons] Missing META_PHONE_NUMBER_ID or META_WHATSAPP_TOKEN');
        return false;
      }
  
      const digits = phone.replace(/\D/g, '');
      const to = digits.startsWith('55') ? digits : `55${digits}`;
  
       const cleanTitle = title.replace(/[\*_~`#]/g, '').trim().substring(0, 60);
       const cleanDescription = description.substring(0, 1024) || "Selecione uma opção abaixo:";
 
       const payload = {
         messaging_product: "whatsapp",
         recipient_type: "individual",
         to,
         type: "interactive",
         interactive: {
           type: "button",
           header: { type: "text", text: cleanTitle },
           body: { text: cleanDescription },
           ...(footer ? { footer: { text: footer.substring(0, 72) } } : {}),
           action: {
             buttons: buttons.slice(0, 3).map(b => ({
               type: "reply",
               reply: {
                 id: b.id,
                 title: (b.text || b.title || "").substring(0, 20)
               }
             }))
           }
         }
       };
  
      const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
  
       if (!r.ok) {
         const errorText = await r.text();
         console.error('[meta-buttons] Meta error:', errorText);
         return false;
       }
       return true;
     } catch (error) {
       console.error('[meta-buttons] Error in sendMetaButtons:', error);
       return false;
     }
 }
 
 async function analyzeUserIntent(
  message: string, 
  currentState: BoletoState,
  sessionContext: any
): Promise<IntentAnalysis> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    console.log("[boleto-flow] No OPENAI_API_KEY, using fallback intent analysis");
    return fallbackIntentAnalysis(message, currentState);
  }

  try {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const contextDescription = getStateDescription(currentState, sessionContext);
    
    const systemPrompt = `Você é um assistente inteligente que analisa mensagens de usuários em um fluxo de emissão de boletos sindicais via WhatsApp.

CONTEXTO ATUAL: ${contextDescription}

Seu trabalho é:
1. Entender a INTENÇÃO do usuário mesmo que ele escreva de forma informal ou fora do padrão
2. Extrair dados relevantes (CNPJ, valores, datas, competências, números de opção)
3. Sugerir uma resposta humanizada quando apropriado

EXEMPLOS DE MENSAGENS E INTENÇÕES:
- "boletos em aberto" / "pendencias da empresa" / "quero ver os boletos vencidos" → intent: overdue_boleto
- "preciso gerar novo boleto" / "boleto a vencer" / "criar boleto" → intent: new_boleto
- "preciso alterar o valor" / "mudar valor do boleto" / "valor errado" → intent: change_value
- "não recebi o link" / "manda de novo" / "cadê o boleto" / "link não chegou" → intent: resend_link
- "qual a situação" / "como está" / "verificar status" → intent: check_status
- "sim" / "isso" / "confirmo" / "correto" / "pode gerar" / "1" (em contexto de confirmação) → intent: confirm
- "não" / "errado" / "outro" / "2" (em contexto de confirmação) → intent: deny
- "sair" / "cancelar" / "desistir" → intent: cancel
- "menu" / "voltar" / "início" / "recomeçar" → intent: menu
- "ajuda" / "como funciona" / "não entendi" → intent: help
- Número de 14 dígitos → intent: cnpj_input, extracted_cnpj
- "R$ 150,00" / "150 reais" / "150,00" → intent: value_input, extracted_value (em centavos)
- "15/02/2025" / "quinze de fevereiro" → intent: date_input, extracted_date
- "janeiro/2025" / "01/2025" / "jan 2025" → intent: competence_input, extracted_competence
- "1" / "2" / "3" (seleção de opção) → intent: number_input, extracted_number
- MÚLTIPLOS CNPJs com competência e valor em lista → intent: batch_boleto
  Exemplo: "60.496.539/0001-05 mês 11/2025, mensalidade, valor 91,20" (várias linhas assim)

IMPORTANTE: Se a mensagem contiver MÚLTIPLOS CNPJs com valores, use intent: batch_boleto.
O fallback irá processar os itens individuais.

Responda APENAS em JSON válido:
{
  "intent": "string",
  "confidence": 0.0-1.0,
  "extracted_cnpj": "string ou null",
  "extracted_value": number_em_centavos ou null,
  "extracted_date": "YYYY-MM-DD ou null",
  "extracted_competence": {"month": 1-12, "year": 2020-2030} ou null,
  "extracted_number": number ou null,
  "humanized_response": "resposta empática opcional para contextos de dúvida/erro"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise esta mensagem: "${message}"` }
        ],
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "boleto_intent_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: { type: "string", enum: ["new_boleto", "overdue_boleto", "check_status", "change_value", "resend_link", "help", "confirm", "deny", "cancel", "menu", "cnpj_input", "number_input", "date_input", "value_input", "competence_input", "batch_boleto", "unclear"] },
                confidence: { type: "number" },
                extracted_cnpj: { type: ["string", "null"] },
                extracted_value: { type: ["number", "null"] },
                extracted_date: { type: ["string", "null"] },
                extracted_competence: {
                  type: ["object", "null"],
                  additionalProperties: false,
                  properties: {
                    month: { type: "number" },
                    year: { type: "number" }
                  },
                  required: ["month", "year"]
                },
                extracted_number: { type: ["number", "null"] },
                humanized_response: { type: ["string", "null"] },
                batch_items: {
                  type: ["array", "null"],
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      cnpj: { type: "string" },
                      competence_month: { type: "number" },
                      competence_year: { type: "number" },
                      value_cents: { type: "number" },
                      contribution_type: { type: ["string", "null"], enum: ["mensalidade", "taxa_mercados", "taxa_varejista", "taxa_indefinida", null] }
                    },
                    required: ["cnpj", "competence_month", "competence_year", "value_cents", "contribution_type"]
                  }
                },
                detected_contribution_type: { type: ["string", "null"], enum: ["mensalidade", "taxa", null] }
              },
              required: ["intent", "confidence", "extracted_cnpj", "extracted_value", "extracted_date", "extracted_competence", "extracted_number", "humanized_response", "batch_items", "detected_contribution_type"]
            }
          }
        },
      }),
    });

    if (!response.ok) {
      console.error("[boleto-flow] AI API error:", response.status);
      return fallbackIntentAnalysis(message, currentState);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("[boleto-flow] AI intent analysis:", parsed);
      return parsed as IntentAnalysis;
    }
    
    return fallbackIntentAnalysis(message, currentState);
  } catch (error) {
    console.error("[boleto-flow] AI intent analysis error:", error);
    return fallbackIntentAnalysis(message, currentState);
  }
}

function getStateDescription(state: BoletoState, context: any): string {
  const descriptions: Record<BoletoState, string> = {
    'INIT': 'Usuário acabou de entrar no fluxo de boletos',
    'SELECT_BOLETO_TYPE': 'Aguardando escolha: (1) boleto a vencer ou (2) boleto vencido',
    'WAITING_CNPJ': 'Aguardando o CNPJ da empresa',
    'CONFIRM_EMPLOYER': `Aguardando confirmação da empresa: ${context?.employer_name || 'N/A'}`,
    'SELECT_CONTRIBUTION_TYPE': 'Aguardando seleção do tipo de contribuição',
    'SELECT_TAXA_TYPE': 'Aguardando escolha do tipo de taxa (Mercados ou Varejista)',
    'SELECT_TAXA_TYPE_BATCH': 'Aguardando escolha do tipo de taxa para processamento em lote',
    'WAITING_COMPETENCE': 'Aguardando competência (mês/ano)',
    'WAITING_VALUE': 'Aguardando valor do boleto',
    'SELECT_CONTRIBUTION_YEAR': 'Aguardando seleção do ano das contribuições vencidas',
    'SELECT_CONTRIBUTION': 'Aguardando seleção de contribuição vencida',
    'WAITING_NEW_DUE_DATE': 'Aguardando nova data de vencimento',
    'CONFIRM_BOLETO': 'Aguardando confirmação final para gerar boleto',
    'FINISHED': 'Fluxo finalizado',
    'ERROR': 'Estado de erro'
  };
  return descriptions[state] || 'Estado desconhecido';
}

// ==========================================
// BATCH BOLETO DETECTION
// Detecta mensagens com múltiplos CNPJs + competência + valor
// Formato esperado: "CNPJ mês MM/YYYY, tipo, valor X"
// ==========================================
function parseBatchBoletoMessage(message: string): BatchBoletoItem[] {
  const items: BatchBoletoItem[] = [];
  
  // Divide mensagem em linhas
  const lines = message.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Detecta tipo de contribuição no contexto geral da mensagem
  const fullTextLower = message.toLowerCase();
  const hasMensalidade = /mensalidade/i.test(fullTextLower);
  const hasTaxa = /taxa/i.test(fullTextLower);
  
  // Padrão: CNPJ (com ou sem formatação) + mês MM/YYYY + opcional tipo + valor
  // Exemplos:
  // "60.496.539/0001-05 mês 11/2025, mensalidade, valor 91,20"
  // "48293454000124 mes 11/2025 taxa valor 212,80"
  const batchRegex = /(\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/]?\d{4}[-]?\d{2})\s*(?:m[eê]s)?\s*(\d{1,2})\s*[\/\-]\s*(\d{4})[,\s]*(?:mensalidade|taxa)?[,\s]*(?:valor)?\s*[R$\s]*(\d+(?:[.,]\d{1,2})?)/gi;
  
  for (const line of lines) {
    let match;
    // Reset regex lastIndex
    batchRegex.lastIndex = 0;
    
    // Detecta tipo específico na linha
    const lineLower = line.toLowerCase();
    const lineMensalidade = /mensalidade/i.test(lineLower);
    const lineTaxa = /taxa/i.test(lineLower);
    
    // Determina o tipo de contribuição
    let contribType: BatchBoletoItem['contribution_type'] = 'mensalidade';
    if (lineTaxa || (hasTaxa && !hasMensalidade && !lineMensalidade)) {
      contribType = 'taxa_indefinida'; // Será perguntado depois
    } else if (lineMensalidade || hasMensalidade) {
      contribType = 'mensalidade';
    }
    
    while ((match = batchRegex.exec(line)) !== null) {
      const cnpj = match[1].replace(/\D/g, '');
      const month = parseInt(match[2]);
      const year = parseInt(match[3]);
      const valueStr = match[4].replace('.', '').replace(',', '.');
      const valueCents = Math.round(parseFloat(valueStr) * 100);
      
      if (cnpj.length === 14 && month >= 1 && month <= 12 && valueCents > 0) {
        items.push({
          cnpj,
          competence_month: month,
          competence_year: year,
          value_cents: valueCents,
          contribution_type: contribType
        });
      }
    }
  }
  
  // Também tenta detectar quando usuário lista CNPJs um por linha após uma mensagem contexto
  // Ex: primeira msg: "Preciso dos boletos da mensalidade sindical do mes 11/2025 de:"
  //     depois: "CNPJ valor X"
  if (items.length === 0) {
    // Padrão simplificado: CNPJ + valor (competência já informada antes)
    const simpleRegex = /(\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/]?\d{4}[-]?\d{2})[,\s]*(?:m[eê]s)?\s*(?:(\d{1,2})\s*[\/\-]\s*(\d{4}))?[,\s]*(?:mensalidade|taxa)?[,\s]*(?:valor)?\s*[R$\s]*(\d+(?:[.,]\d{1,2})?)/gi;
    
    for (const line of lines) {
      simpleRegex.lastIndex = 0;
      let match;
      
      // Detecta tipo na linha
      const lineLower = line.toLowerCase();
      const lineMensalidade = /mensalidade/i.test(lineLower);
      const lineTaxa = /taxa/i.test(lineLower);
      
      let contribType: BatchBoletoItem['contribution_type'] = 'mensalidade';
      if (lineTaxa || (hasTaxa && !hasMensalidade && !lineMensalidade)) {
        contribType = 'taxa_indefinida';
      } else if (lineMensalidade || hasMensalidade) {
        contribType = 'mensalidade';
      }
      
      while ((match = simpleRegex.exec(line)) !== null) {
        const cnpj = match[1].replace(/\D/g, '');
        const month = match[2] ? parseInt(match[2]) : 0;
        const year = match[3] ? parseInt(match[3]) : 0;
        const valueStr = match[4].replace('.', '').replace(',', '.');
        const valueCents = Math.round(parseFloat(valueStr) * 100);
        
        if (cnpj.length === 14 && valueCents > 0) {
          items.push({
            cnpj,
            competence_month: month,
            competence_year: year,
            value_cents: valueCents,
            contribution_type: contribType
          });
        }
      }
    }
  }
  
  return items;
}

function fallbackIntentAnalysis(message: string, currentState: BoletoState): IntentAnalysis {
  const text = message.trim().toLowerCase();
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // ==========================================
  // BATCH DETECTION - Check for multiple CNPJs in message
  // ==========================================
  const batchItems = parseBatchBoletoMessage(message);
  if (batchItems.length >= 1) {
    console.log(`[boleto-flow] Detected batch boleto request with ${batchItems.length} items`);
    return { 
      intent: 'batch_boleto', 
      confidence: 0.95, 
      batch_items: batchItems 
    };
  }
  
  // Month names for detection
  const monthMap: Record<string, number> = {
    'janeiro': 1, 'jan': 1, 'fevereiro': 2, 'fev': 2, 'março': 3, 'marco': 3, 'mar': 3,
    'abril': 4, 'abr': 4, 'maio': 5, 'mai': 5, 'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7, 'agosto': 8, 'ago': 8, 'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10, 'novembro': 11, 'nov': 11, 'dezembro': 12, 'dez': 12
  };
  
  // Menu/Cancel commands
  if (/^(menu|reiniciar|voltar|inicio|comecar|começar)$/i.test(normalized)) {
    return { intent: 'menu', confidence: 1.0 };
  }
  if (/^(sair|cancelar|desistir)$/i.test(normalized)) {
    return { intent: 'cancel', confidence: 1.0 };
  }
  
  // Help
  if (/^(ajuda|help|como funciona|nao entendi|não entendi|\?)$/i.test(normalized)) {
    return { intent: 'help', confidence: 0.9 };
  }
  
  // ==========================================
  // DETECT CONTRIBUTION TYPE FROM MESSAGE
  // "mensalidade" → auto-select 124
  // "taxa" without "mensalidade" → ask which taxa
  // ==========================================
  const hasMensalidade = /mensalidade/i.test(normalized);
  const hasTaxa = /taxa/i.test(normalized);
  let detectedContribType: 'mensalidade' | 'taxa' | null = null;
  
  if (hasMensalidade) {
    detectedContribType = 'mensalidade';
  } else if (hasTaxa) {
    detectedContribType = 'taxa';
  }
  
  // ==========================================
  // IMPROVED: Detect "a vencer" anywhere in text
  // ==========================================
  if (/\ba\s*vencer\b/i.test(normalized) || /\bnovo\s*boleto\b/i.test(normalized) || 
      /\bgerar\s*boleto\b/i.test(normalized) || /\bcriar\s*boleto\b/i.test(normalized) || 
      /\bemitir\s*boleto\b/i.test(normalized) || hasMensalidade || hasTaxa) {
    
    // Try to extract competence from the same message
    let extractedComp: { month: number; year: number } | undefined;
    
    // Try month name + year pattern: "janeiro de 2026", "janeiro/2026", "janeiro 2026"
    for (const [name, num] of Object.entries(monthMap)) {
      const monthRegex = new RegExp(`${name}(?:\\s*(?:de|/|\\s)\\s*)(\\d{4})`, 'i');
      const monthMatch = normalized.match(monthRegex);
      if (monthMatch) {
        extractedComp = { month: num, year: parseInt(monthMatch[1]) };
        break;
      }
    }
    
    // Also try numeric pattern: "01/2026"
    if (!extractedComp) {
      const numericMatch = normalized.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/);
      if (numericMatch) {
        const m = parseInt(numericMatch[1]);
        const y = parseInt(numericMatch[2]);
        if (m >= 1 && m <= 12) {
          extractedComp = { month: m, year: y };
        }
      }
    }
    
    return { 
      intent: 'new_boleto', 
      confidence: 0.9,
      extracted_competence: extractedComp,
      detected_contribution_type: detectedContribType
    };
  }
  
  // ==========================================
  // IMPROVED: Detect competence mentions (even without explicit "boleto" keyword)
  // e.g., "a contribuição de janeiro de 2026"
  // ==========================================
  if (/contribui[çc][aã]o/i.test(normalized) || /competencia/i.test(normalized) || /periodo/i.test(normalized)) {
    let extractedComp: { month: number; year: number } | undefined;
    
    // Try month name patterns
    for (const [name, num] of Object.entries(monthMap)) {
      const monthRegex = new RegExp(`${name}(?:\\s*(?:de|/|\\s)\\s*)(\\d{4})`, 'i');
      const monthMatch = normalized.match(monthRegex);
      if (monthMatch) {
        extractedComp = { month: num, year: parseInt(monthMatch[1]) };
        break;
      }
    }
    
    // Numeric pattern
    if (!extractedComp) {
      const numericMatch = normalized.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/);
      if (numericMatch) {
        const m = parseInt(numericMatch[1]);
        const y = parseInt(numericMatch[2]);
        if (m >= 1 && m <= 12) {
          extractedComp = { month: m, year: y };
        }
      }
    }
    
    if (extractedComp) {
      // User mentioned contribution with competence - assume new boleto
      return { 
        intent: 'new_boleto', 
        confidence: 0.85,
        extracted_competence: extractedComp
      };
    }
  }
  
  // Natural language intents for boleto types
  if (/boleto.*vencid|pendencia|em\s*aberto|atrasad|divida|debito/i.test(normalized)) {
    return { intent: 'overdue_boleto', confidence: 0.85 };
  }
  if (/alterar\s*valor|mudar\s*valor|valor\s*errado|corrigir\s*valor/i.test(normalized)) {
    return { intent: 'change_value', confidence: 0.85 };
  }
  if (/nao\s*recebi|não\s*recebi|manda\s*de\s*novo|reenviar|cade\s*o\s*link|cadê\s*o\s*link|link\s*nao\s*chegou/i.test(normalized)) {
    return { intent: 'resend_link', confidence: 0.85 };
  }
  if (/status|situacao|situação|como\s*esta|verificar/i.test(normalized)) {
    return { intent: 'check_status', confidence: 0.8 };
  }
  
  // ==========================================
  // IMPROVED: Detect standalone competence (month + year in text)
  // even if not in WAITING_COMPETENCE state
  // ==========================================
  for (const [name, num] of Object.entries(monthMap)) {
    const monthRegex = new RegExp(`${name}(?:\\s*(?:de|/|\\s)\\s*)(\\d{4})`, 'i');
    const monthMatch = normalized.match(monthRegex);
    if (monthMatch) {
      return { 
        intent: 'competence_input', 
        confidence: 0.85, 
        extracted_competence: { month: num, year: parseInt(monthMatch[1]) }
      };
    }
  }
  
  // Confirmations/Denials
  if (/^(sim|s|yes|isso|confirmo|correto|certo|ok|pode|1)$/i.test(normalized) || 
      /pode\s*gerar|confirmar|ta\s*certo|tá\s*certo/i.test(normalized)) {
    return { intent: 'confirm', confidence: 0.9 };
  }
  if (/^(nao|não|n|no|errado|outro|2)$/i.test(normalized) || 
      /nao\s*e\s*essa|não\s*é\s*essa|empresa\s*errada/i.test(normalized)) {
    return { intent: 'deny', confidence: 0.9 };
  }
  
  // CNPJ detection
  const cnpjMatch = message.replace(/\D/g, '');
  if (cnpjMatch.length === 14) {
    return { intent: 'cnpj_input', confidence: 0.95, extracted_cnpj: cnpjMatch };
  }
  
  // Simple number (option selection)
  const numMatch = normalized.match(/^(\d+)$/);
  if (numMatch) {
    return { intent: 'number_input', confidence: 0.9, extracted_number: parseInt(numMatch[1]) };
  }
  
  // Value detection
  const valueMatch = normalized.match(/r?\$?\s*(\d+(?:[.,]\d{2})?)/);
  if (valueMatch && currentState === 'WAITING_VALUE') {
    const value = parseFloat(valueMatch[1].replace(',', '.'));
    return { intent: 'value_input', confidence: 0.85, extracted_value: Math.round(value * 100) };
  }
  
  // Date detection (DD/MM/YYYY)
  const dateMatch = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return { intent: 'date_input', confidence: 0.9, extracted_date: dateStr };
  }
  
  // Competence detection (numeric MM/YYYY)
  const compMatch = normalized.match(/(\d{1,2})[\/\-\s]*(\d{4})/);
  if (compMatch) {
    const month = parseInt(compMatch[1]);
    const year = parseInt(compMatch[2]);
    if (month >= 1 && month <= 12) {
      return { intent: 'competence_input', confidence: 0.85, extracted_competence: { month, year } };
    }
  }
  
  return { intent: 'unclear', confidence: 0.3 };
}

// ==========================================
// HUMANIZED MESSAGES
// ==========================================

const HUMANIZED_MESSAGES = {
  greeting: `👋 *Olá! Sou seu assistente para boletos.*

Posso te ajudar com:
• 📄 Gerar um *novo boleto* (a vencer)
• 🔄 Emitir *2ª via* de boleto vencido
• 🔍 Verificar *pendências* da empresa
• 📨 *Reenviar* link de boleto

Como posso te ajudar hoje?`,

  help: `❓ *Precisa de ajuda?*

Você pode me dizer de forma natural o que precisa, por exemplo:
• "Quero ver os boletos em aberto"
• "Preciso gerar um novo boleto"
• "Não recebi o link do boleto"
• "Qual a situação da empresa X?"

Selecione uma opção ou escreva o que precisa:

_Digite MENU a qualquer momento para recomeçar._`,

  understanding: (intent: string) => `✅ Entendi! Você quer ${intent}.\n\nVou te ajudar com isso...`,
  
  askCnpjFriendly: `📋 Para continuar, preciso do *CNPJ* da empresa.

Pode digitar só os números ou no formato com pontos e barras, como preferir! 😊`,

  clarification: `🤔 Não consegui entender completamente.

Pode reformular ou selecionar uma opção:

_Ou digite AJUDA para mais informações._`,

  resendLinkFlow: (employerName: string) => `📨 *Reenvio de Link*

Empresa: *${employerName}*

Vou buscar o boleto mais recente para reenviar o link.
Aguarde um momento... ⏳`,

  noRecentBoleto: `❌ Não encontrei boletos recentes para reenviar.

Deseja gerar um novo boleto?`,

  boletoResent: (url: string) => `✅ *Link reenviado com sucesso!*

🔗 Acesse seu boleto:
${url}

Posso ajudar com mais alguma coisa? 😊`,
};

// Estados do fluxo de boleto
type BoletoState = 
  | 'INIT'
  | 'SELECT_BOLETO_TYPE'        // (1) A vencer (2) Vencido
  | 'WAITING_CNPJ'              // Aguardando CNPJ
  | 'CONFIRM_EMPLOYER'          // Confirmação da empresa encontrada
  | 'SELECT_CONTRIBUTION_TYPE'  // Tipo de contribuição
  | 'SELECT_TAXA_TYPE'          // Escolher entre taxa mercados/varejista (fluxo individual)
  | 'SELECT_TAXA_TYPE_BATCH'    // Escolher entre taxa mercados/varejista (fluxo em lote)
  | 'WAITING_COMPETENCE'        // Competência (mês/ano)
  | 'WAITING_VALUE'             // Valor a recolher
  | 'SELECT_CONTRIBUTION_YEAR'  // Selecionar ano quando há muitas contribuições vencidas
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

  // Retry logic for transient errors (502, 503, 504)
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${LYTEX_API_URL}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(invoicePayload),
      });

      // Retry on transient server errors
      if (response.status >= 502 && response.status <= 504) {
        const errorText = await response.text();
        console.warn(`[boleto-flow] Lytex retornou ${response.status} (tentativa ${attempt}/${MAX_RETRIES}):`, errorText);
        lastError = new Error(`Lytex indisponível (${response.status})`);
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 2000; // 2s, 4s
          console.log(`[boleto-flow] Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

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
    } catch (err: any) {
      if (attempt >= MAX_RETRIES || (err.message && !err.message.includes('indisponível'))) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("Erro ao criar cobrança após múltiplas tentativas");
}

// ==========================================
// WHATSAPP MESSAGE SENDER
// ==========================================

function getWhazingSendUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.includes('/api/external/') || cleanBase.endsWith('/apioficial')) {
    return cleanBase;
  }
  return `${cleanBase}/apioficial`;
}

function isChatgooExternalUrl(baseUrl: string): boolean {
  return baseUrl.includes('/api/external/');
}

function getWhazingApiPlusUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.endsWith('/apioficial')) return cleanBase;
  if (cleanBase.includes('/api/external/')) {
    return `${cleanBase}/apioficial`;
  }
  return `${cleanBase}/apioficial`;
}

function buildWhazingTextPayload(baseUrl: string, phone: string, message: string): Record<string, unknown> {
  if (isChatgooExternalUrl(baseUrl)) {
    return { number: phone, body: message };
  }

  return {
    number: phone,
    contents: { type: 'text', body: { text: message } },
  };
}

function buildWhazingButtonPayload(baseUrl: string, phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Record<string, unknown> {
  return {
    number: phone,
    contents: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } }))
      }
    }
  };
}

function buildWhazingExternalButtonPayload(phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Record<string, unknown> {
  return {
    number: phone,
    body: bodyText,
    buttons: buttons.map(b => ({ id: b.id, title: b.title })),
  };
}

 async function sendWhatsAppMessage(
   config: EvolutionConfig,
   phone: string,
   message: string,
   explicitPhoneId?: string
 ): Promise<boolean> {
   try {
     if (config.api_url === 'meta') {
       console.log(`[boleto-flow] Routing text to Meta Cloud API for ${phone}`);
       return await sendMetaText(phone, message, explicitPhoneId);
     }
 
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[boleto-flow] Sending message to ${formattedPhone}`);

    const whazingSent = await sendWhazingText(formattedPhone, message);
    if (whazingSent) return true;

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
      // Fallback: try Whazing apioficial (text type) when Evolution fails
      const fallbackOk = await sendWhazingText(phone, message);
      if (fallbackOk) {
        console.log('[boleto-flow] Fallback via Whazing succeeded');
        return true;
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('[boleto-flow] Error sending WhatsApp:', error);
    const fallbackOk = await sendWhazingText(phone, message);
    if (fallbackOk) {
      console.log('[boleto-flow] Fallback via Whazing succeeded after exception');
      return true;
    }
    return false;
  }
}

// Send plain text via Whazing apioficial as fallback (handles cases where
// Evolution can't reach the contact - e.g. outside 24h window).
async function sendWhazingText(phone: string, message: string): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
  if (!whazingUrl || !whazingToken) {
    console.log('[boleto-flow] Whazing not configured, no text fallback available');
    return false;
  }
  try {
    let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
    const apiOficialUrl = getWhazingSendUrl(whazingUrl);
    console.log(`[boleto-flow] [whazing-text] Sending fallback text to ${cleanPhone}`);
    const response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify(buildWhazingTextPayload(whazingUrl, cleanPhone, message)),
    });
    const respText = await response.text();
    if (!response.ok) {
      console.error('[boleto-flow] [whazing-text] Error:', response.status, respText);
      return false;
    }
    console.log('[boleto-flow] [whazing-text] Sent successfully');
    return true;
  } catch (err) {
    console.error('[boleto-flow] [whazing-text] Exception:', err);
    return false;
  }
}

// ==========================================
// WHAZING INTERACTIVE BUTTONS FOR BOLETO FLOW
// ==========================================

async function sendBoletoButtons(
  phone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    console.log('[boleto-flow] Whazing not configured, skipping buttons');
    return false;
  }

  try {
    let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${whazingToken}`,
    };

    const apiOficialUrl = getWhazingApiPlusUrl(whazingUrl);
    console.log(`[boleto-flow] Sending ${buttons.length} buttons to ${cleanPhone} via API PLUS/native buttons`);

    let response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildWhazingButtonPayload(whazingUrl, cleanPhone, bodyText, buttons)),
    });

    let responseText = await response.text();
    if (!response.ok && isChatgooExternalUrl(whazingUrl)) {
      console.warn(`[boleto-flow] API PLUS failed (${response.status}); retrying external button endpoint`, responseText.substring(0, 300));
      response = await fetch(getWhazingSendUrl(whazingUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(buildWhazingExternalButtonPayload(cleanPhone, bodyText, buttons)),
      });
      responseText = await response.text();
    }

    if (!response.ok) {
      console.error('[boleto-flow] Whazing API error:', response.status, responseText);
      return false;
    }
    console.log('[boleto-flow] Buttons sent successfully');
    return true;
  } catch (error) {
    console.error('[boleto-flow] Error sending buttons:', error);
    return false;
  }
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

function getBrazilPhoneVariants(phone: string): string[] {
  const cleaned = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
  const withCountry = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  const variants = new Set<string>([withCountry]);
  const ddd = withCountry.slice(2, 4);
  const rest = withCountry.slice(4);

  if (rest.length === 8) variants.add(`55${ddd}9${rest}`);
  if (rest.length === 9 && rest.startsWith('9')) variants.add(`55${ddd}${rest.slice(1)}`);

  return Array.from(variants);
}

async function getOrCreateSession(
  supabase: any,
  clinicId: string,
  phone: string
): Promise<BoletoSession | null> {
  const phoneVariants = getBrazilPhoneVariants(phone);

  // Check for existing active session
  const { data: existingSession } = await supabase
    .from('whatsapp_boleto_sessions')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('phone', phoneVariants)
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
      phone: phoneVariants[0],
      state: 'INIT',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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

/**
 * Calcula a data de vencimento base para uma competência
 * Regra: Dia 10 do mês seguinte à competência
 * Se dia 10 for sábado ou domingo, move para próxima segunda-feira
 */
function calculateBaseDueDate(competenceMonth: number, competenceYear: number): string {
  // Mês seguinte à competência
  let dueMonth = competenceMonth + 1;
  let dueYear = competenceYear;
  
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  
  // Dia 10 do mês seguinte
  let dueDate = new Date(dueYear, dueMonth - 1, 10);
  
  // Verificar se é dia útil (não sábado nem domingo)
  const dayOfWeek = dueDate.getDay();
  
  if (dayOfWeek === 0) {
    // Domingo -> move para segunda (dia 11)
    dueDate.setDate(11);
  } else if (dayOfWeek === 6) {
    // Sábado -> move para segunda (dia 12)
    dueDate.setDate(12);
  }
  
  return dueDate.toISOString().split('T')[0];
}

function normalizeDateOnly(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;
  return dateValue.slice(0, 10);
}

function mustAskNewDueDate(params: {
  boletoType: 'a_vencer' | 'vencido' | null;
  status?: string | null;
  dueDate?: string | null;
}): boolean {
  const today = new Date().toISOString().split('T')[0];
  const dueDate = normalizeDateOnly(params.dueDate);
  const isOverdue = params.status === 'overdue' || (!!dueDate && dueDate < today);

  // Regra de negócio: só pedir nova data para vencidos (ou sem data definida)
  return params.boletoType === 'vencido' || isOverdue || !dueDate;
}

// ==========================================
// FLOW MESSAGES
// ==========================================

const MESSAGES = {
  welcome: `🏢 *2ª Via de Boleto Empresarial*

Vou te ajudar a emitir uma segunda via do boleto de contribuição.

O boleto é *a vencer* (novo) ou *vencido* (atualizar data)?`,

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

Esta é a empresa correta?`,

  selectContributionType: (types: Array<{ id: string; name: string }>) => {
    let msg = `📝 Qual o *tipo de contribuição*?\n\n`;
    types.forEach((t, i) => {
      msg += `• ${t.name}\n`;
    });
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
      msg += `• ${c.contribution_type?.name || 'Contribuição'}\n   📅 ${competence} | Venc: ${dueDate}\n   💰 ${value}\n\n`;
    });
    msg += `Selecione a contribuição desejada:`;
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

Confirma a geração do boleto?`,

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
// CNPJ INPUT HANDLER
// ==========================================

async function handleCnpjInput(
  supabase: any,
  session: BoletoSession,
  clinicId: string,
  phone: string,
  cnpjInput: string
): Promise<{ response: string; newState?: BoletoState }> {
  const cleanCnpj = cnpjInput.replace(/\D/g, '');
  
  if (!validateCnpj(cleanCnpj)) {
    return { 
      response: `❌ *CNPJ inválido*\n\nO número informado não parece ser um CNPJ válido.\n\nPor favor, verifique e digite novamente os *14 números* do CNPJ.\n\n_Exemplo: 12345678000199_` 
    };
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
    flow_context: { ...session.flow_context, employer }
  });

  await logAction(supabase, session.id, clinicId, phone, 'employer_found', 
    { employer_id: employer.id, name: employer.name }, true);

  // Check if in resend mode
  if (session.flow_context?.resend_mode) {
    // Look for recent boleto to resend
    const { data: recentContrib } = await supabase
      .from('employer_contributions')
      .select('id, lytex_invoice_url, lytex_pix_code, competence_month, competence_year, value, due_date')
      .eq('employer_id', employer.id)
      .eq('clinic_id', clinicId)
      .not('lytex_invoice_url', 'is', null)
      .in('status', ['pending', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentContrib?.lytex_invoice_url) {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const compStr = `${monthNames[recentContrib.competence_month - 1]}/${recentContrib.competence_year}`;
      
      await updateSession(supabase, session.id, { state: 'FINISHED' });
      
      return { 
        response: `✅ *Boleto Encontrado!*\n\n🏢 Empresa: *${employer.name}*\n📅 Competência: *${compStr}*\n💰 Valor: *${formatCurrency(recentContrib.value)}*\n📆 Vencimento: *${formatDate(recentContrib.due_date)}*\n\n🔗 *Link do boleto:*\n${recentContrib.lytex_invoice_url}\n\n${recentContrib.lytex_pix_code ? `📱 *PIX:* \`${recentContrib.lytex_pix_code}\`\n\n` : ''}Precisa de mais alguma coisa? Digite *MENU* para ver as opções. 😊`,
        newState: 'FINISHED' 
      };
    }
  }

  return { 
    response: `✅ *Empresa identificada!*\n\n🏢 *${employer.name}*\n📋 CNPJ: ${formatCnpj(cleanCnpj)}\n\nÉ essa a empresa correta?`, 
    newState: 'CONFIRM_EMPLOYER' 
  };
}

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
  const normalizedText = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  console.log(`[boleto-flow] State: ${session.state}, Message: "${messageText}"`);

  const buttonNumberMatch = messageText.match(/^boleto_(?:type|taxa|contrib|year)_(\d+)$/);
  const optionText = buttonNumberMatch ? buttonNumberMatch[1] : text;
  const isConfirmInput = /^(sim|s|yes|isso|confirmo|correto|certo|ok|pode|1)$/i.test(normalizedText);
  const isDenyInput = /^(nao|não|n|no|errado|outro|2)$/i.test(normalizedText);

  // FAST-PATH: CNPJ input must not wait for AI intent analysis.
  // The boleto flow was stopping here when OpenAI was slow/unavailable.
  if (session.state === 'WAITING_CNPJ') {
    const cleanCnpj = messageText.replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      return handleCnpjInput(supabase, session, clinicId, phone, cleanCnpj);
    }
  }

  // ==========================================
  // FAST-PATH: Interactive button IDs
  // When user taps a button, messageText is the button id (e.g. "boleto_a_vencer").
  // Bypass AI intent analysis to avoid misclassification (greeting/menu/help).
  // ==========================================
  if (session.state === 'INIT' || session.state === 'SELECT_BOLETO_TYPE') {
    if (messageText === 'boleto_a_vencer' || text === '1' || /a\s*vencer/i.test(normalizedText)) {
      await updateSession(supabase, session.id, {
        state: 'WAITING_CNPJ',
        boleto_type: 'a_vencer'
      });
      return { response: HUMANIZED_MESSAGES.askCnpjFriendly, newState: 'WAITING_CNPJ' };
    }
    if (messageText === 'boleto_vencido' || text === '2' || /vencid[oa]/i.test(normalizedText)) {
      await updateSession(supabase, session.id, {
        state: 'WAITING_CNPJ',
        boleto_type: 'vencido'
      });
      return { response: HUMANIZED_MESSAGES.askCnpjFriendly, newState: 'WAITING_CNPJ' };
    }
  }

  // Use deterministic local parsing after the flow has started.
  // Guided states must not depend on AI/network latency at every next step.
  const guidedStates: BoletoState[] = [
    'WAITING_CNPJ',
    'CONFIRM_EMPLOYER',
    'SELECT_CONTRIBUTION_TYPE',
    'SELECT_TAXA_TYPE',
    'SELECT_TAXA_TYPE_BATCH',
    'WAITING_COMPETENCE',
    'WAITING_VALUE',
    'SELECT_CONTRIBUTION_YEAR',
    'SELECT_CONTRIBUTION',
    'WAITING_NEW_DUE_DATE',
    'CONFIRM_BOLETO',
  ];
  const intent = guidedStates.includes(session.state)
    ? fallbackIntentAnalysis(messageText, session.state)
    : await analyzeUserIntent(messageText, session.state, {
        employer_name: session.employer_name,
        boleto_type: session.boleto_type,
        available_contributions: session.available_contributions?.length || 0
      });
  
  console.log(`[boleto-flow] AI Intent: ${intent.intent} (confidence: ${intent.confidence})`);

  // Handle global commands based on intent
  if (intent.intent === 'menu') {
    await updateSession(supabase, session.id, {
      state: 'SELECT_BOLETO_TYPE',
      employer_id: null,
      employer_cnpj: null,
      employer_name: null,
      contribution_id: null,
      contribution_type_id: null,
      competence_month: null,
      competence_year: null,
      value_cents: null,
      new_due_date: null,
      boleto_type: null,
      available_contributions: null,
      flow_context: null,
    });
    return { response: HUMANIZED_MESSAGES.greeting, newState: 'SELECT_BOLETO_TYPE' };
  }

  if (intent.intent === 'cancel') {
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    return { response: MESSAGES.cancelled, newState: 'FINISHED' };
  }

  if (intent.intent === 'help') {
    return { response: HUMANIZED_MESSAGES.help };
  }

  // ==========================================
  // BATCH BOLETO PROCESSING
  // Handle multiple CNPJs + competence + values in single message
  // ==========================================
  if (intent.intent === 'batch_boleto' && intent.batch_items && intent.batch_items.length > 0) {
    console.log(`[boleto-flow] Processing batch boleto with ${intent.batch_items.length} items`);
    
    // Check if any items have undefined tax type - need to ask user
    const hasUndefinedTaxa = intent.batch_items.some(item => item.contribution_type === 'taxa_indefinida');
    
    if (hasUndefinedTaxa) {
      // Store batch items in session and ask which tax type
      await updateSession(supabase, session.id, {
        state: 'SELECT_TAXA_TYPE_BATCH' as BoletoState,
        flow_context: { 
          ...session.flow_context, 
          pending_batch_items: intent.batch_items 
        }
      });
      
      return { 
        response: `📋 *Detectei ${intent.batch_items.length} boleto(s) para gerar*\n\nVocê mencionou *taxa*. Qual tipo de taxa deseja gerar?`,
        newState: 'SELECT_TAXA_TYPE_BATCH' as BoletoState
      };
    }
    
    await sendWhatsAppMessage(evolutionConfig, phone, `⏳ *Processando ${intent.batch_items.length} boleto(s)...*\n\nAguarde um momento.`);
    
    const results: Array<{ success: boolean; cnpj: string; employer_name?: string; url?: string; error?: string }> = [];
    
    // Fetch all contribution types we need
    const allowedNames = [
      CONTRIBUTION_TYPE_MAP.mensalidade,
      CONTRIBUTION_TYPE_MAP.taxa_mercados,
      CONTRIBUTION_TYPE_MAP.taxa_varejista
    ];
    
    const { data: allContribTypes } = await supabase
      .from('contribution_types')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .in('name', allowedNames);
    
    const contribTypesMap: Record<string, { id: string; name: string }> = {};
    for (const ct of allContribTypes || []) {
      if (ct.name === CONTRIBUTION_TYPE_MAP.mensalidade) contribTypesMap.mensalidade = ct;
      if (ct.name === CONTRIBUTION_TYPE_MAP.taxa_mercados) contribTypesMap.taxa_mercados = ct;
      if (ct.name === CONTRIBUTION_TYPE_MAP.taxa_varejista) contribTypesMap.taxa_varejista = ct;
    }
    
    for (const item of intent.batch_items) {
      try {
        // Find employer by CNPJ
        const { data: employer } = await supabase
          .from('employers')
          .select('id, name, cnpj, email, phone')
          .eq('clinic_id', clinicId)
          .or(`cnpj.eq.${item.cnpj},cnpj.eq.${formatCnpj(item.cnpj)}`)
          .eq('is_active', true)
          .maybeSingle();
        
        if (!employer) {
          results.push({ 
            success: false, 
            cnpj: formatCnpj(item.cnpj), 
            error: 'Empresa não encontrada' 
          });
          continue;
        }
        
        // Check if contribution already exists
        const { data: existingContrib } = await supabase
          .from('employer_contributions')
          .select('id, lytex_invoice_url, status')
          .eq('employer_id', employer.id)
          .eq('competence_month', item.competence_month)
          .eq('competence_year', item.competence_year)
          .neq('status', 'cancelled')
          .limit(1)
          .maybeSingle();
        
        if (existingContrib?.lytex_invoice_url && existingContrib.status !== 'paid') {
          // Already has boleto - return existing link
          results.push({ 
            success: true, 
            cnpj: formatCnpj(item.cnpj), 
            employer_name: employer.name,
            url: existingContrib.lytex_invoice_url 
          });
          continue;
        }
        
        // Calculate due date (10th of next month)
        const dueDate = calculateBaseDueDate(item.competence_month, item.competence_year);
        
        // Determine the correct contribution type based on item.contribution_type
        let selectedContribType = contribTypesMap.mensalidade; // default
        if (item.contribution_type === 'taxa_mercados') {
          selectedContribType = contribTypesMap.taxa_mercados;
        } else if (item.contribution_type === 'taxa_varejista') {
          selectedContribType = contribTypesMap.taxa_varejista;
        }
        
        // Create contribution record
        const { data: newContrib, error: contribError } = await supabase
          .from('employer_contributions')
          .insert({
            employer_id: employer.id,
            clinic_id: clinicId,
            contribution_type_id: selectedContribType?.id || null,
            competence_month: item.competence_month,
            competence_year: item.competence_year,
            value: item.value_cents,
            due_date: dueDate,
            status: 'pending',
            notes: 'Criado via WhatsApp (lote)',
            origin: 'manual'
          })
          .select()
          .single();
        
        if (contribError) {
          console.error(`[boleto-flow] Error creating contribution for ${item.cnpj}:`, contribError);
          results.push({ 
            success: false, 
            cnpj: formatCnpj(item.cnpj), 
            employer_name: employer.name,
            error: 'Erro ao criar contribuição' 
          });
          continue;
        }
        
        // Create invoice in Lytex
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const description = `${selectedContribType?.name || 'Mensalidade Sindical'} - ${monthNames[item.competence_month - 1]}/${item.competence_year}`;
        
        try {
          const invoice = await createLytexInvoice({
            employer: {
              cnpj: item.cnpj,
              name: employer.name,
              email: employer.email,
              phone: employer.phone
            },
            value: item.value_cents,
            dueDate: dueDate,
            description: description,
            contributionId: newContrib.id
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
            .eq('id', newContrib.id);
          
          results.push({ 
            success: true, 
            cnpj: formatCnpj(item.cnpj), 
            employer_name: employer.name,
            url: invoice.invoiceUrl 
          });
          
        } catch (lytexError: any) {
          console.error(`[boleto-flow] Lytex error for ${item.cnpj}:`, lytexError);
          results.push({ 
            success: false, 
            cnpj: formatCnpj(item.cnpj), 
            employer_name: employer.name,
            error: lytexError.message || 'Erro ao gerar boleto' 
          });
        }
        
      } catch (error: any) {
        console.error(`[boleto-flow] Error processing batch item ${item.cnpj}:`, error);
        results.push({ 
          success: false, 
          cnpj: formatCnpj(item.cnpj), 
          error: error.message || 'Erro inesperado' 
        });
      }
    }
    
    // Build response message
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    let responseMsg = `✅ *Processamento Concluído!*\n\n`;
    responseMsg += `📊 ${successCount} boleto(s) gerado(s)`;
    if (errorCount > 0) {
      responseMsg += ` | ${errorCount} erro(s)`;
    }
    responseMsg += `\n\n`;
    
    // List successful boletos
    const successResults = results.filter(r => r.success);
    if (successResults.length > 0) {
      responseMsg += `*Boletos Gerados:*\n`;
      for (const r of successResults) {
        responseMsg += `\n🏢 *${r.employer_name || r.cnpj}*\n`;
        responseMsg += `📋 ${r.cnpj}\n`;
        responseMsg += `🔗 ${r.url}\n`;
      }
    }
    
    // List errors
    const errorResults = results.filter(r => !r.success);
    if (errorResults.length > 0) {
      responseMsg += `\n*Erros:*\n`;
      for (const r of errorResults) {
        responseMsg += `❌ ${r.cnpj}: ${r.error}\n`;
      }
    }
    
    responseMsg += `\n_Digite MENU para mais opções._`;
    
    await logAction(supabase, session.id, clinicId, phone, 'batch_boleto_generated', 
      { items_count: intent.batch_items.length, success_count: successCount, error_count: errorCount }, 
      successCount > 0);
    
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    
    return { response: responseMsg, newState: 'FINISHED' };
  }

  // Handle natural language intents at INIT or SELECT_BOLETO_TYPE
  if (session.state === 'INIT' || session.state === 'SELECT_BOLETO_TYPE') {
    // Handle resend link request
    if (intent.intent === 'resend_link' || intent.intent === 'check_status') {
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CNPJ', 
        boleto_type: 'vencido',
        flow_context: { ...session.flow_context, resend_mode: true }
      });
      return { 
        response: `📨 *Reenvio/Consulta de Boleto*\n\n${HUMANIZED_MESSAGES.askCnpjFriendly}`, 
        newState: 'WAITING_CNPJ' 
      };
    }

    // Handle change value request
    if (intent.intent === 'change_value') {
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CNPJ', 
        boleto_type: 'vencido',
        flow_context: { ...session.flow_context, change_value_mode: true }
      });
      return { 
        response: `💰 *Alteração de Valor*\n\nVou te ajudar a alterar o valor do boleto.\n\n${HUMANIZED_MESSAGES.askCnpjFriendly}`, 
        newState: 'WAITING_CNPJ' 
      };
    }

    // ==========================================
    // IMPROVED: Handle competence with new_boleto intent FIRST
    // User wrote something like "a contribuição de janeiro de 2026"
    // Also detect contribution type (mensalidade/taxa)
    // ==========================================
    if (intent.intent === 'new_boleto' && intent.extracted_competence) {
      // User provided competence upfront - save it and ask for CNPJ
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const compStr = `${monthNames[intent.extracted_competence.month - 1]}/${intent.extracted_competence.year}`;
      
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CNPJ', 
        boleto_type: 'a_vencer',
        competence_month: intent.extracted_competence.month,
        competence_year: intent.extracted_competence.year,
        flow_context: { 
          ...session.flow_context, 
          competence_provided_upfront: true,
          detected_contribution_type: intent.detected_contribution_type || null
        }
      });
      
      let responseText = `✅ *Entendido!* Boleto a vencer para *${compStr}*`;
      if (intent.detected_contribution_type === 'mensalidade') {
        responseText += ` (Mensalidade Sindical)`;
      } else if (intent.detected_contribution_type === 'taxa') {
        responseText += ` (Taxa)`;
      }
      responseText += `.\n\n${HUMANIZED_MESSAGES.askCnpjFriendly}`;
      
      return { 
        response: responseText, 
        newState: 'WAITING_CNPJ' 
      };
    }

    // Handle standalone competence input (user just typed month/year)
    if (intent.intent === 'competence_input' && intent.extracted_competence) {
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const compStr = `${monthNames[intent.extracted_competence.month - 1]}/${intent.extracted_competence.year}`;
      
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CNPJ', 
        boleto_type: 'a_vencer',
        competence_month: intent.extracted_competence.month,
        competence_year: intent.extracted_competence.year,
        flow_context: { ...session.flow_context, competence_provided_upfront: true }
      });
      
      return { 
        response: `✅ *Competência: ${compStr}*\n\nVou gerar um boleto para esse período.\n\n${HUMANIZED_MESSAGES.askCnpjFriendly}`, 
        newState: 'WAITING_CNPJ' 
      };
    }

     // Handle boleto types (with explicit check for button IDs or natural language)
     if (intent.intent === 'new_boleto' || text === '1' || /a\s*vencer/i.test(text) || messageText === 'boleto_a_vencer') {
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CNPJ', 
        boleto_type: 'a_vencer' 
      });
      return { response: HUMANIZED_MESSAGES.askCnpjFriendly, newState: 'WAITING_CNPJ' };
    }
    
     if (intent.intent === 'overdue_boleto' || text === '2' || /vencid[oa]/i.test(text) || messageText === 'boleto_vencido') {
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CNPJ', 
        boleto_type: 'vencido' 
      });
      return { response: HUMANIZED_MESSAGES.askCnpjFriendly, newState: 'WAITING_CNPJ' };
    }

    // If CNPJ was provided directly, process it
    if (intent.intent === 'cnpj_input' && intent.extracted_cnpj) {
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CNPJ', 
        boleto_type: 'vencido' // Default to checking overdue when CNPJ provided directly
      });
      // Re-process with CNPJ
      return handleCnpjInput(supabase, session, clinicId, phone, intent.extracted_cnpj);
    }

    // Unclear intent - show friendly help
    if (intent.confidence < 0.5) {
      return { response: HUMANIZED_MESSAGES.clarification };
    }
    
    return { response: HUMANIZED_MESSAGES.greeting };
  }

  // Continue with state-specific handling, using extracted data when available
  switch (session.state) {
    case 'WAITING_CNPJ': {
      // Use extracted CNPJ from AI or parse from message
      const cnpjToUse = intent.extracted_cnpj || messageText.replace(/\D/g, '');
      return handleCnpjInput(supabase, session, clinicId, phone, cnpjToUse);
    }

    case 'CONFIRM_EMPLOYER': {
      if (messageText.startsWith('boleto_') && messageText !== 'boleto_sim' && messageText !== 'boleto_nao') {
        console.log(`[boleto-flow] Ignoring stale boleto button ${messageText} in state ${session.state}`);
        return { response: '', newState: session.state };
      }

      const repeatedCnpj = messageText.replace(/\D/g, '');
      if (repeatedCnpj.length === 14) {
        return handleCnpjInput(supabase, session, clinicId, phone, repeatedCnpj);
      }

      // Use AI intent for natural confirmations
      const isConfirm = messageText === 'boleto_sim' || intent.intent === 'confirm' || isConfirmInput;
      const isDeny = messageText === 'boleto_nao' || intent.intent === 'deny' || isDenyInput;
      
      if (isConfirm) {
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
            .limit(20);

          if (!contributions || contributions.length === 0) {
            return { 
              response: `ℹ️ *Nenhuma pendência encontrada!*\n\nNão encontramos contribuições vencidas para *${session.employer_name}*.\n\n✨ Ótimo! A empresa está em dia.\n\nSe deseja gerar um novo boleto, digite *MENU* e escolha a opção 1.` 
            };
          }

          // If more than 3 contributions, group by year and show year selection first
          if (contributions.length > 3) {
            const years = ([...new Set(contributions.map((c: any) => c.competence_year))] as number[]).sort((a, b) => b - a);
            
            await updateSession(supabase, session.id, {
              state: 'SELECT_CONTRIBUTION_YEAR' as BoletoState,
              available_contributions: contributions,
              flow_context: { 
                ...session.flow_context, 
                available_years: years,
                all_contributions: contributions
              }
            });

            let msg = `📋 *Contribuições Pendentes*\n\n`;
            msg += `Encontramos *${contributions.length}* contribuições vencidas distribuídas em *${years.length}* ano(s).\n\n`;
            msg += `Selecione o *ano* para ver as contribuições:\n\n`;
            years.forEach((y, i) => {
              const count = contributions.filter((c: any) => c.competence_year === y).length;
              msg += `${i + 1}. *${y}* (${count} contribuição${count > 1 ? 'ões' : ''})\n`;
            });

            return { 
              response: msg, 
              newState: 'SELECT_CONTRIBUTION_YEAR' as BoletoState
            };
          }

          // 3 or fewer - show directly
          await updateSession(supabase, session.id, {
            state: 'SELECT_CONTRIBUTION',
            available_contributions: contributions
          });

          return { 
            response: `📋 *Contribuições Pendentes*\n\nEncontramos ${contributions.length} contribuição(ões) vencida(s):\n\n${MESSAGES.selectContribution(contributions)}`, 
            newState: 'SELECT_CONTRIBUTION' 
          };
        } else {
          // New boleto - check if contribution type was detected from message
          const detectedType = session.flow_context?.detected_contribution_type;
          
          if (detectedType === 'mensalidade') {
            // Auto-select mensalidade sindical (124)
            const { data: mensalidadeType } = await supabase
              .from('contribution_types')
              .select('id, name')
              .eq('clinic_id', clinicId)
              .eq('is_active', true)
              .eq('name', CONTRIBUTION_TYPE_MAP.mensalidade)
              .single();
            
            if (mensalidadeType) {
              // Check if competence was provided
              if (session.flow_context?.competence_provided_upfront && session.competence_month && session.competence_year) {
                const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const compStr = `${monthNames[session.competence_month - 1]}/${session.competence_year}`;
                
                await updateSession(supabase, session.id, {
                  state: 'WAITING_VALUE',
                  contribution_type_id: mensalidadeType.id,
                  flow_context: { ...session.flow_context, selected_type: mensalidadeType }
                });

                return { 
                  response: `✅ *${mensalidadeType.name}*\n📅 Competência: *${compStr}*\n\n💰 Agora informe o *valor* a recolher:\n\n_Exemplo: 150,00 ou R$ 150,00_`, 
                  newState: 'WAITING_VALUE' 
                };
              }
              
              // Ask for competence
              await updateSession(supabase, session.id, {
                state: 'WAITING_COMPETENCE',
                contribution_type_id: mensalidadeType.id,
                flow_context: { ...session.flow_context, selected_type: mensalidadeType }
              });

              return { 
                response: `✅ *${mensalidadeType.name}*\n\n📅 Agora informe a *competência* (período) do boleto:\n\n_Exemplos: 01/2025, Janeiro/2025, jan/2025_`, 
                newState: 'WAITING_COMPETENCE' 
              };
            }
          } else if (detectedType === 'taxa') {
            // Ask which taxa type (mercados or varejista)
            await updateSession(supabase, session.id, {
              state: 'SELECT_TAXA_TYPE',
              flow_context: { ...session.flow_context }
            });

            return { 
              response: `📋 *Tipo de Taxa*\n\nQual tipo de taxa deseja gerar?`, 
              newState: 'SELECT_TAXA_TYPE' 
            };
          }
          
          // Default flow - show all contribution type options
          const allowedNames = [
            '124 - MENSALIDADE SINDICAL',
            '125 - TAXA NEGOCIAL (MERCADOS)',
            '126 - TAXA NEGOCIAL (COM VEREJ)'
          ];
          
          const { data: allTypes } = await supabase
            .from('contribution_types')
            .select('id, name')
            .eq('clinic_id', clinicId)
            .eq('is_active', true)
            .in('name', allowedNames);
          const types = allTypes || [];

          if (!types || types.length === 0) {
            return { 
              response: '❌ Nenhum tipo de contribuição disponível no momento.\n\nEntre em contato com o sindicato para mais informações.' 
            };
          }

          await updateSession(supabase, session.id, {
            state: 'SELECT_CONTRIBUTION_TYPE',
            flow_context: { ...session.flow_context, contribution_types: types }
          });

          return { 
            response: `📝 *Tipo de Contribuição*\n\nQual contribuição deseja gerar?\n\n${MESSAGES.selectContributionType(types)}`, 
            newState: 'SELECT_CONTRIBUTION_TYPE' 
          };
        }
      } else if (isDeny) {
        await updateSession(supabase, session.id, {
          state: 'WAITING_CNPJ',
          employer_id: null,
          employer_cnpj: null,
          employer_name: null
        });
        return { response: `Ok! Vamos tentar novamente.\n\n${HUMANIZED_MESSAGES.askCnpjFriendly}`, newState: 'WAITING_CNPJ' };
      }
      
      // Unclear response
      return { 
        response: `🤔 Não consegui entender sua resposta.\n\nA empresa *${session.employer_name}* está correta?` 
      };
    }

    case 'SELECT_CONTRIBUTION_TYPE': {
      if (messageText.startsWith('boleto_') && !/^boleto_type_\d+$/.test(messageText)) {
        console.log(`[boleto-flow] Ignoring stale boleto button ${messageText} in state ${session.state}`);
        return { response: '', newState: session.state };
      }

      const types = session.flow_context?.contribution_types || [];
      // Use AI-extracted number or parse from text
      const optionNum = parseInt(optionText) || intent.extracted_number || parseInt(text);
      
      if (isNaN(optionNum) || optionNum < 1 || optionNum > types.length) {
        return { 
          response: `❌ Opção inválida.\n\nPor favor, escolha um número de 1 a ${types.length}.` 
        };
      }

      const selectedType = types[optionNum - 1];
      
      // ==========================================
      // IMPROVED: If competence was provided upfront, skip to value
      // ==========================================
      if (session.flow_context?.competence_provided_upfront && session.competence_month && session.competence_year) {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const compStr = `${monthNames[session.competence_month - 1]}/${session.competence_year}`;
        
        await updateSession(supabase, session.id, {
          state: 'WAITING_VALUE',
          contribution_type_id: selectedType.id,
          flow_context: { ...session.flow_context, selected_type: selectedType }
        });

        return { 
          response: `✅ *${selectedType.name}*\n📅 Competência: *${compStr}*\n\n💰 Agora informe o *valor* a recolher:\n\n_Exemplo: 150,00 ou R$ 150,00_`, 
          newState: 'WAITING_VALUE' 
        };
      }
      
      // Normal flow - ask for competence
      await updateSession(supabase, session.id, {
        state: 'WAITING_COMPETENCE',
        contribution_type_id: selectedType.id,
        flow_context: { ...session.flow_context, selected_type: selectedType }
      });

      return { 
        response: `✅ *${selectedType.name}*\n\n📅 Agora informe a *competência* (período) do boleto:\n\n_Exemplos: 01/2025, Janeiro/2025, jan/2025_`, 
        newState: 'WAITING_COMPETENCE' 
      };
    }

    case 'WAITING_COMPETENCE': {
      // Use AI-extracted competence or parse manually
      const competence = intent.extracted_competence || parseCompetence(messageText);
      
      if (!competence) {
        return { 
          response: `❌ Não consegui entender a competência.\n\nPor favor, informe no formato *mês/ano*.\n\n_Exemplos: 01/2025, Janeiro/2025, jan/2025_` 
        };
      }

      // Check if there's already a pending contribution for this employer/type/competence
      const { data: existingContribution } = await supabase
        .from('employer_contributions')
        .select('id, value, due_date, status, lytex_invoice_url')
        .eq('employer_id', session.employer_id)
        .eq('contribution_type_id', session.contribution_type_id)
        .eq('competence_month', competence.month)
        .eq('competence_year', competence.year)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingContribution) {
        // Contribution already exists
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const compStr = `${monthNames[competence.month - 1]}/${competence.year}`;
        
        if (existingContribution.status === 'paid') {
          return { 
            response: `✅ *Contribuição já quitada!*\n\nA contribuição de *${compStr}* já foi paga.\n\nDigite *MENU* para recomeçar.`,
            newState: 'FINISHED'
          };
        }
        
        // Pending contribution exists - check if it has value
        if (existingContribution.value && existingContribution.value > 0) {
          // Has value and URL - offer to resend
          if (existingContribution.lytex_invoice_url) {
            return { 
              response: `⚠️ *Contribuição já cadastrada!*\n\nJá existe um boleto para *${compStr}* no valor de *${formatCurrency(existingContribution.value)}*.\n\n🔗 Link: ${existingContribution.lytex_invoice_url}\n\nSe precisar de uma 2ª via com nova data, escolha a opção *2 (Vencido)* no menu inicial.\n\nDigite *MENU* para recomeçar.`,
              newState: 'FINISHED'
            };
          }
          
          // Has value but no URL - if already has valid due date and is not overdue, preserve existing due date
          const preservedDueDate = normalizeDateOnly(existingContribution.due_date);
          const askNewDueDate = mustAskNewDueDate({
            boletoType: session.boleto_type,
            status: existingContribution.status,
            dueDate: preservedDueDate,
          });

          if (askNewDueDate) {
            await updateSession(supabase, session.id, {
              state: 'WAITING_NEW_DUE_DATE',
              contribution_id: existingContribution.id,
              competence_month: competence.month,
              competence_year: competence.year,
              value_cents: existingContribution.value,
              flow_context: { 
                ...session.flow_context, 
                selected_contribution: existingContribution,
                using_existing: true
              }
            });

            return { 
              response: `📋 *Contribuição já cadastrada!*\n\nJá existe uma contribuição para *${compStr}* no valor de *${formatCurrency(existingContribution.value)}* aguardando geração do boleto.\n\nVamos gerar o boleto agora!\n\n📅 Informe a *data de vencimento* desejada:\n\n_Exemplo: 15/02/2025_`,
              newState: 'WAITING_NEW_DUE_DATE'
            };
          }

          await updateSession(supabase, session.id, {
            state: 'CONFIRM_BOLETO',
            contribution_id: existingContribution.id,
            competence_month: competence.month,
            competence_year: competence.year,
            value_cents: existingContribution.value,
            new_due_date: preservedDueDate,
            flow_context: { 
              ...session.flow_context, 
              selected_contribution: existingContribution,
              using_existing: true
            }
          });

          return {
            response: MESSAGES.confirmBoleto({
              employerName: session.employer_name!,
              contributionType: session.flow_context?.selected_type?.name || 'Contribuição',
              competence: compStr,
              value: formatCurrency(existingContribution.value),
              dueDate: formatDate(preservedDueDate!),
              isReissue: true,
            }),
            newState: 'CONFIRM_BOLETO',
          };
        } else {
          // Exists but has no value - redirect to fill value for existing contribution
          await updateSession(supabase, session.id, {
            state: 'WAITING_VALUE',
            contribution_id: existingContribution.id,
            competence_month: competence.month,
            competence_year: competence.year,
            flow_context: { 
              ...session.flow_context, 
              selected_contribution: existingContribution,
              using_existing: true
            }
          });

          return { 
            response: `📋 *Contribuição já cadastrada!*\n\nJá existe uma contribuição para *${compStr}* aguardando o valor.\n\n💰 Informe o *valor* a recolher:\n\n_Exemplo: 150,00 ou R$ 150,00_`,
            newState: 'WAITING_VALUE'
          };
        }
      }

      // No existing contribution - proceed normally
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

      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const competence = `${monthNames[session.competence_month! - 1]}/${session.competence_year}`;

      // Check if this is a reissue (existing contribution) or new boleto
      const isReissue = !!session.contribution_id || session.flow_context?.using_existing;
      
      let dueDateStr: string;
      
      if (isReissue) {
        let existingDueDate = normalizeDateOnly(session.flow_context?.selected_contribution?.due_date);
        let existingStatus = session.flow_context?.selected_contribution?.status || null;

        // Fallback: ensure latest due_date/status from database
        if (session.contribution_id && (!existingDueDate || !existingStatus)) {
          const { data: existingContribution } = await supabase
            .from('employer_contributions')
            .select('due_date, status')
            .eq('id', session.contribution_id)
            .maybeSingle();

          if (existingContribution) {
            existingDueDate = normalizeDateOnly(existingContribution.due_date);
            existingStatus = existingContribution.status;
          }
        }

        const askNewDueDate = mustAskNewDueDate({
          boletoType: session.boleto_type,
          status: existingStatus,
          dueDate: existingDueDate,
        });

        if (askNewDueDate) {
          await updateSession(supabase, session.id, {
            state: 'WAITING_NEW_DUE_DATE',
            value_cents: valueCents,
          });

          return { 
            response: `💰 Valor: *${formatCurrency(valueCents)}*\n\n📅 Agora informe a *data de vencimento* desejada:\n\n_Exemplo: 15/02/2025_`,
            newState: 'WAITING_NEW_DUE_DATE'
          };
        }

        dueDateStr = existingDueDate!;
      } else {
        // For new "a vencer" boleto - calculate automatic due date based on competence
        // Rule: Day 10 of the month following competence (or next business day)
        dueDateStr = calculateBaseDueDate(session.competence_month!, session.competence_year!);
      }

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
          isReissue: isReissue
        }), 
        newState: 'CONFIRM_BOLETO' 
      };
    }

    case 'SELECT_CONTRIBUTION_YEAR': {
      if (messageText.startsWith('boleto_') && !/^boleto_year_\d+$/.test(messageText)) {
        console.log(`[boleto-flow] Ignoring stale boleto button ${messageText} in state ${session.state}`);
        return { response: '', newState: session.state };
      }

      const years = session.flow_context?.available_years || [];
      const allContributions = session.flow_context?.all_contributions || session.available_contributions || [];
      const optionNum = parseInt(optionText) || intent.extracted_number || parseInt(text);
      
      if (isNaN(optionNum) || optionNum < 1 || optionNum > years.length) {
        return { 
          response: `❌ Opção inválida.\n\nPor favor, escolha um número de 1 a ${years.length}.` 
        };
      }

      const selectedYear = years[optionNum - 1];
      const yearContribs = allContributions.filter((c: any) => c.competence_year === selectedYear);
      
      // If this year has more than 3, paginate
      const page = 0;
      const pageSize = 3;
      const pageContribs = yearContribs.slice(page * pageSize, (page + 1) * pageSize);
      const hasMore = yearContribs.length > pageSize;
      
      await updateSession(supabase, session.id, {
        state: 'SELECT_CONTRIBUTION',
        available_contributions: pageContribs,
        flow_context: { 
          ...session.flow_context, 
          selected_year: selectedYear,
          year_contributions: yearContribs,
          current_page: page,
          page_size: pageSize
        }
      });

      let msg = `📋 *Contribuições Vencidas - ${selectedYear}*\n\n`;
      msg += `${yearContribs.length} contribuição(ões) encontrada(s)`;
      if (hasMore) {
        msg += ` (mostrando ${pageContribs.length} de ${yearContribs.length})`;
      }
      msg += `:\n\n`;
      msg += MESSAGES.selectContribution(pageContribs);
      
      return { 
        response: msg, 
        newState: 'SELECT_CONTRIBUTION' 
      };
    }

    case 'SELECT_CONTRIBUTION': {
      if (messageText.startsWith('boleto_') && !/^boleto_contrib_(\d+|mais|voltar)$/.test(messageText)) {
        console.log(`[boleto-flow] Ignoring stale boleto button ${messageText} in state ${session.state}`);
        return { response: '', newState: session.state };
      }

      const contributions = session.available_contributions || [];
      
      // Handle "next page" command
      if (text === 'mais' || text === 'proxima' || text === 'próxima' || messageText.trim() === 'boleto_contrib_mais') {
        const yearContribs = session.flow_context?.year_contributions || [];
        const currentPage = (session.flow_context?.current_page || 0) + 1;
        const pageSize = session.flow_context?.page_size || 3;
        const pageContribs = yearContribs.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
        
        if (pageContribs.length === 0) {
          return { response: `ℹ️ Não há mais contribuições para exibir.\n\nEscolha uma das opções acima ou digite *MENU* para recomeçar.` };
        }
        
        const hasMore = yearContribs.length > (currentPage + 1) * pageSize;
        
        await updateSession(supabase, session.id, {
          available_contributions: pageContribs,
          flow_context: { 
            ...session.flow_context, 
            current_page: currentPage 
          }
        });

        let msg = `📋 *Mais contribuições - ${session.flow_context?.selected_year || ''}*\n\n`;
        msg += `Página ${currentPage + 1} (${pageContribs.length} de ${yearContribs.length}):\n\n`;
        msg += MESSAGES.selectContribution(pageContribs);
        
        return { response: msg, newState: 'SELECT_CONTRIBUTION' };
      }
      
      // Handle "back to years" command
      if ((text === 'voltar' || messageText.trim() === 'boleto_contrib_voltar') && session.flow_context?.available_years) {
        const years = session.flow_context.available_years;
        const allContributions = session.flow_context.all_contributions || [];
        
        await updateSession(supabase, session.id, {
          state: 'SELECT_CONTRIBUTION_YEAR' as BoletoState,
          available_contributions: allContributions,
        });

        let msg = `📋 *Contribuições Pendentes*\n\nSelecione o *ano*:\n\n`;
        years.forEach((y: number, i: number) => {
          const count = allContributions.filter((c: any) => c.competence_year === y).length;
          msg += `${i + 1}. *${y}* (${count} contribuição${count > 1 ? 'ões' : ''})\n`;
        });

        return { response: msg, newState: 'SELECT_CONTRIBUTION_YEAR' as BoletoState };
      }
      
      const optionNum = parseInt(optionText);
      
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
      if (messageText.startsWith('boleto_') && messageText !== 'boleto_confirmar' && messageText !== 'boleto_cancelar') {
        console.log(`[boleto-flow] Ignoring stale boleto button ${messageText} in state ${session.state}`);
        return { response: '', newState: session.state };
      }

      if (messageText === 'boleto_confirmar' || text === '1' || /^confirm/i.test(text) || /^sim/i.test(text)) {
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
                origin: 'manual'
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
      } else if (messageText === 'boleto_cancelar' || text === '2' || /^cancel/i.test(text) || /^n[aã]o/i.test(text)) {
        await updateSession(supabase, session.id, { state: 'FINISHED' });
        return { response: MESSAGES.cancelled, newState: 'FINISHED' };
      }
      return { response: MESSAGES.invalidOption };
    }

    case 'SELECT_TAXA_TYPE_BATCH': {
      if (messageText.startsWith('boleto_') && !/^boleto_taxa_\d+$/.test(messageText)) {
        console.log(`[boleto-flow] Ignoring stale boleto button ${messageText} in state ${session.state}`);
        return { response: '', newState: session.state };
      }

      // User needs to choose between taxa mercados or taxa varejista for batch processing
      const optionNum = parseInt(optionText) || intent.extracted_number || parseInt(text);
      
      if (optionNum !== 1 && optionNum !== 2) {
        return { 
          response: `❌ Opção inválida.\n\nEscolha o tipo de taxa usando os botões abaixo.` 
        };
      }
      
      const selectedTaxaType: 'taxa_mercados' | 'taxa_varejista' = optionNum === 1 ? 'taxa_mercados' : 'taxa_varejista';
      const pendingItems = session.flow_context?.pending_batch_items || [];
      
      // Update all items with undefined taxa to the selected type
      const updatedItems: BatchBoletoItem[] = pendingItems.map((item: BatchBoletoItem) => ({
        ...item,
        contribution_type: item.contribution_type === 'taxa_indefinida' ? selectedTaxaType : item.contribution_type
      }));
      
      console.log(`[boleto-flow] Processing ${updatedItems.length} batch items with taxa type: ${selectedTaxaType}`);
      
      await sendWhatsAppMessage(evolutionConfig, phone, `⏳ *Processando ${updatedItems.length} boleto(s)...*\n\nTipo: ${optionNum === 1 ? 'TAXA NEGOCIAL (MERCADOS)' : 'TAXA NEGOCIAL (COM VEREJ)'}\n\nAguarde um momento.`);
      
      const results: Array<{ success: boolean; cnpj: string; employer_name?: string; url?: string; error?: string }> = [];
      
      // Fetch all contribution types we need
      const allowedNames = [
        CONTRIBUTION_TYPE_MAP.mensalidade,
        CONTRIBUTION_TYPE_MAP.taxa_mercados,
        CONTRIBUTION_TYPE_MAP.taxa_varejista
      ];
      
      const { data: allContribTypes } = await supabase
        .from('contribution_types')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .in('name', allowedNames);
      
      const contribTypesMap: Record<string, { id: string; name: string }> = {};
      for (const ct of allContribTypes || []) {
        if (ct.name === CONTRIBUTION_TYPE_MAP.mensalidade) contribTypesMap.mensalidade = ct;
        if (ct.name === CONTRIBUTION_TYPE_MAP.taxa_mercados) contribTypesMap.taxa_mercados = ct;
        if (ct.name === CONTRIBUTION_TYPE_MAP.taxa_varejista) contribTypesMap.taxa_varejista = ct;
      }
      
      for (const item of updatedItems) {
        try {
          // Find employer by CNPJ
          const { data: employer } = await supabase
            .from('employers')
            .select('id, name, cnpj, email, phone')
            .eq('clinic_id', clinicId)
            .or(`cnpj.eq.${item.cnpj},cnpj.eq.${formatCnpj(item.cnpj)}`)
            .eq('is_active', true)
            .maybeSingle();
          
          if (!employer) {
            results.push({ 
              success: false, 
              cnpj: formatCnpj(item.cnpj), 
              error: 'Empresa não encontrada' 
            });
            continue;
          }
          
          // Check if contribution already exists
          const { data: existingContrib } = await supabase
            .from('employer_contributions')
            .select('id, lytex_invoice_url, status')
            .eq('employer_id', employer.id)
            .eq('competence_month', item.competence_month)
            .eq('competence_year', item.competence_year)
            .neq('status', 'cancelled')
            .limit(1)
            .maybeSingle();
          
          if (existingContrib?.lytex_invoice_url && existingContrib.status !== 'paid') {
            results.push({ 
              success: true, 
              cnpj: formatCnpj(item.cnpj), 
              employer_name: employer.name,
              url: existingContrib.lytex_invoice_url 
            });
            continue;
          }
          
          const dueDate = calculateBaseDueDate(item.competence_month, item.competence_year);
          
          // Determine the correct contribution type
          let selectedContribType = contribTypesMap.mensalidade;
          if (item.contribution_type === 'taxa_mercados') {
            selectedContribType = contribTypesMap.taxa_mercados;
          } else if (item.contribution_type === 'taxa_varejista') {
            selectedContribType = contribTypesMap.taxa_varejista;
          }
          
          const { data: newContrib, error: contribError } = await supabase
            .from('employer_contributions')
            .insert({
              employer_id: employer.id,
              clinic_id: clinicId,
              contribution_type_id: selectedContribType?.id || null,
              competence_month: item.competence_month,
              competence_year: item.competence_year,
              value: item.value_cents,
              due_date: dueDate,
              status: 'pending',
              notes: 'Criado via WhatsApp (lote)',
              origin: 'manual'
            })
            .select()
            .single();
          
          if (contribError) {
            results.push({ 
              success: false, 
              cnpj: formatCnpj(item.cnpj), 
              employer_name: employer.name,
              error: 'Erro ao criar contribuição' 
            });
            continue;
          }
          
          const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const description = `${selectedContribType?.name || 'Contribuição'} - ${monthNames[item.competence_month - 1]}/${item.competence_year}`;
          
          try {
            const invoice = await createLytexInvoice({
              employer: {
                cnpj: item.cnpj,
                name: employer.name,
                email: employer.email,
                phone: employer.phone
              },
              value: item.value_cents,
              dueDate: dueDate,
              description: description,
              contributionId: newContrib.id
            });
            
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
              .eq('id', newContrib.id);
            
            results.push({ 
              success: true, 
              cnpj: formatCnpj(item.cnpj), 
              employer_name: employer.name,
              url: invoice.invoiceUrl 
            });
            
          } catch (lytexError: any) {
            results.push({ 
              success: false, 
              cnpj: formatCnpj(item.cnpj), 
              employer_name: employer.name,
              error: lytexError.message || 'Erro ao gerar boleto' 
            });
          }
          
        } catch (error: any) {
          results.push({ 
            success: false, 
            cnpj: formatCnpj(item.cnpj), 
            error: error.message || 'Erro inesperado' 
          });
        }
      }
      
      // Build response message
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      let responseMsg = `✅ *Processamento Concluído!*\n\n`;
      responseMsg += `📊 ${successCount} boleto(s) gerado(s)`;
      if (errorCount > 0) {
        responseMsg += ` | ${errorCount} erro(s)`;
      }
      responseMsg += `\n\n`;
      
      const successResults = results.filter(r => r.success);
      if (successResults.length > 0) {
        responseMsg += `*Boletos Gerados:*\n`;
        for (const r of successResults) {
          responseMsg += `\n🏢 *${r.employer_name || r.cnpj}*\n`;
          responseMsg += `📋 ${r.cnpj}\n`;
          responseMsg += `🔗 ${r.url}\n`;
        }
      }
      
      const errorResults = results.filter(r => !r.success);
      if (errorResults.length > 0) {
        responseMsg += `\n*Erros:*\n`;
        for (const r of errorResults) {
          responseMsg += `❌ ${r.cnpj}: ${r.error}\n`;
        }
      }
      
      responseMsg += `\n_Digite MENU para mais opções._`;
      
      await logAction(supabase, session.id, clinicId, phone, 'batch_boleto_taxa_generated', 
        { items_count: updatedItems.length, success_count: successCount, error_count: errorCount, taxa_type: selectedTaxaType }, 
        successCount > 0);
      
      await updateSession(supabase, session.id, { state: 'FINISHED', flow_context: null });
      
      return { response: responseMsg, newState: 'FINISHED' };
    }

    case 'SELECT_TAXA_TYPE': {
      if (messageText.startsWith('boleto_') && !/^boleto_taxa_\d+$/.test(messageText)) {
        console.log(`[boleto-flow] Ignoring stale boleto button ${messageText} in state ${session.state}`);
        return { response: '', newState: session.state };
      }

      // Individual flow - user needs to choose between taxa mercados or taxa varejista
      const optionNum = parseInt(optionText) || intent.extracted_number || parseInt(text);
      
      if (optionNum !== 1 && optionNum !== 2) {
        return { 
          response: `❌ Opção inválida.\n\nEscolha o tipo de taxa usando os botões abaixo.` 
        };
      }
      
      const taxaTypeName = optionNum === 1 ? CONTRIBUTION_TYPE_MAP.taxa_mercados : CONTRIBUTION_TYPE_MAP.taxa_varejista;
      
      // Fetch the selected contribution type
      const { data: selectedType } = await supabase
        .from('contribution_types')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .eq('name', taxaTypeName)
        .single();
      
      if (!selectedType) {
        return { 
          response: '❌ Tipo de taxa não encontrado.\n\nEntre em contato com o sindicato.' 
        };
      }
      
      // Check if competence was provided upfront
      if (session.flow_context?.competence_provided_upfront && session.competence_month && session.competence_year) {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const compStr = `${monthNames[session.competence_month - 1]}/${session.competence_year}`;
        
        await updateSession(supabase, session.id, {
          state: 'WAITING_VALUE',
          contribution_type_id: selectedType.id,
          flow_context: { ...session.flow_context, selected_type: selectedType }
        });

        return { 
          response: `✅ *${selectedType.name}*\n📅 Competência: *${compStr}*\n\n💰 Agora informe o *valor* a recolher:\n\n_Exemplo: 150,00 ou R$ 150,00_`, 
          newState: 'WAITING_VALUE' 
        };
      }
      
      // Normal flow - ask for competence
      await updateSession(supabase, session.id, {
        state: 'WAITING_COMPETENCE',
        contribution_type_id: selectedType.id,
        flow_context: { ...session.flow_context, selected_type: selectedType }
      });

      return { 
        response: `✅ *${selectedType.name}*\n\n📅 Agora informe a *competência* (período) do boleto:\n\n_Exemplos: 01/2025, Janeiro/2025, jan/2025_`, 
        newState: 'WAITING_COMPETENCE' 
      };
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
        // Interactive start must be a single button payload, never a text list + buttons.
        await sendBoletoButtons(phone, MESSAGES.welcome, [
          { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
          { id: 'boleto_vencido', title: 'Vencido (2ª Via)' },
        ]);
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
      const nextState = result.newState || session.state;
      const interactiveStates: BoletoState[] = [
        'SELECT_BOLETO_TYPE',
        'CONFIRM_EMPLOYER',
        'SELECT_CONTRIBUTION_TYPE',
        'SELECT_TAXA_TYPE',
        'SELECT_TAXA_TYPE_BATCH',
        'CONFIRM_BOLETO',
        'SELECT_CONTRIBUTION_YEAR',
        'SELECT_CONTRIBUTION',
      ];
      const requiresButtons = interactiveStates.includes(nextState);

      // Interactive states must never be sent as a plain numbered/text list.
      if (!requiresButtons) {
        await sendWhatsAppMessage(evolution_config, phone, result.response);
      }
      
      // Send interactive buttons based on new state
      
      if (nextState === 'SELECT_BOLETO_TYPE') {
        await sendBoletoButtons(phone, 'Selecione o tipo:', [
          { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
          { id: 'boleto_vencido', title: 'Vencido (2ª Via)' },
        ]);
      } else if (nextState === 'CONFIRM_EMPLOYER') {
        await sendBoletoButtons(phone, result.response, [
          { id: 'boleto_sim', title: '✅ Sim, continuar' },
          { id: 'boleto_nao', title: '❌ Não, outro CNPJ' },
        ]);
      } else if (nextState === 'SELECT_CONTRIBUTION_TYPE') {
        const types = session.flow_context?.contribution_types || result.response.match(/• .+/g) || [];
        // Fetch contribution types for button labels
        const ctTypes = await supabase
          .from('contribution_types')
          .select('id, name')
          .eq('clinic_id', clinic_id)
          .eq('is_active', true)
          .in('name', ['124 - MENSALIDADE SINDICAL', '125 - TAXA NEGOCIAL (MERCADOS)', '126 - TAXA NEGOCIAL (COM VEREJ)']);
        
        if (ctTypes.data && ctTypes.data.length > 0) {
          const btns = ctTypes.data.slice(0, 3).map((t: any, i: number) => ({
            id: `boleto_type_${i + 1}`,
            title: t.name.replace(/^\d+\s*-\s*/, '').substring(0, 20),
          }));
          await sendBoletoButtons(phone, 'Escolha o tipo:', btns);
        }
      } else if (nextState === 'SELECT_TAXA_TYPE' || nextState === 'SELECT_TAXA_TYPE_BATCH') {
        await sendBoletoButtons(phone, 'Qual tipo de taxa?', [
          { id: 'boleto_taxa_1', title: 'TAXA (MERCADOS)' },
          { id: 'boleto_taxa_2', title: 'TAXA (COM VEREJ)' },
        ]);
      } else if (nextState === 'CONFIRM_BOLETO') {
        await sendBoletoButtons(phone, result.response, [
          { id: 'boleto_confirmar', title: '✅ Confirmar' },
          { id: 'boleto_cancelar', title: '❌ Cancelar' },
        ]);
      } else if (nextState === 'SELECT_CONTRIBUTION_YEAR') {
        // Send year selection buttons (max 3 years)
        const years = session.flow_context?.available_years || 
          result.response.match(/\*(\d{4})\*/g)?.map((y: string) => parseInt(y.replace(/\*/g, ''))) || [];
        
        // Re-read session to get updated flow_context
        const { data: updatedSession } = await supabase
          .from('whatsapp_boleto_sessions')
          .select('flow_context')
          .eq('id', session.id)
          .single();
        const updatedYears = updatedSession?.flow_context?.available_years || years;
        
        if (updatedYears.length > 0) {
          const btns = updatedYears.slice(0, 3).map((y: number, i: number) => ({
            id: `boleto_year_${i + 1}`,
            title: `${y}`,
          }));
          await sendBoletoButtons(phone, 'Selecione o ano:', btns);
        }
      } else if (nextState === 'SELECT_CONTRIBUTION') {
        // Re-read session to get the latest available_contributions after state update
        const { data: updatedSession2 } = await supabase
          .from('whatsapp_boleto_sessions')
          .select('available_contributions, flow_context')
          .eq('id', session.id)
          .single();
        
        const contribs = updatedSession2?.available_contributions || session.available_contributions || [];
        const yearContribs = updatedSession2?.flow_context?.year_contributions || [];
        const currentPage = updatedSession2?.flow_context?.current_page || 0;
        const pageSize = updatedSession2?.flow_context?.page_size || 3;
        const hasMore = yearContribs.length > (currentPage + 1) * pageSize;
        const hasYearNav = updatedSession2?.flow_context?.available_years?.length > 0;
        
        if (contribs.length > 0) {
          const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          const btns: Array<{ id: string; title: string }> = [];
          
          // Add contribution buttons (max 3, or fewer to leave room for navigation)
          const maxContribBtns = hasMore || hasYearNav ? 2 : 3;
          contribs.slice(0, maxContribBtns).forEach((c: any, i: number) => {
            btns.push({
              id: `boleto_contrib_${i + 1}`,
              title: `${monthNames[c.competence_month - 1]}/${c.competence_year}`,
            });
          });
          
          // Add "More" button if there are more pages
          if (hasMore) {
            btns.push({ id: 'boleto_contrib_mais', title: 'Mais opcoes ➡️' });
          }
          
          // Add "Back to years" button if navigating from year menu
          if (hasYearNav && !hasMore) {
            btns.push({ id: 'boleto_contrib_voltar', title: '⬅️ Voltar (anos)' });
          }
          
          await sendBoletoButtons(phone, 'Selecione a contribuicao:', btns);
        }
      }
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
