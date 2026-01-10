import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  clinic_id: string;
  conversion_type: string;
  data: Record<string, unknown>[];
}

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate Super-Admin
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Super-Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ImportRequest = await req.json();
    const { clinic_id, conversion_type, data } = body;

    if (!clinic_id || !conversion_type || !data?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clinic_id, conversion_type, data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify clinic exists
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('id', clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ error: 'Clinic not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: ImportResult;

    switch (conversion_type) {
      case 'cadastro_pf':
        result = await importPatients(supabase, clinic_id, data);
        break;
      case 'cadastro_pj':
      case 'lytex_clients':
        result = await importEmployers(supabase, clinic_id, data);
        break;
      case 'contributions_paid':
      case 'contributions_pending':
      case 'contributions_cancelled':
      case 'lytex_invoices':
        result = await importContributions(supabase, clinic_id, data, conversion_type);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported conversion type: ${conversion_type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Import completed for clinic ${clinic.name}: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function importPatients(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const cpf = normalizeCpf(row.cpf);
      if (!cpf) {
        result.errors.push({ row: i + 1, message: 'CPF inválido ou ausente' });
        continue;
      }

      const patientData: Record<string, unknown> = {
        clinic_id: clinicId,
        cpf,
        name: String(row.name || '').trim().toUpperCase(),
        email: row.email ? String(row.email).trim().toLowerCase() : null,
        phone: row.phone ? normalizePhone(row.phone) : null,
        birth_date: row.birth_date ? parseDate(row.birth_date) : null,
        address: row.address ? String(row.address).trim() : null,
        registration_number: row.registration_number ? String(row.registration_number).trim() : null,
      };

      // Check if patient exists
      const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('cpf', cpf)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('patients')
          .update(patientData)
          .eq('id', (existing as { id: string }).id);

        if (error) throw error;
        result.updated++;
      } else {
        // Insert new
        const { error } = await supabase
          .from('patients')
          .insert(patientData);

        if (error) throw error;
        result.inserted++;
      }
    } catch (err) {
      const error = err as Error;
      result.errors.push({ row: i + 1, message: error.message || 'Erro ao processar registro' });
    }
  }

  return result;
}

async function importEmployers(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const cnpj = normalizeCnpj(row.cnpj);
      if (!cnpj) {
        result.errors.push({ row: i + 1, message: 'CNPJ inválido ou ausente' });
        continue;
      }

      const employerData: Record<string, unknown> = {
        clinic_id: clinicId,
        cnpj,
        name: String(row.name || '').trim().toUpperCase(),
        trade_name: row.trade_name ? String(row.trade_name).trim() : null,
        email: row.email ? String(row.email).trim().toLowerCase() : null,
        phone: row.phone ? normalizePhone(row.phone) : null,
        address: row.address ? String(row.address).trim() : null,
        city: row.city ? String(row.city).trim() : null,
        state: row.state ? String(row.state).trim().toUpperCase() : null,
        registration_number: row.registration_number ? String(row.registration_number).trim() : null,
        is_active: true,
      };

      // Check if employer exists
      const { data: existing } = await supabase
        .from('employers')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('cnpj', cnpj)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('employers')
          .update(employerData)
          .eq('id', (existing as { id: string }).id);

        if (error) throw error;
        result.updated++;
      } else {
        const { error } = await supabase
          .from('employers')
          .insert(employerData);

        if (error) throw error;
        result.inserted++;
      }
    } catch (err) {
      const error = err as Error;
      result.errors.push({ row: i + 1, message: error.message || 'Erro ao processar registro' });
    }
  }

  return result;
}

