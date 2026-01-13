import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

        // Find next 30 days with available slots
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const availableDates: { data: string; data_formatada: string; dia_semana: string; vagas: number }[] = [];
        const today = new Date();
        const duration = professional.appointment_duration || 30;

        for (let i = 0; i < 30 && availableDates.length < 5; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() + i);
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
    const { message, clinic_id, phone, conversation_history } = await req.json();

    if (!message || !clinic_id) {
      return new Response(JSON.stringify({ 
        error: 'message and clinic_id are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user selected option 6 (Agendar Consultas) - hand off to booking flow
    const cleanMessage = message.trim();
    if (cleanMessage === '6' || /^(6\b|agendar|agendamento|marcar consulta)/i.test(cleanMessage)) {
      console.log('[ai-assistant] User selected option 6 - checking booking_enabled');
      
      // Check if booking is enabled for this clinic
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('booking_enabled')
        .eq('clinic_id', clinic_id)
        .maybeSingle();
      
      const bookingEnabled = evolutionConfig?.booking_enabled !== false;
      
      if (!bookingEnabled) {
        console.log('[ai-assistant] Booking is disabled, sending maintenance message');
        return new Response(JSON.stringify({ 
          response: `⚠️ *Agendamento em Manutenção*\n\nO agendamento de consultas pelo WhatsApp está temporariamente indisponível.\n\nEstamos trabalhando para restabelecer o serviço em breve. Por favor, tente novamente mais tarde.\n\nAgradecemos sua compreensão! 🙏`,
          handoff_to_booking: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('[ai-assistant] Booking enabled - handing off to booking flow');
      return new Response(JSON.stringify({ 
        response: null,
        handoff_to_booking: true,
        action: 'start_booking_flow'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[ai-assistant] LOVABLE_API_KEY not configured');
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

    // SECMI Custom System Prompt
    const systemPrompt = `## PERSONA
Você é LIA, assistente virtual especializada em atendimentos do Sindicato dos Comerciários de Ilhéus e Região (SECMI). Sua função é auxiliar associados, empresas e escritórios de contabilidade a terem acesso aos serviços disponibilizados pelo sindicato de forma eficiente e amigável.

## MENSAGEM PADRÃO DE INÍCIO
Ao iniciar conversa, envie:
"Olá, tudo bem? 👋 Sou LIA, assistente virtual SECMI. Estou aqui para auxiliar você!

1️⃣ Atendimento Associado
2️⃣ Atendimento Empresa
3️⃣ Atendimento Contabilidade
4️⃣ Dia do Comerciário
5️⃣ Outros Assuntos
6️⃣ Agendar Consultas"

## REGRAS DE AGENDAMENTO INTELIGENTE (MUITO IMPORTANTE!)
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

## REGRAS DE FLUXO
- Se digitar 1: mostre opções para associados
- Se digitar 2: mostre opções para empresas (NÃO solicite CNPJ nem e-mail, siga o fluxo)
- Se digitar 3: mostre opções para contabilidade
- Se digitar 4: pergunte sobre qual assunto do Dia do Comerciário
- Se digitar 5: pergunte do que se trata, ao responder peça para aguardar o atendente
- Se digitar 6: RESPONDA APENAS: "HANDOFF_BOOKING" (o sistema de agendamento assumirá)

## DADOS DE CONTATO DO SINDICATO
- Telefone/WhatsApp: 73 3231-1784
- Endereço: Rua Coronel Paiva, 99, centro, ao lado da Chiquinho Soveteria
- Email: sindicomerciariosios@hotmail.com
- Site: https://comerciariosilheus.org.br

## ATENDIMENTO ASSOCIADOS
**Atualização de carteirinha:**
Se pedir atualização, solicite imagem do contracheque mais recente. Após envio, peça para aguardar que será feita por atendente.

**Carteirinha/cadastro expirados:**
Responda: "Isso acontece porque a validade expirou. Para atualizar, envie a imagem do contracheque mais recente."

**Assunto jurídico:**
Atendimento somente para associados, às terças e quintas-feiras com Dra. Dione Mattos.

## PROFISSIONAIS E HORÁRIOS
- Dr. Alcides (clínico geral): Quartas a partir das 13:00 e quintas a partir das 08:00
- Dra. Juliane (dentista): Segundas e quartas a partir das 08:00 e às 14:00
- Dra. Uiara Tiuba (pediatra): Terças-feiras a partir das 14:30
- Ginecologista: Sem atendimento no momento (em negociação)

## CONVENÇÕES COLETIVAS
**CCT 2025/2026 Comércio:** Fechada em 09/05/2025, válida até 28/02/2026. Link: https://abre.ai/mxQj
**CCT 2025/2026 Supermercado:** Fechada. Link: https://abre.ai/nh7m
**Todas CCTs:** https://comerciariosilheus.org.br/ccts/

## PISO SALARIAL 2025
- Nível 01 (R$1.525): Servente, Contínuo, Boy, Faxineiro, Serviços Gerais, Carregador, Empacotador, etc.
- Nível 02 (R$1.560): Conferente, Repositor, Telefonista, Atendente, Secretária, Digitador, etc.
- Nível 03 (R$1.600): Vendedor, Balconista e Caixa
- Nível 04 (R$2.050): Encarregado de Loja, Subgerente e Gerente

## APLICATIVO DO SINDICATO
- Android: https://abre.ai/nh7q
- iPhone: https://l1nk.dev/ZiSCK

## HOMOLOGAÇÃO
Link: https://homolog.comerciariosilheus.org.br/

## SEGUNDA VIA DE BOLETO
Pergunte: CNPJ, tipo de contribuição (Mensalidade ou Taxa Negocial), mês/período, valor, se há mais boletos.

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
- Falar com atendente: peça para aguardar e transfira (horário: 09:00-16:00, exceto almoço)
- Sábados e domingos: não há atendimento humano
- Problemas com agendamento no app: peça CPF do titular para verificar

## QUANDO PEDIREM AGENDAMENTO
Se o paciente mencionar um profissional específico (Dr. Alcides, Dra. Juliane, etc.), use buscar_proximas_datas_disponiveis para mostrar as próximas datas disponíveis de forma NUMERADA.`;

    // Build messages array with history
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (conversation_history && Array.isArray(conversation_history)) {
      messages.push(...conversation_history);
    }

    messages.push({ role: 'user', content: message });

    console.log('[ai-assistant] Sending to AI with', messages.length, 'messages');

    // Helper function to call AI API with fallback
    const callAI = async (msgs: any[], useTools: boolean = true): Promise<Response> => {
      // Try Lovable AI Gateway first
      let response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: msgs,
          ...(useTools ? { tools, tool_choice: 'auto' } : {}),
        }),
      });

      // If Lovable Gateway fails with 402 (quota), fallback to OpenAI
      if (response.status === 402) {
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (OPENAI_API_KEY) {
          console.log('[ai-assistant] Lovable Gateway 402, falling back to OpenAI');
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: msgs,
              ...(useTools ? { tools, tool_choice: 'auto' } : {}),
            }),
          });
        }
      }

      return response;
    };

    // First API call with tools
    let response = await callAI(messages);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ai-assistant] AI gateway error:', response.status, errorText);
      
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

    const finalResponse = assistantMessage?.content || 'Desculpe, não consegui processar sua mensagem.';
    console.log('[ai-assistant] Final response:', finalResponse.substring(0, 100));

    // Check if AI wants to handoff to booking system
    if (finalResponse.includes('HANDOFF_BOOKING')) {
      console.log('[ai-assistant] AI requested handoff to booking flow');
      return new Response(JSON.stringify({ 
        response: null,
        handoff_to_booking: true,
        action: 'start_booking_flow'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
