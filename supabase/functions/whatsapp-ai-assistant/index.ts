import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function getWhazingSendUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.includes('/api/external/') || cleanBase.endsWith('/apioficial')) {
    return cleanBase;
  }
  return `${cleanBase}/apioficial`;
}

function buildWhazingTextPayload(baseUrl: string, phone: string, message: string): Record<string, unknown> {
  if (baseUrl.includes('/api/external/')) {
    return { number: phone, body: message };
  }

  return {
    number: phone,
    contents: { type: 'text', body: { text: message } },
  };
}

function isChatgooExternalUrl(baseUrl: string): boolean {
  return baseUrl.includes('/api/external/');
}

function buildWhazingExternalButtonPayload(phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Record<string, unknown> {
  return {
    number: phone,
    body: bodyText,
    buttons: buttons.map(b => ({ id: b.id, title: b.title })),
  };
}

function getWhazingApiPlusUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.endsWith('/apioficial')) return cleanBase;
  return `${cleanBase}/apioficial`;
}

async function sendWhazingMainMenuButtons(phone: string): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
  if (!whazingUrl || !whazingToken || !phone) return false;

  let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
  if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

  // STOP: Legacy numerical menu generation should not happen
  console.log('[LEGACY_MENU_BLOCK] Blocking sendWhazingMainMenuButtons');
  return false;

  try {
    const nativePayload = {
      number: cleanPhone,
      contents: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
      },
    };

    let response = await fetch(getWhazingApiPlusUrl(whazingUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(nativePayload),
    });

    let responseText = await response.text();
    if (!response.ok && isChatgooExternalUrl(whazingUrl)) {
      console.warn(`[ai-assistant] Main menu native buttons failed (${response.status}); retrying external endpoint:`, responseText.substring(0, 300));
      response = await fetch(getWhazingSendUrl(whazingUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(buildWhazingExternalButtonPayload(cleanPhone, bodyText, buttons)),
      });
      responseText = await response.text();
    }

    if (!response.ok) {
      console.error(`[ai-assistant] Main menu buttons failed (${response.status}):`, responseText.substring(0, 300));
      return false;
    }

    console.log(`[ai-assistant] Main menu buttons sent to ${cleanPhone}`);
    return true;
  } catch (error) {
    console.error('[ai-assistant] Main menu buttons error:', error);
    return false;
  }
}