async function importContributions(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[],
  conversionType: string
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  // Cache for contribution types (name -> id)
  const typeCache = new Map<string, string>();

  // Helper function to get or create contribution type
  async function getOrCreateContributionType(typeName: string): Promise<string> {
    const normalizedName = typeName.trim().toUpperCase();
    
    // Check cache first
    if (typeCache.has(normalizedName)) {
      return typeCache.get(normalizedName)!;
    }

    // Search for existing type (case-insensitive)
    const { data: existingType } = await supabase
      .from('contribution_types')
      .select('id')
      .eq('clinic_id', clinicId)
      .ilike('name', normalizedName)
      .limit(1)
      .single();

    if (existingType) {
      typeCache.set(normalizedName, (existingType as { id: string }).id);
      return (existingType as { id: string }).id;
    }

    // Create new type
    const { data: newType, error: createError } = await supabase
      .from('contribution_types')
      .insert({
        clinic_id: clinicId,
        name: typeName.trim(),
        is_active: true,
        default_value: 0,
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Erro ao criar tipo de contribuição: ${createError.message}`);
    }

    typeCache.set(normalizedName, (newType as { id: string }).id);
    console.log(`Created new contribution type: "${typeName}" for clinic ${clinicId}`);
    return (newType as { id: string }).id;
  }

  // Determine status based on conversion type
  const statusMap: Record<string, string> = {
    contributions_paid: 'paid',
    contributions_pending: 'pending',
    contributions_cancelled: 'cancelled',
    lytex_invoices: 'pending',
  };
  const status = statusMap[conversionType] || 'pending';

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const cnpj = normalizeCnpj(row.cnpj);
      if (!cnpj) {
        result.errors.push({ row: i + 1, message: 'CNPJ inválido ou ausente' });
        continue;
      }

      // Find employer by CNPJ
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('cnpj', cnpj)
        .single();

      if (!employer) {
        result.errors.push({ row: i + 1, message: `Empresa não encontrada: ${cnpj}` });
        continue;
      }

      const employerId = (employer as { id: string }).id;

      const value = parseCurrency(row.value);
      if (value < 0) {
        result.errors.push({ row: i + 1, message: 'Valor negativo não permitido' });
        continue;
      }

      const dueDate = parseDate(row.due_date) || new Date().toISOString().split('T')[0];
      const paymentDate = row.payment_date ? parseDate(row.payment_date) : null;

      // Extract contribution type from spreadsheet or use default
      const typeName = String(
        row.contribution_type || row.tipo || row.type || 'Contribuição Padrão'
      ).trim();

      // Get or create the contribution type
      const typeId = await getOrCreateContributionType(typeName);

      // Parse competence
      let competenceYear = new Date().getFullYear();
      let competenceMonth = new Date().getMonth() + 1;
      
      if (row.competence) {
        const competence = String(row.competence);
        const match = competence.match(/(\d{1,2})[\/\-](\d{4})/);
        if (match) {
          competenceMonth = parseInt(match[1]);
          competenceYear = parseInt(match[2]);
        }
      } else if (row.competence_month && row.competence_year) {
        competenceMonth = parseInt(String(row.competence_month));
        competenceYear = parseInt(String(row.competence_year));
      }

      const activeCompetenceKey = `${employerId}-${typeId}-${competenceYear}-${competenceMonth}`;

      const contributionData: Record<string, unknown> = {
        clinic_id: clinicId,
        employer_id: employerId,
        contribution_type_id: typeId,
        value,
        due_date: dueDate,
        status,
        competence_month: competenceMonth,
        competence_year: competenceYear,
        active_competence_key: activeCompetenceKey,
        paid_at: status === 'paid' ? (paymentDate || dueDate) : null,
        paid_value: status === 'paid' ? value : null,
        notes: row.notes || row.description ? String(row.notes || row.description).trim() : null,
      };

      // Check if contribution exists by active_competence_key
      const { data: existing } = await supabase
        .from('employer_contributions')
        .select('id')
        .eq('active_competence_key', activeCompetenceKey)
        .single();

      if (existing) {
        result.skipped++;
      } else {
        const { error } = await supabase
          .from('employer_contributions')
          .insert(contributionData);

        if (error) throw error;
        result.inserted++;
      }
    } catch (err) {
      const error = err as Error;
      result.errors.push({ row: i + 1, message: error.message || 'Erro ao processar registro' });
    }
  }

  return result;
}

// Utility functions
function normalizeCpf(value: unknown): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}

function normalizeCnpj(value: unknown): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

function normalizePhone(value: unknown): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 11) {
    return digits;
  }
  return null;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  
  // Try DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

function parseCurrency(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  let str = String(value).trim();
  str = str.replace(/[R$\s]/g, '');
  
  // Check for Brazilian format (1.234,56)
  if (str.includes(',') && str.lastIndexOf(',') > str.lastIndexOf('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}
