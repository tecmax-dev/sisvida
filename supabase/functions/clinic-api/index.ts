import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

interface ApiKey {
  id: string;
  clinic_id: string;
  permissions: string[];
  is_active: boolean;
}

// Hash simples para comparação de API keys
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validar API Key e retornar dados
async function validateApiKey(supabase: any, apiKeyRaw: string): Promise<ApiKey | null> {
  const apiKeyHash = await hashApiKey(apiKeyRaw);
  
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, clinic_id, permissions, is_active, expires_at')
    .eq('api_key_hash', apiKeyHash)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error || !data) {
    console.log('API key not found or error:', error);
    return null;
  }
  
  // Verificar expiração
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.log('API key expired');
    return null;
  }
  
  // Atualizar last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  
  return data;
}

// Verificar permissão específica
function hasPermission(apiKey: ApiKey, permission: string): boolean {
  return apiKey.permissions?.includes(permission) || false;
}

// Registrar log de API
async function logApiCall(
  supabase: any, 
  apiKeyId: string | null, 
  clinicId: string, 
  endpoint: string, 
  method: string, 
  requestBody: any, 
  responseStatus: number,
  responseBody: any,
  startTime: number,
  req: Request
) {
  try {
    await supabase.from('api_logs').insert({
      api_key_id: apiKeyId,
      clinic_id: clinicId,
      endpoint,
      method,
      request_body: requestBody,
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: Date.now() - startTime,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent'),
    });
  } catch (e) {
    console.error('Error logging API call:', e);
  }
}

