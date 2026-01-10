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

// Validar CNPJ com dígitos verificadores
function validateCnpj(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleanCnpj)) return false;

  let size = cleanCnpj.length - 2;
  let numbers = cleanCnpj.substring(0, size);
  const digits = cleanCnpj.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cleanCnpj.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicId, document } = await req.json();

    console.log('Searching homologacao data:', { clinicId, documentLength: document?.length });

    // Validate inputs
    if (!clinicId) {
      return new Response(
        JSON.stringify({ error: 'clinicId é obrigatório' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanDocument = document?.replace(/\D/g, '');
    if (!cleanDocument || (cleanDocument.length !== 11 && cleanDocument.length !== 14)) {
      return new Response(
        JSON.stringify({ error: 'Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isCpf = cleanDocument.length === 11;
    
    // Validate document
    if (isCpf && !validateCpf(cleanDocument)) {
      return new Response(
        JSON.stringify({ error: 'CPF inválido' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!isCpf && !validateCnpj(cleanDocument)) {
      return new Response(
        JSON.stringify({ error: 'CNPJ inválido' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let result = {
      found: false,
      type: isCpf ? 'cpf' : 'cnpj' as 'cpf' | 'cnpj',
      employee: null as {
        name: string;
        cpf: string;
        phone?: string;
        email?: string;
      } | null,
      company: null as {
        name: string;
        cnpj: string;
        tradeName?: string;
        phone?: string;
        email?: string;
        contactName?: string;
        address?: string;
        city?: string;
        state?: string;
      } | null,
    };

    if (isCpf) {
      // Search for patient (employee) by CPF
      const formattedCpf = cleanDocument.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      
      const { data: patientData } = await supabase
        .from('patients')
        .select('id, name, cpf, phone, email, employer_id')
        .eq('clinic_id', clinicId)
        .or(`cpf.eq.${cleanDocument},cpf.eq.${formattedCpf}`)
        .eq('is_active', true)
        .maybeSingle();

      if (patientData) {
        console.log('Patient found:', patientData.name);
        result.found = true;
        result.employee = {
          name: patientData.name,
          cpf: formattedCpf,
          phone: patientData.phone || undefined,
          email: patientData.email || undefined,
        };

        // If patient has an employer, fetch company data
        if (patientData.employer_id) {
          const { data: employerData } = await supabase
            .from('employers')
            .select('id, name, trade_name, cnpj, phone, email, contact_name, address, city, state_code')
            .eq('id', patientData.employer_id)
            .maybeSingle();

          if (employerData) {
            console.log('Employer found via patient:', employerData.name);
            result.company = {
              name: employerData.name,
              cnpj: employerData.cnpj || '',
              tradeName: employerData.trade_name || undefined,
              phone: employerData.phone || undefined,
              email: employerData.email || undefined,
              contactName: employerData.contact_name || undefined,
              address: employerData.address || undefined,
              city: employerData.city || undefined,
              state: employerData.state_code || undefined,
            };
          }
        }
      }
    } else {
      // Search for employer (company) by CNPJ
      const formattedCnpj = cleanDocument.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      
      const { data: employerData } = await supabase
        .from('employers')
        .select('id, name, trade_name, cnpj, phone, email, contact_name, address, city, state_code')
        .eq('clinic_id', clinicId)
        .or(`cnpj.eq.${cleanDocument},cnpj.eq.${formattedCnpj}`)
        .eq('is_active', true)
        .maybeSingle();

      if (employerData) {
        console.log('Employer found:', employerData.name);
        result.found = true;
        result.company = {
          name: employerData.name,
          cnpj: formattedCnpj,
          tradeName: employerData.trade_name || undefined,
          phone: employerData.phone || undefined,
          email: employerData.email || undefined,
          contactName: employerData.contact_name || undefined,
          address: employerData.address || undefined,
          city: employerData.city || undefined,
          state: employerData.state_code || undefined,
        };
      }
    }

    console.log('Search result:', { found: result.found, type: result.type });

    return new Response(
      JSON.stringify({ success: true, ...result }), 
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