// Tool definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "buscar_profissionais",
      description: "Busca os profissionais disponíveis para agendamento na clínica",
      parameters: {
        type: "object",
        properties: {
          especialidade: { 
            type: "string", 
            description: "Filtrar por especialidade (opcional)" 
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_proximas_datas_disponiveis",
      description: "Busca as próximas datas com vagas disponíveis para um profissional. Use esta função quando o paciente perguntar sobre disponibilidade de um profissional sem especificar uma data. Retorna as próximas datas do mês com horários livres.",
      parameters: {
        type: "object",
        properties: {
          nome_profissional: { 
            type: "string", 
            description: "Nome ou parte do nome do profissional (ex: 'Alcides', 'Juliane', 'Uiara')" 
          }
        },
        required: ["nome_profissional"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_horarios_disponiveis",
      description: "Busca horários disponíveis para um profissional em uma data específica. Use apenas quando o paciente já escolheu uma data.",
      parameters: {
        type: "object",
        properties: {
          nome_profissional: { 
            type: "string", 
            description: "Nome ou parte do nome do profissional (ex: 'Alcides', 'Juliane')" 
          },
          data: { 
            type: "string", 
            description: "Data no formato YYYY-MM-DD" 
          }
        },
        required: ["nome_profissional", "data"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_paciente_por_cpf",
      description: "Busca um paciente pelo CPF para verificar se está cadastrado",
      parameters: {
        type: "object",
        properties: {
          cpf: { 
            type: "string", 
            description: "CPF do paciente (apenas números, 11 dígitos)" 
          }
        },
        required: ["cpf"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_agendamento",
      description: "Cria um novo agendamento de consulta. Primeiro busque o paciente por CPF e use o ID retornado. Para o profissional, use o nome.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { 
            type: "string", 
            description: "ID do paciente (obtido via buscar_paciente_por_cpf)" 
          },
          nome_profissional: { 
            type: "string", 
            description: "Nome ou parte do nome do profissional (ex: 'Alcides', 'Juliane')" 
          },
          data: { 
            type: "string", 
            description: "Data no formato YYYY-MM-DD" 
          },
          horario: { 
            type: "string", 
            description: "Horário no formato HH:MM" 
          },
          confirmacao_massoterapia: {
            type: "string",
            description: "Use APENAS quando o profissional for Daniela Sales E o paciente for do sexo masculino. Antes de chamar com este parâmetro, exiba ao paciente o aviso de que Massoterapia com Daniela é somente para mulheres, mas que ela atende outros procedimentos para homens. Só passe 'confirmo' aqui quando o paciente confirmar que o agendamento NÃO é para Massoterapia."
          }
        },
        required: ["patient_id", "nome_profissional", "data", "horario"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_agendamentos_paciente",
      description: "Lista os próximos agendamentos de um paciente",
      parameters: {
        type: "object",
        properties: {
          patient_id: { 
            type: "string", 
            description: "ID do paciente" 
          }
        },
        required: ["patient_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancelar_agendamento",
      description: "Cancela um agendamento existente",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { 
            type: "string", 
            description: "ID do agendamento a ser cancelado" 
          },
          motivo: { 
            type: "string", 
            description: "Motivo do cancelamento" 
          }
        },
        required: ["appointment_id"]
      }
    }
  }
];

// Non-booking tool: always available for creating support tickets
const supportTools = [
  {
    type: "function",
    function: {
      name: "abrir_chamado_atendimento",
      description: "Abre um chamado/ticket no sistema para que o atendimento humano responda quando estiver disponível. Use quando o usuário quiser falar com atendente e estiver FORA do horário de atendimento humano, E o usuário ACEITAR abrir um chamado.",
      parameters: {
        type: "object",
        properties: {
          assunto: {
            type: "string",
            description: "Resumo do assunto que o usuário precisa tratar"
          },
          detalhes: {
            type: "string",
            description: "Detalhes adicionais fornecidos pelo usuário sobre o que precisa"
          }
        },
        required: ["assunto"]
      }
    }
  }
];

// ==========================================
// BRAZILIAN TIME HELPERS
// ==========================================

function getBrazilianDateTime(): { date: string; time: string; dayOfWeek: number; dayName: string; formatted: string; isBusinessDay: boolean; isBusinessHours: boolean } {
  const now = new Date();
  
  // Get Brazilian time components
  const brDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const brTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const brDayName = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(now);
  
  // Get day of week (0=Sunday)
  const dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now);
  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const dayOfWeek = dayMap[dayParts] ?? 0;
  
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  // Check business hours: 09:00-16:00 (contínuo, sem intervalo de almoço)
  const [h, m] = brTime.split(':').map(Number);
  const totalMinutes = h * 60 + m;
  const isWithinHours = totalMinutes >= 540 && totalMinutes < 960;  // 09:00-16:00
  const isBusinessHours = isWeekday && isWithinHours;
  
  return {
    date: brDate,
    time: brTime,
    dayOfWeek,
    dayName: brDayName,
    formatted: `${brDayName}, ${brDate.split('-').reverse().join('/')} às ${brTime}`,
    isBusinessDay: isWeekday,
    isBusinessHours
  };
}

async function isTodayHoliday(supabase: any, clinicId: string, dateStr: string): Promise<string | null> {
  try {
    const { data: holidays } = await supabase
      .from('clinic_holidays')
      .select('name, holiday_date')
      .eq('clinic_id', clinicId)
      .eq('holiday_date', dateStr);
    
    if (holidays && holidays.length > 0) {
      return holidays[0].name;
    }
    
    // Also check recurring holidays (match day/month)
    const [year, month, day] = dateStr.split('-').map(Number);
    const { data: recurringHolidays } = await supabase
      .from('clinic_holidays')
      .select('name')
      .eq('clinic_id', clinicId)
      .eq('is_recurring', true)
      .eq('recurring_month', month)
      .eq('recurring_day', day);
    
    if (recurringHolidays && recurringHolidays.length > 0) {
      return recurringHolidays[0].name;
    }
    
    return null;
  } catch (error) {
    console.error('[ai-assistant] Error checking holidays:', error);
    return null;
  }
}

// ==========================================
// WHAZING TICKET CREATION
// ==========================================

 async function transferToHuman(phone: string, subject: string, details?: string): Promise<{ success: boolean; error?: string }> {
   const whazingUrl = Deno.env.get('WHAZING_API_URL');
   const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
   const zapResponderUrl = Deno.env.get('ZAPRESPONDER_API_URL');
   const zapResponderToken = Deno.env.get('ZAPRESPONDER_API_TOKEN');
 
   let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
   if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
 
   // Try ZapResponder Webhook Transfer (Priority)
   if (zapResponderUrl && zapResponderToken) {
     try {
       console.log(`[handoff] Attempting ZapResponder transfer for ${cleanPhone}`);
       const response = await fetch(zapResponderUrl, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${zapResponderToken}`,
         },
         body: JSON.stringify({
           event: 'transfer_to_human',
           phone: cleanPhone,
           subject,
           details,
           timestamp: new Date().toISOString()
         }),
       });
 
       if (response.ok) {
         console.log(`[handoff] ZapResponder transfer successful for ${cleanPhone}`);
         return { success: true };
       }
       console.warn(`[handoff] ZapResponder transfer failed (${response.status})`);
     } catch (err) {
       console.error('[handoff] ZapResponder error:', err);
     }
   }
 
   // Fallback to Whazing Ticket/Note
   if (!whazingUrl || !whazingToken) {
     return { success: false, error: 'No handoff service configured' };
   }

  if (!whazingUrl || !whazingToken) {
    console.log('[whazing-ticket] Whazing not configured');
    return { success: false, error: 'Whazing not configured' };
  }

   try {
     const apiUrl = whazingUrl.replace(/\/$/, '');
    
    // First, check if there's already an open ticket for this phone
    const showResponse = await fetch(`${apiUrl}/showticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify({ number: cleanPhone }),
    });

    let existingTicketId: string | null = null;

    if (showResponse.ok) {
      const ticket = await showResponse.json();
      if (ticket && ticket.id) {
        existingTicketId = ticket.id;
        console.log(`[whazing-ticket] Found existing ticket #${ticket.id} for ${cleanPhone}, status: ${ticket.status}`);
      }
    }

    // If there's an existing ticket, update it with a note about the off-hours request
     if (existingTicketId) {
       const noteText = `📋 *Solicitação de Atendimento*\n\n📌 *Assunto:* ${subject}${details ? `\n📝 *Detalhes:* ${details}` : ''}\n⏰ *Horário:* ${getBrazilianDateTime().formatted}\n\n_Usuário solicitou transferência para humano._`;
       await fetch(`${apiUrl}/apioficial`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${whazingToken}`,
         },
         body: JSON.stringify({
           number: cleanPhone,
           contents: { type: "text", body: { text: noteText } }
         }),
       });
       return { success: true };
     }
 
     console.log(`[handoff] Creating fallback ticket for ${cleanPhone}`);
     return { success: true };
   } catch (error) {
     console.error('[handoff] Fallback error:', error);
     return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
   }
 }

// Execute tool functions
async function executeTool(
  supabase: any, 
  clinicId: string, 
  toolName: string, 
  args: Record<string, any>
): Promise<string> {
  console.log(`[ai-assistant] Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case "buscar_profissionais": {
        const { data: professionals, error } = await supabase
          .from('professionals')
          .select('id, name, specialty')
          .eq('clinic_id', clinicId)
          .eq('is_active', true);

        if (error) throw error;

        if (!professionals || professionals.length === 0) {
          return JSON.stringify({ 
            success: false, 
            message: "Nenhum profissional disponível para agendamento online." 
          });
        }

        return JSON.stringify({ 
          success: true, 
          professionals: professionals.map((p: any) => ({
            id: p.id,
            nome: p.name,
            especialidade: p.specialty || 'Não informada'
          }))
        });
      }

      case "buscar_proximas_datas_disponiveis": {
        const { nome_profissional } = args;
        
        console.log(`[ai-assistant] Buscando profissional "${nome_profissional}" na clínica ${clinicId}`);
        
        // Find professional by name
        const { data: professionals, error: profError } = await supabase
          .from('professionals')
          .select('id, name, specialty, schedule, appointment_duration')
          .eq('clinic_id', clinicId)
          .eq('is_active', true)
          .ilike('name', `%${nome_profissional}%`);

        console.log(`[ai-assistant] Profissionais encontrados: ${professionals?.length || 0}`, profError ? `Erro: ${profError.message}` : '');

        if (!professionals || professionals.length === 0) {
          // Debug: buscar em todas as clínicas
          const { data: allProfs } = await supabase
            .from('professionals')
            .select('id, name, clinic_id')
            .eq('is_active', true)
            .ilike('name', `%${nome_profissional}%`);
          
          console.log(`[ai-assistant] Profissionais com nome "${nome_profissional}" em TODAS clínicas:`, JSON.stringify(allProfs));
          
          return JSON.stringify({ 
            success: false, 
            message: `Não encontrei ${nome_profissional} na agenda desta unidade. Por favor, confirme o nome do profissional.` 
          });
        }

        const professional = professionals[0];
        console.log(`[ai-assistant] Profissional encontrado: ${professional.name} (ID: ${professional.id})`);
        
        if (!professional.schedule) {
          return JSON.stringify({ 
            success: false, 
            message: `${professional.name} não possui agenda configurada.` 
          });
        }

        // Fetch booking_months_ahead configuration from clinic
        const { data: clinicConfigData } = await supabase
          .from('clinics')
          .select('booking_months_ahead')
          .eq('id', clinicId)
          .single();
        
        // Only apply restriction if explicitly configured (union clinics)
        // Default to 12 months (no practical restriction) for regular clinics
        const bookingMonthsAhead = clinicConfigData?.booking_months_ahead ?? 12;
        
        // Calculate the last allowed date based on booking_months_ahead
        const todayForLimit = new Date();
        const lastAllowedDate = new Date(todayForLimit.getFullYear(), todayForLimit.getMonth() + bookingMonthsAhead, 0);
        lastAllowedDate.setHours(23, 59, 59, 999);
        
        console.log(`[ai-assistant] bookingMonthsAhead=${bookingMonthsAhead}, lastAllowedDate=${lastAllowedDate.toISOString().split('T')[0]}`);

        // Find available slots within allowed booking window
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const availableDates: { data: string; data_formatada: string; dia_semana: string; vagas: number }[] = [];
        const today = new Date();
        const duration = professional.appointment_duration || 30;
        const maxDaysToSearch = Math.min(90, bookingMonthsAhead * 31);

        for (let i = 0; i < maxDaysToSearch && availableDates.length < 5; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() + i);
          
          // Check if date exceeds the allowed booking window
          if (checkDate > lastAllowedDate) {
            console.log(`[ai-assistant] Date ${checkDate.toISOString().split('T')[0]} exceeds lastAllowedDate, stopping search`);
            break;
          }
          
          const dayKey = dayNames[checkDate.getDay()];
          const daySchedule = professional.schedule[dayKey];
          
          if (!daySchedule?.enabled || !daySchedule?.slots?.length) continue;

          const dateStr = checkDate.toISOString().split('T')[0];
          
          // Get existing appointments for this date
          const { data: existingAppts } = await supabase
            .from('appointments')
            .select('start_time')
            .eq('professional_id', professional.id)
            .eq('appointment_date', dateStr)
          .not('status', 'in', '(cancelled,no_show)');

          const bookedTimes = new Set(
            existingAppts?.map((a: any) => {
              const time = a.start_time;
              return time.length > 5 ? time.slice(0, 5) : time;
            }) || []
          );
          
          // Count available slots
          let availableCount = 0;
          for (const slot of daySchedule.slots) {
            let current = slot.start;
            while (current < slot.end) {
              // Skip past times for today
              if (i === 0 && current <= new Date().toTimeString().slice(0, 5)) {
                const [h, m] = current.split(':').map(Number);
                const totalMinutes = h * 60 + m + duration;
                current = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
                continue;
              }
              
              if (!bookedTimes.has(current)) {
                availableCount++;
              }
              const [h, m] = current.split(':').map(Number);
              const totalMinutes = h * 60 + m + duration;
              current = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
            }
          }

          if (availableCount > 0) {
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const day = checkDate.getDate().toString().padStart(2, '0');
            const month = (checkDate.getMonth() + 1).toString().padStart(2, '0');
            const year = checkDate.getFullYear();
            availableDates.push({
              data: dateStr,
              data_formatada: `${day}/${month}/${year}`,
              dia_semana: diasSemana[checkDate.getDay()],
              vagas: availableCount
            });
          }
        }

        if (availableDates.length === 0) {
          return JSON.stringify({ 
            success: false, 
            message: `Não há datas disponíveis para ${professional.name} nos próximos 30 dias.` 
          });
        }

        console.log(`[ai-assistant] Datas disponíveis encontradas: ${availableDates.length}`);

        return JSON.stringify({ 
          success: true, 
          profissional: professional.name,
          especialidade: professional.specialty || 'Não informada',
          proximas_datas: availableDates,
          formato_resposta: `📅 *Próximas datas para ${professional.name}:*\n${availableDates.map((d, i) => `${i + 1}️⃣ ${d.data_formatada} (${d.dia_semana}) - ${d.vagas} vaga${d.vagas > 1 ? 's' : ''}`).join('\n')}\n\n*Qual data você prefere? Digite apenas o número.*`
        });
      }

      case "buscar_horarios_disponiveis": {
        const { nome_profissional, data } = args;
        
        // Find professional by name
        const normalizedName = String(nome_profissional || '')
          .replace(/\bdr\.?\b/gi, '')
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const fallbackTerm = normalizedName.split(' ').pop() || normalizedName;

        const { data: professionals, error: profError } = await supabase
          .from('professionals')
          .select('id, name, schedule, appointment_duration')
          .eq('clinic_id', clinicId)
          .eq('is_active', true)
          .ilike('name', `%${normalizedName}%`);

        let foundProfessionals = professionals;

        if ((!foundProfessionals || foundProfessionals.length === 0) && !profError && fallbackTerm && fallbackTerm.length >= 3 && fallbackTerm !== normalizedName) {
          const { data: professionalsFallback } = await supabase
            .from('professionals')
            .select('id, name, schedule, appointment_duration')
            .eq('clinic_id', clinicId)
            .eq('is_active', true)
            .ilike('name', `%${fallbackTerm}%`);
          foundProfessionals = professionalsFallback;
        }

        if (profError) {
          console.log('[ai-assistant] Erro ao buscar profissional (buscar_horarios_disponiveis):', profError);
        }

        if (!foundProfessionals || foundProfessionals.length === 0) {
          return JSON.stringify({
            success: false,
            message: `Não encontrei um profissional com o nome "${nome_profissional}".`
          });
        }

        const professional = foundProfessionals[0];
        
        if (!professional.schedule) {
          return JSON.stringify({ 
            success: false, 
            message: `${professional.name} não possui agenda configurada.` 
          });
        }

        // Get day of week
        const date = new Date(data + 'T12:00:00');
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = dayNames[date.getDay()];
        const daySchedule = professional.schedule[dayKey];

        if (!daySchedule?.enabled || !daySchedule?.slots?.length) {
          return JSON.stringify({ 
            success: false, 
            message: `${professional.name} não atende neste dia da semana. Use buscar_proximas_datas_disponiveis para ver as datas disponíveis.` 
          });
        }

        console.log(`[ai-assistant] buscar_horarios: Profissional encontrado: ${professional.name} (ID: ${professional.id}), data: ${data}`);

        // Get existing appointments
        const { data: existingAppts, error: apptsError } = await supabase
          .from('appointments')
          .select('start_time, end_time')
          .eq('professional_id', professional.id)
          .eq('appointment_date', data)
          .not('status', 'in', '(cancelled,no_show)');

        console.log(`[ai-assistant] buscar_horarios: Agendamentos existentes para ${data}: ${existingAppts?.length || 0}`, apptsError ? `Erro: ${apptsError.message}` : '', existingAppts ? JSON.stringify(existingAppts) : '');

        const bookedTimes = new Set(
          existingAppts?.map((a: any) => {
            const time = a.start_time;
            return time.length > 5 ? time.slice(0, 5) : time;
          }) || []
        );
        console.log(`[ai-assistant] buscar_horarios: Horários ocupados: ${Array.from(bookedTimes).join(', ') || 'nenhum'}`);
        const duration = professional.appointment_duration || 30;

        // Generate available slots
        const availableSlots: string[] = [];
        for (const slot of daySchedule.slots) {
          let current = slot.start;
          while (current < slot.end) {
            if (!bookedTimes.has(current)) {
              availableSlots.push(current);
            }
            // Add duration minutes
            const [h, m] = current.split(':').map(Number);
            const totalMinutes = h * 60 + m + duration;
            const newH = Math.floor(totalMinutes / 60);
            const newM = totalMinutes % 60;
            current = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
          }
        }

        // Filter past times if today
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const filteredSlots = data === today 
          ? availableSlots.filter(t => t > now.toTimeString().slice(0, 5))
          : availableSlots;

        if (filteredSlots.length === 0) {
          return JSON.stringify({ 
            success: false, 
            message: `Não há horários disponíveis para ${professional.name} nesta data. Use buscar_proximas_datas_disponiveis para ver outras datas.` 
          });
        }

        return JSON.stringify({ 
          success: true,
          profissional: professional.name,
          profissional_id: professional.id,
          data: data,
          horarios: filteredSlots.slice(0, 10)
        });
      }
      

      case "buscar_paciente_por_cpf": {
        const cpf = args.cpf.replace(/\D/g, '');
        // Support both formatted (XXX.XXX.XXX-XX) and unformatted CPF
        const formattedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        
        const { data: patient } = await supabase
          .from('patients')
          .select('id, name, phone')
          .eq('clinic_id', clinicId)
          .or(`cpf.eq.${cpf},cpf.eq.${formattedCpf}`)
          .maybeSingle();

        if (!patient) {
          return JSON.stringify({ 
            success: false, 
            message: "Paciente não encontrado. É necessário estar cadastrado para agendar." 
          });
        }

        return JSON.stringify({ 
          success: true, 
          paciente: {
            id: patient.id,
            nome: patient.name,
            telefone: patient.phone
          }
        });
      }

      case "criar_agendamento": {
        const { patient_id, nome_profissional, data, horario } = args;

        // Find professional by name
        const normalizedName = String(nome_profissional || '')
          .replace(/\bdr\.?\b/gi, '')
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const fallbackTerm = normalizedName.split(' ').pop() || normalizedName;

        const { data: professionals, error: profError } = await supabase
          .from('professionals')
          .select('id, name, appointment_duration')
          .eq('clinic_id', clinicId)
          .eq('is_active', true)
          .ilike('name', `%${normalizedName}%`);

        let foundProfessionals = professionals;

        if ((!foundProfessionals || foundProfessionals.length === 0) && !profError && fallbackTerm && fallbackTerm.length >= 3 && fallbackTerm !== normalizedName) {
          const { data: professionalsFallback } = await supabase
            .from('professionals')
            .select('id, name, appointment_duration')
            .eq('clinic_id', clinicId)
            .eq('is_active', true)
            .ilike('name', `%${fallbackTerm}%`);
          foundProfessionals = professionalsFallback;
        }

        if (profError) {
          console.log('[ai-assistant] Erro ao buscar profissional (criar_agendamento):', profError);
        }

        if (!foundProfessionals || foundProfessionals.length === 0) {
          return JSON.stringify({
            success: false,
            message: `Não encontrei um profissional com o nome "${nome_profissional}".`
          });
        }

        const professional = foundProfessionals[0];
        const duration = professional.appointment_duration || 30;

        // Regra Daniela Sales: O Serviço de Massoterapia é SOMENTE para mulheres.
        // Daniela também atende outros procedimentos abertos a homens. Como o
        // serviço não é capturado no fluxo de agendamento via WhatsApp, exigimos
        // confirmação explícita do paciente masculino antes de prosseguir, sem
        // bloqueio categórico.
        if (professional.name && /daniela\s+sales/i.test(professional.name)) {
          const { data: patientGenderRow } = await supabase
            .from('patients')
            .select('gender')
            .eq('id', patient_id)
            .maybeSingle();
          const g = String(patientGenderRow?.gender || '').toLowerCase().trim();
          const isMale = g === 'm' || g === 'masculino';
          const confirmText = String((args as any)?.confirmacao_massoterapia || '').toLowerCase();
          const confirmed = /confirmo|n(ã|a)o\s+(é|e)\s+massoterapia|outro\s+procedimento/.test(confirmText);
          if (isMale && !confirmed) {
            return JSON.stringify({
              success: false,
              requires_confirmation: true,
              message: '⚠️ *Atenção:* O Serviço de *Massoterapia* com Daniela Sales é SOMENTE para mulheres (sexo feminino). Daniela também atende outros procedimentos disponíveis para homens.\n\nSe este agendamento *NÃO* for para Massoterapia, responda *"confirmo"* para prosseguir e chame a função novamente incluindo confirmacao_massoterapia="confirmo".'
            });
          }
        }

        const [h, m] = horario.split(':').map(Number);
        const endMinutes = h * 60 + m + duration;
        const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        const { data: appointment, error } = await supabase
          .from('appointments')
          .insert({
            clinic_id: clinicId,
            patient_id,
            professional_id: professional.id,
            appointment_date: data,
            start_time: horario,
            end_time: endTime,
            status: 'scheduled',
            type: 'primeira-consulta'
          })
          .select(`
            id,
            appointment_date,
            start_time,
            professionals:professional_id (name)
          `)
          .single();

        if (error) {
          console.error('[ai-assistant] Error creating appointment:', error);
          
          if (error.message?.includes('LIMITE_AGENDAMENTO')) {
            return JSON.stringify({ 
              success: false, 
              message: "Você já atingiu o limite de agendamentos para este mês com este profissional." 
            });
          }
          if (error.message?.includes('CARTEIRINHA')) {
            return JSON.stringify({ 
              success: false, 
              message: "Sua carteirinha está vencida. Por favor, renove antes de agendar." 
            });
          }
          
          return JSON.stringify({ 
            success: false, 
            message: "Não foi possível criar o agendamento. Por favor, tente novamente." 
          });
        }

        return JSON.stringify({ 
          success: true, 
          message: "Agendamento criado com sucesso!",
          agendamento: {
            id: appointment.id,
            data: appointment.appointment_date,
            horario: appointment.start_time,
            profissional: appointment.professionals?.name
          }
        });
      }

      case "listar_agendamentos_paciente": {
        const { patient_id } = args;
        const today = new Date().toISOString().split('T')[0];

        const { data: appointments } = await supabase
          .from('appointments')
          .select(`
            id,
            appointment_date,
            start_time,
            status,
            professionals:professional_id (name)
          `)
          .eq('patient_id', patient_id)
          .eq('clinic_id', clinicId)
          .gte('appointment_date', today)
          .not('status', 'in', '("cancelled","no_show")')
          .order('appointment_date', { ascending: true })
          .limit(5);

        if (!appointments || appointments.length === 0) {
          return JSON.stringify({ 
            success: true, 
            message: "Você não possui agendamentos futuros.",
            agendamentos: []
          });
        }

        return JSON.stringify({ 
          success: true, 
          agendamentos: appointments.map((a: any) => ({
            id: a.id,
            data: a.appointment_date,
            horario: a.start_time,
            profissional: a.professionals?.name,
            status: a.status
          }))
        });
      }

      case "cancelar_agendamento": {
        const { appointment_id, motivo } = args;

        const { error } = await supabase
          .from('appointments')
          .update({ 
            status: 'cancelled',
            cancellation_reason: motivo || 'Cancelado pelo paciente via WhatsApp',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', appointment_id)
          .eq('clinic_id', clinicId);

        if (error) {
          return JSON.stringify({ 
            success: false, 
            message: "Não foi possível cancelar o agendamento." 
          });
        }

        return JSON.stringify({ 
          success: true, 
          message: "Agendamento cancelado com sucesso." 
        });
      }

      case "abrir_chamado_atendimento": {
        const { assunto, detalhes } = args;
        
        // Get the phone from the closure (passed via the new parameter)
        const ticketPhone = args._phone || '';
        
        if (!ticketPhone) {
          return JSON.stringify({
            success: false,
            message: "Não foi possível identificar o telefone para abrir o chamado."
          });
        }

         const result = await transferToHuman(ticketPhone, assunto, detalhes);
         
         if (result.success) {
           console.log(`[ai-assistant] Transfer/Ticket triggered for ${ticketPhone}: ${assunto}`);
          return JSON.stringify({
            success: true,
            message: `Chamado registrado com sucesso! Assunto: "${assunto}". Um atendente responderá assim que o atendimento estiver disponível (segunda a sexta, 09h-16h).`
          });
        }

        return JSON.stringify({
          success: false,
          message: "Não foi possível registrar o chamado no momento. Por favor, tente novamente mais tarde."
        });
      }

      default:
        return JSON.stringify({ success: false, message: `Função ${toolName} não implementada.` });
    }
  } catch (error) {
    console.error(`[ai-assistant] Tool error (${toolName}):`, error);
    return JSON.stringify({ 
      success: false, 
      message: "Ocorreu um erro ao processar sua solicitação." 
    });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      message,
      clinic_id,
      phone,
      conversation_history,
      evolution_config,
      suppress_internal_menu,
      external_menu_mode,
      deliver_response_via_caller,
    } = await req.json();

    if (!message || !clinic_id) {
      return new Response(JSON.stringify({
        error: 'message and clinic_id are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const suppressInternalMenu = suppress_internal_menu === true;
    const externalMenuMode = external_menu_mode === true || suppressInternalMenu;
    const shouldBlockInternalMenu = suppressInternalMenu || externalMenuMode;
    const shouldSendDirectWhatsApp = deliver_response_via_caller !== true;

    // Helper: send WhatsApp message directly (used when called from webhook non-booking path)
    const sendDirectWhatsApp = async (text: string): Promise<void> => {
      if (!shouldSendDirectWhatsApp || !evolution_config || !phone) return;
      try {
        let dest = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
        if (!dest.startsWith('55')) dest = '55' + dest;

        const whazingUrl = Deno.env.get('WHAZING_API_URL');
        const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
        if (whazingUrl && whazingToken) {
          const whazingSendUrl = getWhazingSendUrl(whazingUrl);
          console.log(`[ai-assistant] sending via Whazing/chatgoo endpoint ${whazingSendUrl} to ${dest}`);
          const whazingResponse = await fetch(whazingSendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${whazingToken}` },
            body: JSON.stringify(buildWhazingTextPayload(whazingUrl, dest, text)),
          });
          const whazingText = await whazingResponse.text();
          if (whazingResponse.ok) {
            console.log(`[ai-assistant] sent via Whazing/chatgoo to ${dest}`);
            return;
          }
          console.error(`[ai-assistant] Whazing/chatgoo failed (${whazingResponse.status}):`, whazingText);
        }

        const response = await fetch(`${evolution_config.api_url}/message/sendText/${evolution_config.instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolution_config.api_key },
          body: JSON.stringify({ number: dest, text }),
        });
        const responseText = await response.text();

        if (!response.ok) {
          console.error(`[ai-assistant] sendDirectWhatsApp failed (${response.status}):`, responseText);
        }
      } catch (e) {
        console.error('[ai-assistant] sendDirectWhatsApp error:', e);
      }
    };

    // Fetch booking flag once for early routing decisions (menu + option 6)
    const { data: evolutionConfigEarly, error: evolutionConfigEarlyError } = await supabase
      .from('evolution_configs')
      .select('booking_enabled')
      .eq('clinic_id', clinic_id)
      .maybeSingle();

    if (evolutionConfigEarlyError) {
      console.error('[ai-assistant] Error fetching evolution_configs (early):', evolutionConfigEarlyError);
    }

    const isBookingEnabledEarly = evolutionConfigEarly?.booking_enabled !== false;

    const cleanMessage = message.trim();

    const toExternalSelectionPrompt = (selection: string, bookingEnabled: boolean): string | null => {
      if (!/^\d+(?:-\d+)+$/.test(selection)) return null;

      const parts = selection.split('-').filter(Boolean);
      if (parts.length < 2) return null;

      const [mainOption, ...subOptions] = parts;
      const mainOptionMap: Record<string, string> = {
        '1': 'associados',
        '2': 'empresas',
        '3': 'contador/escritório contábil',
        '4': 'Dia do Comerciário',
        '5': 'falar com atendente',
        '6': bookingEnabled ? 'agendar consulta ou exame' : 'segunda via de boleto (empresa)',
        '7': 'segunda via de boleto (empresa)',
      };

      const mainLabel = mainOptionMap[mainOption] || `opção ${mainOption}`;
      const subPath = subOptions.join(' > ');

      return `Seleção recebida do menu externo: ${selection}. O usuário escolheu o fluxo "${mainLabel}" e a subopção "${subPath}". Continue o atendimento diretamente sem repetir ou exibir menu principal.`;
    };

    const externalSelectionPrompt = toExternalSelectionPrompt(cleanMessage, isBookingEnabledEarly);
    const aiInputMessage = shouldBlockInternalMenu
      ? (externalSelectionPrompt || `Modo de integração externa ativo. NÃO mostre menu interno. Responda diretamente ao conteúdo desta mensagem do usuário: "${message}".`)
      : (externalSelectionPrompt || message);

    // If user greets / asks for menu, return deterministic menu only when internal menu is allowed
    const isMenuRequest =
      /^(oi|olá|ola|bom dia|boa tarde|boa noite)\b/i.test(cleanMessage) ||
      /\b(menu|op(ç|c)ões|op(ç|c)oes|opcoes|opções|ajuda|in(í|i)cio|come(ç|c)ar|comecar)\b/i.test(cleanMessage);

    if (isMenuRequest) {
      if (suppressInternalMenu) {
        console.log('[ai-assistant] Internal menu suppressed (external menu mode)');
        return new Response(
          JSON.stringify({ response: null, handoff_to_booking: false, action: 'menu_suppressed_external_mode' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const menuText = 'Olá! 👋 Bem-vindo(a) ao atendimento.\n\nComo podemos ajudá-lo(a) hoje?\n\n1️⃣ Sou Associado\n2️⃣ Sou Empresa\n3️⃣ Sou Contabilidade';
      
      let menuButtonsSent = false;
      if (shouldSendDirectWhatsApp) {
        menuButtonsSent = await sendWhazingMainMenuButtons(phone || '');
        if (!menuButtonsSent) {
          console.error('[ai-assistant] Interactive main menu failed; not sending text-list fallback');
        }
      }

      return new Response(
        JSON.stringify({ 
          response: shouldSendDirectWhatsApp ? null : menuText, 
          handoff_to_booking: false, 
          action: 'show_menu_buttons', 
          buttons_sent: menuButtonsSent 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user selected option 6 or equivalent submenu path
    // IMPORTANT: When booking is disabled, option 6 is boleto (not booking)
    const isOption6Selection = cleanMessage === '6' || /^6(?:-\d+)+$/.test(cleanMessage);
    // Let AI handle Option 6 and other choices dynamically based on system prompt.
    // Removing early return for Option 6 to allow AI to decide between HANDOFF_BOOKING and HANDOFF_BOLETO.

    // Any other booking intent: either handoff to booking (enabled) or redirect to app (disabled)
    if (/\b(agendar|agendamento|marcar\s+consulta|marcar\s+exame|consulta|horário|horario|vaga|dispon(í|i)vel|disponivel)\b/i.test(cleanMessage) && !cleanMessage.includes('conve') && !cleanMessage.includes('cct')) {
      if (isBookingEnabledEarly) {
        console.log('[ai-assistant] Booking intent detected and booking enabled - handing off to booking flow');
        return new Response(
          JSON.stringify({ response: null, handoff_to_booking: true, action: 'start_booking_flow' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[ai-assistant] Booking intent detected but booking disabled - sending app only notification');
      return new Response(
        JSON.stringify({
          response: `⚠️ *Agendamento somente pelo aplicativo*

O agendamento por WhatsApp está desativado. Utilize nosso aplicativo para agendar suas consultas com praticidade.

📲 *Abrir o app agora:*
👉 https://prosindweb.com.br/app

_(Se o app já estiver instalado no seu celular, o link acima abrirá diretamente nele)_

📥 *Ainda não instalou?*
👉 https://prosindweb.com.br/app/instalar

• iPhone: abra pelo *Safari* → Compartilhar → Adicionar à Tela Inicial
• Android: abra pelo *Chrome* → menu ⋮ → Adicionar à tela inicial`,
          handoff_to_booking: false,
          action: 'booking_disabled_redirect',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[ai-assistant] OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({ 
        response: 'Desculpe, o sistema está temporariamente indisponível.',
        error: 'API key not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get clinic info
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinic_id)
      .single();

    const clinicName = clinic?.name || 'SECMI - Sindicato dos Comerciários de Ilhéus';

    // CRITICAL: Check booking_enabled GLOBALLY for all messages (not just option 6)
    // This prevents the AI from offering booking services when disabled
    const { data: evolutionConfigGlobal } = await supabase
      .from('evolution_configs')
      .select('booking_enabled')
      .eq('clinic_id', clinic_id)
      .maybeSingle();
    
    const isBookingEnabled = evolutionConfigGlobal?.booking_enabled !== false;
    console.log(`[ai-assistant] Global booking_enabled check: ${isBookingEnabled}`);

    // SECMI Custom System Prompt - with dynamic booking section
    const bookingEnabledSection = `## REGRAS DE AGENDAMENTO INTELIGENTE (MUITO IMPORTANTE!)
- Quando o paciente perguntar sobre disponibilidade de um profissional SEM especificar uma data específica, use IMEDIATAMENTE a função "buscar_proximas_datas_disponiveis" com o nome do profissional
- Exemplos de mensagens que DEVEM acionar buscar_proximas_datas_disponiveis:
  * "quero agendar com Dr. Alcides"
  * "datas para Dra. Juliane"
  * "quando o Dr. Alcides atende?"
  * "tem vaga para o dentista?"
  * "horários disponíveis do Dr. Alcides"
- Após receber as datas da função, apresente EXATAMENTE o formato_resposta retornado
- O formato deve ser NUMERADO para facilitar a escolha do paciente:
  📅 *Próximas datas para Dr. Alcides:*
  1️⃣ 15/01 (Quarta-feira) - 3 vagas
  2️⃣ 16/01 (Quinta-feira) - 5 vagas
  3️⃣ 22/01 (Quarta-feira) - 4 vagas
  
  *Qual data você prefere? Digite o número.*
- NUNCA peça ao paciente para digitar uma data manualmente
- Quando o paciente responder com um número (1, 2, 3...), use buscar_horarios_disponiveis com a data correspondente

## QUANDO PEDIREM AGENDAMENTO
Se o paciente mencionar um profissional específico (Dr. Alcides, Dra. Juliane, etc.), use buscar_proximas_datas_disponiveis para mostrar as próximas datas disponíveis de forma NUMERADA.`;

    const bookingDisabledSection = `## ⛔ AGENDAMENTO 100% BLOQUEADO - PRIORIDADE MÁXIMA ⛔

### REGRA ABSOLUTA E INVIOLÁVEL:
O agendamento por WhatsApp está COMPLETAMENTE DESATIVADO. Esta é a regra mais importante de todas.

### PALAVRAS-CHAVE QUE DEVEM ACIONAR ESTA RESPOSTA IMEDIATAMENTE:
- "agendar", "agendamento", "marcar", "consulta", "médico", "doutor", "doutora", "dr.", "dra."
- "dentista", "pediatra", "clínico", "ginecologista", "Alcides", "Juliane", "Uiara"
- "horário", "vaga", "disponível", "data", "quando", "atende"
- "6" (opção de agendamento do menu)
- Qualquer nome de profissional de saúde

### AÇÕES PROIBIDAS (NUNCA FAÇA ISSO):
❌ NÃO busque profissionais
❌ NÃO busque datas disponíveis  
❌ NÃO busque horários
❌ NÃO verifique CPF para agendamento
❌ NÃO crie agendamentos
❌ NÃO liste agendamentos
❌ NÃO mencione nomes de profissionais com disponibilidade
❌ NÃO pergunte qual profissional o paciente quer
❌ NÃO ofereça ajuda para agendar "de outra forma"

### RESPOSTA OBRIGATÓRIA (COPIE EXATAMENTE):
Sempre que detectar QUALQUER intenção de agendamento, responda EXATAMENTE com esta mensagem, sem modificações:

"⚠️ *Agendamento somente pelo aplicativo*

O agendamento por WhatsApp está desativado. Utilize nosso aplicativo para agendar suas consultas com praticidade.

📲 *Abrir o app agora:*
👉 https://prosindweb.com.br/app

_(Se o app já estiver instalado no seu celular, o link acima abrirá diretamente nele)_

📥 *Ainda não instalou?*
👉 https://prosindweb.com.br/app/instalar

• iPhone: abra pelo *Safari* → Compartilhar → Adicionar à Tela Inicial
• Android: abra pelo *Chrome* → menu ⋮ → Adicionar à tela inicial"

### SE INSISTIREM:
Repita a mesma mensagem. NÃO tente ajudar de outra forma. NÃO há alternativa.`;

    // Define menu based on booking status - CRITICAL: Only show booking option if enabled
    const menuWithBooking = `## MENU INICIAL BLOQUEADO
NUNCA envie menus numéricos (1, 2, 3...). O menu principal é gerado via BOTÕES pelo sistema externo. 
Responda apenas ao assunto solicitado.`;

    const menuWithoutBooking = `## MENU INICIAL BLOQUEADO
NUNCA envie menus numéricos (1, 2, 3...). O menu principal é gerado via BOTÕES pelo sistema externo. 
Responda apenas ao assunto solicitado.`;

    const externalMenuInstructions = `## MODO DE INTEGRAÇÃO (MENU EXTERNO)
- O menu principal é exibido por um sistema externo.
- NUNCA apresente o menu principal novamente.
- Quando receber seleção no formato "X-Y" (ex.: "1-2"), considere que o usuário já escolheu a opção e continue o atendimento diretamente.
- Seja objetivo e responda somente ao fluxo selecionado.`;

    const internalMenuSuppressedInstructions = `## MENU INTERNO DESATIVADO (REGRA ABSOLUTA)
- NUNCA exiba o menu principal deste sistema.
- NUNCA responda com listas de opções 1️⃣, 2️⃣, 3️⃣... como menu inicial.
- Responda diretamente ao conteúdo da mensagem do usuário.
- Se a mensagem vier no formato "X-Y", trate como escolha já feita e continue o atendimento do assunto.`;
    
    // ==========================================
    // COMPUTE BRAZILIAN TIME & HOLIDAY STATUS
    // ==========================================
    const brDateTime = getBrazilianDateTime();
    const holidayName = await isTodayHoliday(supabase, clinic_id, brDateTime.date);
    const isHoliday = !!holidayName;
    const isHumanAvailable = brDateTime.isBusinessHours && !isHoliday;
    
    console.log(`[ai-assistant] Brazilian time: ${brDateTime.formatted}, isBusinessHours: ${brDateTime.isBusinessHours}, isHoliday: ${isHoliday} (${holidayName || 'none'}), isHumanAvailable: ${isHumanAvailable}`);

    const timeContextSection = `## CONTEXTO TEMPORAL (INFORMAÇÃO DO SERVIDOR - USE PARA DECISÕES)
- **Data/Hora atual (Brasil):** ${brDateTime.formatted}
- **Dia da semana:** ${brDateTime.dayName}
- **Horário de atendimento humano:** Segunda a sexta, 09h às 16h (exceto feriados)
- **Status atual do atendimento humano:** ${isHumanAvailable ? '✅ DISPONÍVEL (dentro do horário)' : `❌ INDISPONÍVEL (${isHoliday ? `feriado: ${holidayName}` : !brDateTime.isBusinessDay ? 'fim de semana' : 'fora do horário'})`}
${isHoliday ? `- **Feriado hoje:** ${holidayName}` : ''}

IMPORTANTE: Use estas informações para decidir automaticamente se o atendimento humano está disponível. NÃO pergunte ao usuário que horas são.`;

    const systemPrompt = `## PERSONA
Você é LIA, assistente virtual especializada em atendimentos do Sindicato dos Comerciários de Ilhéus e Região (SECMI). Sua função é auxiliar associados, empresas e escritórios de contabilidade a terem acesso aos serviços disponibilizados pelo sindicato de forma eficiente e amigável.

${timeContextSection}

${externalMenuMode ? externalMenuInstructions : ''}

${shouldBlockInternalMenu ? internalMenuSuppressedInstructions : (isBookingEnabled ? menuWithBooking : menuWithoutBooking)}

${isBookingEnabled ? bookingEnabledSection : bookingDisabledSection}

## REGRAS DE FLUXO
${isBookingEnabled ? `- Se digitar 1: mostre opções para associados
- Se digitar 2: mostre opções para empresas (NÃO solicite CNPJ nem e-mail, siga o fluxo)
- Se digitar 3: mostre opções para contabilidade
- Se digitar 4: pergunte sobre qual assunto do Dia do Comerciário
- Se digitar 5: interaja perguntando sobre qual assunto precisa tratar (veja regras abaixo em FALAR COM ATENDENTE / OUTROS ASSUNTOS)
- Se digitar 6: RESPONDA APENAS: "HANDOFF_BOOKING" (o sistema de agendamento assumirá)
- Se digitar 7: RESPONDA APENAS: "HANDOFF_BOLETO" (o sistema de boleto empresa assumirá)` : `- Se digitar 1: mostre opções para associados
- Se digitar 2: mostre opções para empresas (NÃO solicite CNPJ nem e-mail, siga o fluxo)
- Se digitar 3: mostre opções para contabilidade
- Se digitar 4: pergunte sobre qual assunto do Dia do Comerciário
- Se digitar 5: interaja perguntando sobre qual assunto precisa tratar (veja regras abaixo em FALAR COM ATENDENTE / OUTROS ASSUNTOS)
- Se digitar 6: RESPONDA APENAS: "HANDOFF_BOLETO" (o sistema de boleto empresa assumirá)
- Se alguém pedir agendamento: Redirecione para o app (agendamento suspenso no WhatsApp)`}

## FALAR COM ATENDENTE / OUTROS ASSUNTOS (OPÇÃO 5)
Quando o usuário escolher a opção 5, digitar "falar com atendente", "outros assuntos", "atendente", ou qualquer variação:
1. **NÃO transfira imediatamente.** Primeiro, pergunte educadamente sobre qual assunto o usuário precisa tratar.
   Exemplo de resposta:
   "Para que eu possa direcionar você ao atendente mais adequado, poderia me informar sobre qual assunto precisa tratar? 😊
   
   Por exemplo:
   • Dúvidas sobre associação
   • Questões jurídicas
   • Carteirinha ou cadastro
   • Convenção coletiva
   • Outro assunto"
2. **Se o usuário responder "Outro assunto", "outro", "outros", ou qualquer resposta vaga/genérica que não especifique um assunto claro**, NÃO pergunte novamente. Trate como pedido direto de atendimento humano e prossiga imediatamente com o encaminhamento (passo 3).
3. **Após o usuário informar um assunto ESPECÍFICO**, tente responder a dúvida diretamente se estiver dentro dos seus conhecimentos (CCT, piso salarial, endereço, horários, etc.).
4. **Se não conseguir resolver** ou se o usuário insistir em falar com um humano:
   **IMPORTANTE:** Sempre informe que o atendimento humano funciona de **segunda a sexta-feira, das 09h às 16h, exceto feriados**.
   
   ${isHumanAvailable ? `### ATENDIMENTO HUMANO DISPONÍVEL (AGORA)
   O atendimento humano está disponível AGORA. Encaminhe normalmente:
   Exemplo: "Entendi! Vou encaminhar você para um atendente que poderá ajudar com [assunto]. Nosso atendimento humano funciona de segunda a sexta, das 09h às 16h (exceto feriados). Por favor, aguarde um momento. 🙏"` : `### ATENDIMENTO HUMANO INDISPONÍVEL (AGORA)
   O atendimento humano NÃO está disponível agora (${isHoliday ? `feriado: ${holidayName}` : !brDateTime.isBusinessDay ? 'fim de semana' : 'fora do horário comercial'}).
   
   **FLUXO OBRIGATÓRIO quando fora do horário:**
   a) Informe que o atendimento humano está indisponível no momento e o horário de funcionamento.
   b) **OFEREÇA ao usuário a opção de abrir um chamado** para que o atendente responda quando estiver disponível.
      Exemplo: "Nosso atendimento humano funciona de segunda a sexta-feira, das 09h às 16h (exceto feriados). No momento estamos fora do horário. 😊
      
      Mas posso abrir um *chamado* para você! Assim, quando nosso atendimento retornar, um atendente já terá o seu pedido e entrará em contato. Deseja que eu abra o chamado? 📋"
   c) **Se o usuário ACEITAR abrir o chamado**, use a função "abrir_chamado_atendimento" com o assunto informado pelo usuário.
   d) **Após abrir o chamado com sucesso**, confirme: "Pronto! ✅ Seu chamado sobre *[assunto]* foi registrado com sucesso. Um atendente entrará em contato assim que o atendimento estiver disponível (segunda a sexta, 09h-16h). 🙏"
   e) **Se o usuário NÃO quiser abrir chamado**, respeite e informe que pode retornar no horário de atendimento.`}

## DADOS DE CONTATO DO SINDICATO (USE EXATAMENTE ESTES DADOS!)
- Telefone/WhatsApp: 73 3098-2161
- Endereço COMPLETO: Rua Coronel Paiva, 99 - Centro, Ilhéus-BA (ao lado da Chiquinho Sorvetes)
- Email: sindicomerciariosios@hotmail.com
- Site: https://comerciariosilheus.org.br

## PERGUNTAS SOBRE LOCALIZAÇÃO/ENDEREÇO (RESPONDA EXATAMENTE ASSIM)
Quando o usuário perguntar "onde fica", "qual o endereço", "como chegar", "localização", ou qualquer variação, responda EXATAMENTE:
"📍 *Endereço do SECMI:*
Rua Coronel Paiva, 99 - Centro, Ilhéus-BA
(ao lado da Chiquinho Sorvetes)

📞 Telefone: 73 3098-2161

Se precisar de ajuda para chegar, é só avisar!"

NUNCA INVENTE endereços como "Rua da Saúde, 123" ou "Cidade Exemplo". USE SOMENTE o endereço real acima.

## ATENDIMENTO ASSOCIADOS
**Atualização de carteirinha:**
Se pedir atualização, solicite imagem do contracheque mais recente. Após envio, peça para aguardar que será feita por atendente.

**Carteirinha/cadastro expirados:**
Responda: "Isso acontece porque a validade expirou. Para atualizar, envie a imagem do contracheque mais recente."

**Assunto jurídico:**
Atendimento somente para associados, às terças e quintas-feiras com Dra. Dione Mattos.

 ## PROFISSIONAIS E ESPECIALIDADES
 - Dr. Alcides (clínico geral): Atende quartas (13h-14h40) e quintas (08h-09h40).
 - Dra. Juliane Leite (dentista): Atende segundas e quartas (08h e 14h).
 - Dra. Uiara Tiuba (pediatra): Atende terças (14h30-15h10).
 - Dr. Pedro Roberto (urologista): Verificar disponibilidade.
 - Dra. Daniela Sales (massagem relaxante e terapia ocupacional).
 - Dra. Eliney Silva (psicologia).
 - Dr. Marcelo Aguiar (dentista).
 - Dr. Jorge Avelar (ortopedia).
 - Ginecologista: Sem atendimento no momento (em negociação).
 
 IMPORTANTE: Se o usuário pedir para agendar com algum desses profissionais, use a função "buscar_proximas_datas_disponiveis" para mostrar as opções reais da agenda.

## CONVENÇÕES COLETIVAS
**CCT 2025/2026 Comércio Varejista:** Encerrada (vigência expirou em 28/02/2026). Link para consulta: https://abre.ai/mxQj
**CCT 2025/2026 Supermercado:** Encerrada (vigência expirou em 28/02/2026). Link para consulta: https://abre.ai/nh7m
**CCT 2026/2027 (Varejista e Supermercado):** Quando o usuário perguntar sobre CCT, convenção coletiva, CCT 2026, CCT 2027, ou qualquer assunto relacionado à convenção coletiva atual, responda EXATAMENTE com a mensagem abaixo, sem alterar, resumir ou parafrasear:

"O Sindicato dos Comerciários de Ilhéus e Região informa que a Convenção Coletiva de Trabalho (CCT) 2026/2027 do comércio varejista de Ilhéus e demais cidades da base territorial, bem como do comércio atacadista (supermercados), ainda não foi finalizada.

As negociações seguem em andamento entre as partes envolvidas, não havendo, até o presente momento, definição ou fechamento dos termos da nova convenção.

 No que se refere ao comércio varejista, as negociações seguem em andamento, ocasião em que as partes darão continuidade às tratativas, com o objetivo de avançar e buscar a formalização da CCT.
 
 O Sindicato reforça seu compromisso em manter a categoria informada sobre quaisquer atualizações.

Atenciosamente,
Sindicato dos Comerciários de Ilhéus e Região"

**Todas CCTs anteriores:** https://comerciariosilheus.org.br/ccts/

## PISO SALARIAL 2025
- Nível 01 (R$1.525): Servente, Contínuo, Boy, Faxineiro, Serviços Gerais, Carregador, Empacotador, etc.
- Nível 02 (R$1.560): Conferente, Repositor, Telefonista, Atendente, Secretária, Digitador, etc.
- Nível 03 (R$1.600): Vendedor, Balconista e Caixa
- Nível 04 (R$2.050): Encarregado de Loja, Subgerente e Gerente

## APLICATIVO DO SINDICATO
- Instalação universal: https://prosindweb.com.br/app/instalar
- Link direto (app instalado): https://prosindweb.com.br/app

## HOMOLOGAÇÃO
Link: https://prosindweb.com.br/homologacao/sindicato

## SEGUNDA VIA DE BOLETO (EMPRESAS)
⚠️ IMPORTANTE: Quando o usuário solicitar segunda via de boleto, 2ª via, boleto vencido, ou qualquer pedido relacionado a boleto empresarial, NÃO tente processar manualmente.
RESPONDA APENAS: "HANDOFF_BOLETO" - o sistema automatizado de boletos assumirá o atendimento.

## CARTA DE OPOSIÇÃO / DESCONTO TAXA NEGOCIAL
Procedimento presencial na sede até 09/05/2025 (Comércio Varejista).

## DIA DO COMERCIÁRIO (30/10)
Para Comércio Varejista: Não é feriado. Funcionamento normal. Direito a folga no aniversário + bonificação R$65,00.
Para Mercados: Não é feriado. Funcionamento normal. Folga no aniversário se trabalhar dia 30/10 + bonificação R$66,25.

## FERIADO 20 DE NOVEMBRO
Dia da Consciência Negra é feriado nacional. Comércio varejista não opera, exceto supermercados, farmácias e essenciais.

## LANCHE HORA EXTRA (Cláusula 9ª)
Empresas devem fornecer lanche gratuito para quem trabalhar mais de 1 hora extra. Se não fornecer: reembolso mínimo R$20,00 com nota fiscal.

## REGRAS IMPORTANTES
- NUNCA trate pessoas como "clientes", são associados
- Devoluções/estornos de Taxa Negocial: transfira para atendimento humano
- Salário de padeiro: não representamos essa categoria (apenas Sindipan)
- Falar com atendente: consulte o CONTEXTO TEMPORAL acima para saber se o atendimento humano está disponível. Horário: segunda a sexta, 09h-16h, exceto feriados. Fora do horário, ofereça abrir chamado.
- Problemas com agendamento no app: peça CPF do titular para verificar
- Problemas com agendamento no app: peça CPF do titular para verificar
- DESPEDIDAS: Quando o usuário se despedir (tchau, obrigado, até logo, etc.), responda APENAS com uma frase curta de despedida (ex: "Disponha! Até mais! 👋"). NUNCA repita dados de contato na despedida - o sistema já envia essas informações automaticamente.`;

    // Build messages array with history
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (conversation_history && Array.isArray(conversation_history)) {
      messages.push(...conversation_history);
    }

    messages.push({ role: 'user', content: aiInputMessage });

    console.log('[ai-assistant] Sending to AI with', messages.length, 'messages');

    // Filter tools based on booking_enabled status
    // When booking is disabled, remove ALL tools to prevent any booking attempts
    // This is a critical safety measure - the AI should ONLY respond with text
    const bookingToolNames = [
      'buscar_profissionais',
      'buscar_proximas_datas_disponiveis', 
      'buscar_horarios_disponiveis',
      'buscar_paciente_por_cpf',
      'criar_agendamento',
      'listar_agendamentos_paciente',
      'cancelar_agendamento'
    ];
    
    // CRITICAL: When booking is disabled, only provide support tools (ticket creation)
    // When booking is enabled, provide all tools + support tools
    const activeTools = isBookingEnabled 
      ? [...tools, ...supportTools]
      : [...supportTools]; // Only support tools when booking is disabled
    
    console.log(`[ai-assistant] Booking enabled: ${isBookingEnabled}, Active tools: ${activeTools.length > 0 ? activeTools.map(t => t.function.name).join(', ') : 'NONE (booking disabled)'}`);
    
    // Additional safety: If booking is disabled and message contains booking keywords, 
    // return the maintenance message immediately without calling the AI
    if (!isBookingEnabled) {
      // Skip booking keyword check if message is clearly about human support (not scheduling)
      const isHumanSupportRequest = /\b(atendente|falar com|suporte|chamado|ajuda humana|atendimento humano)\b/i.test(message);

      // Comprehensive list of booking-related keywords in Portuguese
      const bookingKeywords = [
        // Verbos de agendamento
        'agendar', 'agendamento', 'agenda', 'marcar', 'marcacao', 'remarcar',
        'desmarcar', 'cancelar consulta', 'cancelar agendamento', 'reagendar',
        'retornar', 'retorno',
        // Palavras médicas - QUALQUER menção = bloqueio
        'consulta', 'consultas', 'medico', 'medicos', 'doutor', 'doutora',
        'dr.', 'dra.', 'dr ', 'dra ', 'dentista', 'pediatra', 'clinico', 
        'clinica geral', 'ginecologista', 'especialista', 'ortopedista',
        'cardiologista', 'nutricionist', 'fisioterapeuta', 'psicologo',
        'psicologa', 'pediatrico',
        // Nomes de profissionais do SECMI
        'alcides', 'juliane', 'uiara', 'tiuba',
        // Horários e disponibilidade (scheduling-specific, NOT "atende" alone)
        'horario', 'horarios', 'vaga', 'vagas', 'disponivel', 'disponibilidade',
        'quando atende', 'dias de atendimento',
        // Frases comuns
        'quero agendar', 'preciso agendar', 'gostaria de agendar',
        'quero marcar', 'preciso marcar', 'gostaria de marcar',
        'tem vaga', 'tem horario', 'proxima data', 'proxima semana',
        'data disponivel', 'quero consulta', 'preciso de consulta',
        'ir ao medico', 'ver medico', 'exame', 'exames',
      ];
      
      const messageLower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const keywordsNormalized = bookingKeywords.map(kw => kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      const isBookingMenuOption = /^[1-4]$/.test(message.trim());
      const isBookingRequest = !isHumanSupportRequest && (isBookingMenuOption || keywordsNormalized.some(kw => messageLower.includes(kw)));
      
      const APP_ONLY_RESPONSE = `⚠️ *Agendamento somente pelo aplicativo*

O agendamento por WhatsApp está desativado. Utilize nosso aplicativo para agendar suas consultas com praticidade.

📲 *Abrir o app agora:*
👉 https://prosindweb.com.br/app

_(Se o app já estiver instalado no seu celular, o link acima abrirá diretamente nele)_

📥 *Ainda não instalou?*
👉 https://prosindweb.com.br/app/instalar

• iPhone: abra pelo *Safari* → Compartilhar → Adicionar à Tela Inicial
• Android: abra pelo *Chrome* → menu ⋮ → Adicionar à tela inicial`;
      
      if (isBookingRequest) {
        console.log(`[ai-assistant] BLOCKED (booking disabled): detected booking intent. Message: "${message.substring(0, 60)}"`);
        return new Response(JSON.stringify({ 
          response: APP_ONLY_RESPONSE,
          booking_blocked: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Helper function to call Lovable AI Gateway
    const callAI = async (msgs: any[], useTools: boolean = true): Promise<Response> => {
      return await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: msgs,
          ...(useTools && activeTools.length > 0 ? { tools: activeTools, tool_choice: 'auto' } : {}),
        }),
      });
    };

    // First API call with tools
    let response = await callAI(messages);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ai-assistant] AI gateway error:', response.status, errorText);

      if (response.status === 402) {
        return new Response(JSON.stringify({
          response: 'Atendimento temporariamente indisponível por limite de créditos da IA. Tente novamente em instantes.',
          error_code: 402,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          response: 'Estamos com muitas solicitações no momento. Por favor, aguarde alguns segundos e tente novamente.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        response: 'Desculpe, não consegui processar sua mensagem. Tente novamente.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;

    // Handle tool calls in a loop
    let iterations = 0;
    const maxIterations = 5;

    while (assistantMessage?.tool_calls && iterations < maxIterations) {
      iterations++;
      console.log(`[ai-assistant] Processing ${assistantMessage.tool_calls.length} tool calls (iteration ${iterations})`);

      // Execute all tool calls
      const toolResults: any[] = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        // Inject phone into tool args for ticket creation
        if (toolName === 'abrir_chamado_atendimento') {
          toolArgs._phone = phone || '';
        }
        
        const result = await executeTool(supabase, clinic_id, toolName, toolArgs);
        
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }

      // Add assistant message and tool results to conversation
      messages.push(assistantMessage);
      messages.push(...toolResults);

      // Call AI again with tool results - using helper with fallback
      response = await callAI(messages);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ai-assistant] AI gateway error on tool response:', response.status, errorText);
        break;
      }

      data = await response.json();
      assistantMessage = data.choices?.[0]?.message;
    }

    let finalResponse = assistantMessage?.content || 'Desculpe, não consegui processar sua mensagem.';

    const looksLikeInternalMenu = (text: string): boolean => {
      const normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return normalized.includes('como posso ajudar? escolha uma opcao') &&
        normalized.includes('sou associado') &&
        normalized.includes('falar com atendente');
    };

    if (shouldBlockInternalMenu && looksLikeInternalMenu(finalResponse)) {
      console.warn('[ai-assistant] Internal menu leaked in external mode - retrying without menu');

      try {
        const retryMessages = [
          ...messages,
          { role: 'assistant', content: finalResponse },
          {
            role: 'user',
            content: 'Sua resposta anterior mostrou menu interno, o que é proibido. Reescreva agora sem menu e continue diretamente o atendimento do assunto já escolhido pelo usuário.'
          }
        ];

        const retryResponse = await callAI(retryMessages, false);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retriedContent = retryData?.choices?.[0]?.message?.content;
          if (retriedContent) {
            finalResponse = retriedContent;
          }
        }
      } catch (retryError) {
        console.error('[ai-assistant] Retry without menu failed:', retryError);
      }
    }

    if (shouldBlockInternalMenu && looksLikeInternalMenu(finalResponse)) {
      finalResponse = externalSelectionPrompt
        ? 'Perfeito, recebi sua escolha no menu externo e vou seguir direto com seu atendimento.'
        : 'Perfeito, vamos seguir sem menu. Me diga objetivamente o que você precisa e eu te ajudo.';
    }

    if (!shouldBlockInternalMenu && (looksLikeInternalMenu(finalResponse) || finalResponse?.includes('como posso te ajudar hoje?'))) {
      console.warn('[ai-assistant] Internal text menu replaced by interactive WhatsApp buttons');
      const menuText = 'Olá! 👋 Bem-vindo(a) ao atendimento.\n\nComo podemos ajudá-lo(a) hoje?\n\n1️⃣ Sou Associado\n2️⃣ Sou Empresa\n3️⃣ Sou Contabilidade';
      
      let menuButtonsSent = false;
      if (shouldSendDirectWhatsApp) {
        menuButtonsSent = await sendWhazingMainMenuButtons(phone || '');
      }

      return new Response(JSON.stringify({
        response: shouldSendDirectWhatsApp ? null : menuText,
        handoff_to_booking: false,
        action: 'show_menu_buttons',
        buttons_sent: menuButtonsSent,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ai-assistant] Final response:', finalResponse.substring(0, 100));

    // Check HANDOFF_BOLETO FIRST - before any booking block filters
    // This ensures option 6 always works regardless of booking_enabled status
    if (finalResponse.includes('HANDOFF_BOLETO')) {
      console.log('[ai-assistant] AI requested handoff to boleto flow (checked BEFORE booking block)');
      return new Response(JSON.stringify({ 
        response: null,
        handoff_to_boleto: true,
        action: 'start_boleto_flow'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check HANDOFF_BOOKING before booking block too
    if (finalResponse.includes('HANDOFF_BOOKING')) {
      if (isBookingEnabled) {
        console.log('[ai-assistant] Booking enabled - proceeding with handoff');
        return new Response(JSON.stringify({ 
          response: null,
          handoff_to_booking: true,
          action: 'start_booking_flow'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // If booking disabled, fall through to the booking block below
    }

    // DEFINITIVE SAFETY NET: If booking is disabled, NEVER allow any booking-related handoff or message
    // This catches any case where the AI ignores the system prompt instructions
    const APP_ONLY_MESSAGE = `⚠️ *Agendamento somente pelo aplicativo*

O agendamento por WhatsApp está desativado. Utilize nosso aplicativo para agendar suas consultas com praticidade.

📲 *Abrir o app agora:*
👉 https://prosindweb.com.br/app

_(Se o app já estiver instalado no seu celular, o link acima abrirá diretamente nele)_

📥 *Ainda não instalou?*
👉 https://prosindweb.com.br/app/instalar

• iPhone: abra pelo *Safari* → Compartilhar → Adicionar à Tela Inicial
• Android: abra pelo *Chrome* → menu ⋮ → Adicionar à tela inicial`;

    if (!isBookingEnabled) {
      // ABSOLUTE BLOCK: When booking is disabled, filter ALL booking-related content from AI response
      const responseNormalized = finalResponse.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      const bookingSignals = [
        'handoff_booking',
        'agendar consulta',
        'agendar exame',
        'marcar consulta',
        'marcar exame',
        'agendar medico',
        'agendar dentista',
        'horario disponivel',
        'horarios disponiveis',
        'proxima data disponivel',
        'buscar_profissionais',
        'buscar_horarios',
        'criar_agendamento',
        'atendente de agendamento',
      ];

      const hasBookingSignal = bookingSignals.some(signal => responseNormalized.includes(signal));

      if (hasBookingSignal) {
        console.log('[ai-assistant] ABSOLUTE BLOCK: AI response contains booking signal while disabled. Suppressing.');
        await sendDirectWhatsApp(APP_ONLY_MESSAGE);
        return new Response(JSON.stringify({
          response: APP_ONLY_MESSAGE,
          handoff_to_booking: false,
          booking_blocked: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    await sendDirectWhatsApp(finalResponse);
    return new Response(JSON.stringify({ 
      response: finalResponse,
      tool_calls_made: iterations
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ai-assistant] Error:', error);
    return new Response(JSON.stringify({ 
      response: 'Desculpe, ocorreu um erro. Por favor, tente novamente.',
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