// Resposta de erro padrão
function errorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Resposta de sucesso
function successResponse(data: any, status: number = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Extrair API Key do header
  const apiKeyRaw = req.headers.get('x-api-key');
  
  if (!apiKeyRaw) {
    return errorResponse('API key required. Use header: X-API-Key', 401);
  }

  // Validar API Key
  const apiKey = await validateApiKey(supabase, apiKeyRaw);
  
  if (!apiKey) {
    return errorResponse('Invalid or expired API key', 401);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(p => p && p !== 'clinic-api');
  const method = req.method;
  
  let requestBody: any = null;
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    try {
      requestBody = await req.json();
    } catch {
      requestBody = null;
    }
  }

  console.log(`[clinic-api] ${method} /${pathParts.join('/')} - Clinic: ${apiKey.clinic_id}`);

  let response: Response;
  
  try {
    // ===== PROFESSIONALS =====
    if (pathParts[0] === 'professionals') {
      // GET /professionals - Listar profissionais ativos
      if (method === 'GET' && pathParts.length === 1) {
        if (!hasPermission(apiKey, 'read:professionals')) {
          response = errorResponse('Permission denied: read:professionals', 403);
        } else {
          const { data, error } = await supabase
            .from('professionals')
            .select('id, name, specialty, registration_number, appointment_duration, avatar_url')
            .eq('clinic_id', apiKey.clinic_id)
            .eq('is_active', true);
          
          if (error) throw error;
          response = successResponse({ professionals: data });
        }
      }
      // GET /professionals/:id/availability - Horários disponíveis
      else if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'availability') {
        if (!hasPermission(apiKey, 'read:availability')) {
          response = errorResponse('Permission denied: read:availability', 403);
        } else {
          const professionalId = pathParts[1];
          const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
          
          // Buscar profissional e agenda
          const { data: professional, error: profError } = await supabase
            .from('professionals')
            .select('id, name, schedule, appointment_duration')
            .eq('id', professionalId)
            .eq('clinic_id', apiKey.clinic_id)
            .eq('is_active', true)
            .maybeSingle();
          
          if (profError || !professional) {
            response = errorResponse('Professional not found', 404);
          } else {
            // Buscar agendamentos existentes para a data
            const { data: appointments } = await supabase
              .from('appointments')
              .select('start_time, end_time')
              .eq('professional_id', professionalId)
              .eq('appointment_date', date)
              .in('status', ['scheduled', 'confirmed', 'in_progress']);
            
            // Calcular slots disponíveis
            const schedule = professional.schedule as any || {};
            const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const daySchedule = schedule[dayOfWeek];
            
            const availableSlots: string[] = [];
            
            if (daySchedule?.enabled && daySchedule.slots) {
              const duration = professional.appointment_duration || 30;
              const bookedTimes = (appointments || []).map(a => a.start_time);
              
              for (const slot of daySchedule.slots) {
                let current = slot.start;
                while (current < slot.end) {
                  if (!bookedTimes.includes(current)) {
                    availableSlots.push(current);
                  }
                  // Adicionar duração
                  const [h, m] = current.split(':').map(Number);
                  const totalMinutes = h * 60 + m + duration;
                  const newH = Math.floor(totalMinutes / 60);
                  const newM = totalMinutes % 60;
                  current = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
                }
              }
            }
            
            response = successResponse({
              professional_id: professionalId,
              date,
              appointment_duration: professional.appointment_duration,
              available_slots: availableSlots
            });
          }
        }
      } else {
        response = errorResponse('Endpoint not found', 404);
      }
    }
    
    // ===== PATIENTS =====
    else if (pathParts[0] === 'patients') {
      // GET /patients - Buscar paciente
      if (method === 'GET' && pathParts.length === 1) {
        if (!hasPermission(apiKey, 'read:patients')) {
          response = errorResponse('Permission denied: read:patients', 403);
        } else {
          const phone = url.searchParams.get('phone');
          const cpf = url.searchParams.get('cpf');
          const name = url.searchParams.get('name');
          
          let query = supabase
            .from('patients')
            .select('id, name, phone, email, cpf, birth_date, address, notes, created_at')
            .eq('clinic_id', apiKey.clinic_id);
          
          if (phone) query = query.eq('phone', phone);
          if (cpf) query = query.eq('cpf', cpf);
          if (name) query = query.ilike('name', `%${name}%`);
          
          const { data, error } = await query.limit(50);
          
          if (error) throw error;
          response = successResponse({ patients: data });
        }
      }
      // GET /patients/:id/history - Histórico do paciente
      else if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'history') {
        if (!hasPermission(apiKey, 'read:history')) {
          response = errorResponse('Permission denied: read:history', 403);
        } else {
          const patientId = pathParts[1];
          
          const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
              id, appointment_date, start_time, end_time, status, type, notes,
              professionals:professional_id (id, name, specialty)
            `)
            .eq('patient_id', patientId)
            .eq('clinic_id', apiKey.clinic_id)
            .order('appointment_date', { ascending: false })
            .order('start_time', { ascending: false })
            .limit(100);
          
          if (error) throw error;
          response = successResponse({ history: appointments });
        }
      }
      // POST /patients - Criar paciente
      else if (method === 'POST' && pathParts.length === 1) {
        if (!hasPermission(apiKey, 'create:patients')) {
          response = errorResponse('Permission denied: create:patients', 403);
        } else {
          const { name, phone, email, cpf, birth_date, address, notes } = requestBody || {};
          
          if (!name || !phone) {
            response = errorResponse('name and phone are required');
          } else {
            // Verificar se já existe
            const { data: existing } = await supabase
              .from('patients')
              .select('id')
              .eq('clinic_id', apiKey.clinic_id)
              .eq('phone', phone)
              .maybeSingle();
            
            if (existing) {
              response = successResponse({ 
                patient: existing, 
                created: false,
                message: 'Patient already exists with this phone'
              });
            } else {
              const { data, error } = await supabase
                .from('patients')
                .insert({
                  clinic_id: apiKey.clinic_id,
                  name,
                  phone,
                  email,
                  cpf,
                  birth_date,
                  address,
                  notes
                })
                .select()
                .single();
              
              if (error) throw error;
              response = successResponse({ patient: data, created: true }, 201);
            }
          }
        }
      } else {
        response = errorResponse('Endpoint not found', 404);
      }
    }
    
    // ===== APPOINTMENTS =====
    else if (pathParts[0] === 'appointments') {
      // GET /appointments - Listar agendamentos
      if (method === 'GET' && pathParts.length === 1) {
        if (!hasPermission(apiKey, 'read:appointments')) {
          response = errorResponse('Permission denied: read:appointments', 403);
        } else {
          const date = url.searchParams.get('date');
          const status = url.searchParams.get('status');
          const professional_id = url.searchParams.get('professional_id');
          const patient_id = url.searchParams.get('patient_id');
          
          let query = supabase
            .from('appointments')
            .select(`
              id, appointment_date, start_time, end_time, status, type, notes, created_at,
              patients:patient_id (id, name, phone, email),
              professionals:professional_id (id, name, specialty)
            `)
            .eq('clinic_id', apiKey.clinic_id)
            .order('appointment_date', { ascending: true })
            .order('start_time', { ascending: true });
          
          if (date) query = query.eq('appointment_date', date);
          if (status) query = query.eq('status', status);
          if (professional_id) query = query.eq('professional_id', professional_id);
          if (patient_id) query = query.eq('patient_id', patient_id);
          
          const { data, error } = await query.limit(100);
          
          if (error) throw error;
          response = successResponse({ appointments: data });
        }
      }
      // GET /appointments/:id - Detalhes do agendamento
      else if (method === 'GET' && pathParts.length === 2) {
        if (!hasPermission(apiKey, 'read:appointments')) {
          response = errorResponse('Permission denied: read:appointments', 403);
        } else {
          const { data, error } = await supabase
            .from('appointments')
            .select(`
              id, appointment_date, start_time, end_time, status, type, notes, created_at,
              patients:patient_id (id, name, phone, email, cpf, birth_date),
              professionals:professional_id (id, name, specialty, registration_number)
            `)
            .eq('id', pathParts[1])
            .eq('clinic_id', apiKey.clinic_id)
            .maybeSingle();
          
          if (error) throw error;
          if (!data) {
            response = errorResponse('Appointment not found', 404);
          } else {
            response = successResponse({ appointment: data });
          }
        }
      }
      // POST /appointments - Criar agendamento
      else if (method === 'POST' && pathParts.length === 1) {
        if (!hasPermission(apiKey, 'create:appointments')) {
          response = errorResponse('Permission denied: create:appointments', 403);
        } else {
          const { 
            patient_id, patient_name, patient_phone, patient_email,
            professional_id, appointment_date, start_time, type, notes 
          } = requestBody || {};
          
          if (!professional_id || !appointment_date || !start_time) {
            response = errorResponse('professional_id, appointment_date, and start_time are required');
          } else if (!patient_id && (!patient_name || !patient_phone)) {
            response = errorResponse('Either patient_id or (patient_name and patient_phone) is required');
          } else {
            let finalPatientId = patient_id;
            
            // Se não tem patient_id, criar ou buscar paciente
            if (!finalPatientId) {
              const { data: existingPatient } = await supabase
                .from('patients')
                .select('id')
                .eq('clinic_id', apiKey.clinic_id)
                .eq('phone', patient_phone)
                .maybeSingle();
              
              if (existingPatient) {
                finalPatientId = existingPatient.id;
              } else {
                const { data: newPatient, error: patientError } = await supabase
                  .from('patients')
                  .insert({
                    clinic_id: apiKey.clinic_id,
                    name: patient_name,
                    phone: patient_phone,
                    email: patient_email
                  })
                  .select('id')
                  .single();
                
                if (patientError) throw patientError;
                finalPatientId = newPatient.id;
              }
            }
            
            // Buscar duração do profissional
            const { data: professional } = await supabase
              .from('professionals')
              .select('appointment_duration')
              .eq('id', professional_id)
              .single();
            
            const duration = professional?.appointment_duration || 30;
            const [h, m] = start_time.split(':').map(Number);
            const endMinutes = h * 60 + m + duration;
            const end_time = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
            
            const { data, error } = await supabase
              .from('appointments')
              .insert({
                clinic_id: apiKey.clinic_id,
                patient_id: finalPatientId,
                professional_id,
                appointment_date,
                start_time,
                end_time,
                duration_minutes: duration,
                type: type || 'first_visit',
                notes,
                status: 'scheduled'
              })
              .select(`
                id, appointment_date, start_time, end_time, status, type, notes,
                patients:patient_id (id, name, phone),
                professionals:professional_id (id, name)
              `)
              .single();
            
            if (error) {
              if (error.message?.includes('HORARIO_INVALIDO')) {
                response = errorResponse('Schedule validation failed: time is outside professional working hours', 400);
              } else {
                throw error;
              }
            } else {
              response = successResponse({ appointment: data }, 201);
            }
          }
        }
      }
      // PATCH /appointments/:id/cancel - Cancelar agendamento
      else if (method === 'PATCH' && pathParts.length === 3 && pathParts[2] === 'cancel') {
        if (!hasPermission(apiKey, 'cancel:appointments')) {
          response = errorResponse('Permission denied: cancel:appointments', 403);
        } else {
          const { cancellation_reason } = requestBody || {};
          
          const { data, error } = await supabase
            .from('appointments')
            .update({
              status: 'cancelled',
              cancellation_reason,
              cancelled_at: new Date().toISOString()
            })
            .eq('id', pathParts[1])
            .eq('clinic_id', apiKey.clinic_id)
            .select('id, status, cancellation_reason, cancelled_at')
            .maybeSingle();
          
          if (error) throw error;
          if (!data) {
            response = errorResponse('Appointment not found', 404);
          } else {
            response = successResponse({ appointment: data });
          }
        }
      } else {
        response = errorResponse('Endpoint not found', 404);
      }
    }
    
    // ===== HEALTH CHECK =====
    else if (pathParts[0] === 'health') {
      response = successResponse({ 
        status: 'ok', 
        clinic_id: apiKey.clinic_id,
        permissions: apiKey.permissions,
        timestamp: new Date().toISOString()
      });
    }
    
    else {
      response = errorResponse('Endpoint not found. Available: /professionals, /patients, /appointments, /health', 404);
    }
    
  } catch (error: any) {
    console.error('[clinic-api] Error:', error);
    response = errorResponse(error.message || 'Internal server error', 500);
  }

  // Log da chamada
  const responseClone = response.clone();
  let responseBody = null;
  try {
    responseBody = await responseClone.json();
  } catch {}
  
  await logApiCall(
    supabase,
    apiKey.id,
    apiKey.clinic_id,
    `/${pathParts.join('/')}`,
    method,
    requestBody,
    response.status,
    responseBody,
    startTime,
    req
  );

  return response;
});
