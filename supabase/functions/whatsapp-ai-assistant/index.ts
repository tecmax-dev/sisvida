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
      name: "buscar_horarios_disponiveis",
      description: "Busca horários disponíveis para um profissional em uma data específica",
      parameters: {
        type: "object",
        properties: {
          professional_id: { 
            type: "string", 
            description: "ID do profissional" 
          },
          data: { 
            type: "string", 
            description: "Data no formato YYYY-MM-DD" 
          }
        },
        required: ["professional_id", "data"]
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
      description: "Cria um novo agendamento de consulta",
      parameters: {
        type: "object",
        properties: {
          patient_id: { 
            type: "string", 
            description: "ID do paciente" 
          },
          professional_id: { 
            type: "string", 
            description: "ID do profissional" 
          },
          data: { 
            type: "string", 
            description: "Data no formato YYYY-MM-DD" 
          },
          horario: { 
            type: "string", 
            description: "Horário no formato HH:MM" 
          },
          procedure_id: { 
            type: "string", 
            description: "ID do procedimento (opcional)" 
          }
        },
        required: ["patient_id", "professional_id", "data", "horario"]
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
          .eq('is_active', true)
          .eq('accepts_online_booking', true);

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

      case "buscar_horarios_disponiveis": {
        const { professional_id, data } = args;
        
        // Get professional schedule
        const { data: professional } = await supabase
          .from('professionals')
          .select('schedule, default_duration_minutes')
          .eq('id', professional_id)
          .single();

        if (!professional?.schedule) {
          return JSON.stringify({ 
            success: false, 
            message: "Profissional não possui agenda configurada." 
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
            message: "Profissional não atende neste dia." 
          });
        }

        // Get existing appointments
        const { data: existingAppts } = await supabase
          .from('appointments')
          .select('start_time, end_time')
          .eq('professional_id', professional_id)
          .eq('appointment_date', data)
          .not('status', 'in', '("cancelled","no_show")');

        const bookedTimes = new Set(existingAppts?.map((a: any) => a.start_time) || []);
        const duration = professional.default_duration_minutes || 30;

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
            message: "Não há horários disponíveis nesta data." 
          });
        }

        return JSON.stringify({ 
          success: true, 
          horarios: filteredSlots.slice(0, 10) // Limit to 10 options
        });
      }

      case "buscar_paciente_por_cpf": {
        const cpf = args.cpf.replace(/\D/g, '');
        
        const { data: patient } = await supabase
          .from('patients')
          .select('id, name, phone')
          .eq('clinic_id', clinicId)
          .eq('cpf', cpf)
          .single();

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
        const { patient_id, professional_id, data, horario, procedure_id } = args;

        // Calculate end time
        const { data: professional } = await supabase
          .from('professionals')
          .select('default_duration_minutes')
          .eq('id', professional_id)
          .single();

        const duration = professional?.default_duration_minutes || 30;
        const [h, m] = horario.split(':').map(Number);
        const endMinutes = h * 60 + m + duration;
        const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        const { data: appointment, error } = await supabase
          .from('appointments')
          .insert({
            clinic_id: clinicId,
            patient_id,
            professional_id,
            procedure_id: procedure_id || null,
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get clinic info
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinic_id)
      .single();

    const clinicName = clinic?.name || 'nossa clínica';

    const systemPrompt = `Você é um assistente virtual de agendamento de consultas da ${clinicName} via WhatsApp. 
Seja sempre educado, objetivo e helpful.

SUAS CAPACIDADES:
- Buscar profissionais disponíveis
- Verificar horários disponíveis
- Criar agendamentos
- Listar agendamentos do paciente
- Cancelar agendamentos

FLUXO TÍPICO:
1. Pergunte o CPF do paciente para identificá-lo
2. Pergunte qual profissional deseja (ou liste as opções)
3. Pergunte a data desejada
4. Mostre os horários disponíveis
5. Confirme e crie o agendamento

REGRAS:
- Sempre confirme os dados antes de criar um agendamento
- Se o paciente não estiver cadastrado, informe que precisa ir presencialmente
- Use linguagem simples e emojis moderadamente
- Formate datas como DD/MM/AAAA
- Se algo der errado, peça desculpas e sugira tentar novamente

IMPORTANTE: Use as ferramentas disponíveis para buscar dados reais do sistema.`;

    // Build messages array with history
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (conversation_history && Array.isArray(conversation_history)) {
      messages.push(...conversation_history);
    }

    messages.push({ role: 'user', content: message });

    console.log('[ai-assistant] Sending to AI with', messages.length, 'messages');

    // First API call with tools
    let response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        tools,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ai-assistant] AI gateway error:', response.status, errorText);
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

      // Call AI again with tool results
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          tools,
          tool_choice: 'auto',
        }),
      });

      if (!response.ok) {
        console.error('[ai-assistant] AI gateway error on tool response');
        break;
      }

      data = await response.json();
      assistantMessage = data.choices?.[0]?.message;
    }

    const finalResponse = assistantMessage?.content || 'Desculpe, não consegui processar sua mensagem.';
    console.log('[ai-assistant] Final response:', finalResponse.substring(0, 100));

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
