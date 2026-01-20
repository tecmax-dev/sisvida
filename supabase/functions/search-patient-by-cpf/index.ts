import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validar CPF com dígitos verificadores
function validateCpf(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[10])) return false;
  
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicId, cpf } = await req.json();

    console.log('Searching patient by CPF:', { clinicId, cpfLength: cpf?.length });

    // Validate inputs
    if (!clinicId) {
      return new Response(
        JSON.stringify({ error: 'clinicId é obrigatório' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanCpf = cpf?.replace(/\D/g, '');
    if (!cleanCpf || cleanCpf.length !== 11) {
      return new Response(
        JSON.stringify({ error: 'CPF deve ter 11 dígitos' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateCpf(cleanCpf)) {
      return new Response(
        JSON.stringify({ error: 'CPF inválido' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Search patient - support both formatted (XXX.XXX.XXX-XX) and unformatted CPF
    const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, phone, email, birth_date, gender, is_active, inactivation_reason, union_status, union_card_expires_at')
      .eq('clinic_id', clinicId)
      .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar paciente' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Patient found:', !!data);

    // If patient found, also fetch their dependents
    let dependents: Array<{ id: string; name: string; relationship: string | null; card_expires_at: string | null }> = [];
    if (data?.id) {
      const { data: dependentsData, error: depError } = await supabase
        .from('patient_dependents')
        .select('id, name, relationship, card_expires_at')
        .eq('patient_id', data.id)
        .eq('is_active', true)
        .order('name');

      if (!depError && dependentsData) {
        dependents = dependentsData;
        console.log('Found dependents:', dependents.length);
      }
    }

    return new Response(
      JSON.stringify({ success: true, patient: data, dependents }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error processing request:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
