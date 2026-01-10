import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  clinic_id: string;
  conversion_type: string;
  data: Record<string, unknown>[];
  chunk_index?: number;
  chunk_total?: number;
  run_id?: string;
  auto_create_employers?: boolean;
}

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string; cnpj?: string; competence?: string }[];
  chunk_index?: number;
  chunk_total?: number;
  employers_created?: number;
}

const MAX_RECORDS_PER_REQUEST = 2000;
const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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
    const { clinic_id, conversion_type, data, chunk_index, chunk_total, run_id, auto_create_employers } = body;

    console.log(`[import-converted-data] auto_create_employers=${auto_create_employers ?? false}`);

    if (!clinic_id || !conversion_type || !data?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clinic_id, conversion_type, data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request size
    if (data.length > MAX_RECORDS_PER_REQUEST) {
      return new Response(
        JSON.stringify({ 
          error: `Limite excedido: máximo ${MAX_RECORDS_PER_REQUEST} registros por requisição. Envie ${data.length} registros em lotes menores.`,
          max_records: MAX_RECORDS_PER_REQUEST,
          received: data.length
        }),
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

    console.log(`[import-converted-data] Starting import for clinic ${clinic.name} (${clinic_id})`);
    console.log(`[import-converted-data] Type: ${conversion_type}, Records: ${data.length}, Chunk: ${chunk_index ?? 'N/A'}/${chunk_total ?? 'N/A'}, RunID: ${run_id ?? 'N/A'}`);

    let result: ImportResult;

    switch (conversion_type) {
      case 'cadastro_pf':
        result = await importPatientsBatch(supabase, clinic_id, data);
        break;
      case 'cadastro_pj':
      case 'lytex_clients':
        result = await importEmployersBatch(supabase, clinic_id, data);
        break;
      case 'contributions_paid':
      case 'contributions_pending':
      case 'contributions_cancelled':
      case 'lytex_invoices':
        result = await importContributionsBatch(supabase, clinic_id, data, conversion_type, auto_create_employers ?? false);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported conversion type: ${conversion_type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Add chunk metadata to result
    if (chunk_index !== undefined) {
      result.chunk_index = chunk_index;
      result.chunk_total = chunk_total;
    }

    const duration = Date.now() - startTime;
    console.log(`[import-converted-data] Completed in ${duration}ms: inserted=${result.inserted}, updated=${result.updated}, skipped=${result.skipped}, errors=${result.errors.length}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    const duration = Date.now() - startTime;
    console.error(`[import-converted-data] Error after ${duration}ms:`, error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack?.split('\n').slice(0, 3).join('\n')
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ================== BATCH IMPORT FUNCTIONS ==================

async function importPatientsBatch(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };
  
  // Load existing patients in one query
  const cpfsToCheck = data
    .map(row => normalizeCpf(row.cpf))
    .filter((cpf): cpf is string => cpf !== null);
  
  const { data: existingPatients } = await supabase
    .from('patients')
    .select('id, cpf')
    .eq('clinic_id', clinicId)
    .in('cpf', cpfsToCheck);
  
  const existingCpfMap = new Map((existingPatients || []).map(p => [p.cpf, p.id]));
  
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
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

    const existingId = existingCpfMap.get(cpf);
    if (existingId) {
      toUpdate.push({ id: existingId, data: patientData });
    } else {
      toInsert.push(patientData);
    }
  }

  // Batch insert
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('patients').insert(batch);
      if (error) {
        console.error('[importPatientsBatch] Insert error:', error);
        result.errors.push({ row: 0, message: `Erro ao inserir lote: ${error.message}` });
      } else {
        result.inserted += batch.length;
      }
    }
  }

  // Batch update (one by one for now, but parallelized)
  const updatePromises = toUpdate.map(async ({ id, data: patientData }) => {
    const { error } = await supabase.from('patients').update(patientData).eq('id', id);
    return error ? 'error' : 'success';
  });
  
  const updateResults = await Promise.all(updatePromises);
  result.updated = updateResults.filter(r => r === 'success').length;

  return result;
}

async function importEmployersBatch(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  // Load existing employers in one query
  const cnpjsToCheck = data
    .map(row => normalizeCnpj(row.cnpj))
    .filter((cnpj): cnpj is string => cnpj !== null);
  
  const { data: existingEmployers } = await supabase
    .from('employers')
    .select('id, cnpj')
    .eq('clinic_id', clinicId)
    .in('cnpj', cnpjsToCheck);
  
  // Normalize CNPJ keys for consistent lookup
  const existingCnpjMap = new Map<string, string>();
  (existingEmployers || []).forEach(e => {
    const normalized = normalizeCnpj(e.cnpj);
    if (normalized) {
      existingCnpjMap.set(normalized, e.id);
    }
  });
  
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const cnpj = normalizeCnpj(row.cnpj);
    
    if (!cnpj) {
      result.errors.push({ row: i + 1, message: 'CNPJ inválido ou ausente', cnpj: String(row.cnpj || '') });
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

    const existingId = existingCnpjMap.get(cnpj);
    if (existingId) {
      toUpdate.push({ id: existingId, data: employerData });
    } else {
      toInsert.push(employerData);
    }
  }

  // Batch insert
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('employers').insert(batch);
      if (error) {
        console.error('[importEmployersBatch] Insert error:', error);
        result.errors.push({ row: 0, message: `Erro ao inserir lote: ${error.message}` });
      } else {
        result.inserted += batch.length;
      }
    }
  }

  // Batch update
  const updatePromises = toUpdate.map(async ({ id, data: employerData }) => {
    const { error } = await supabase.from('employers').update(employerData).eq('id', id);
    return error ? 'error' : 'success';
  });
  
  const updateResults = await Promise.all(updatePromises);
  result.updated = updateResults.filter(r => r === 'success').length;

  return result;
}

async function importContributionsBatch(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[],
  conversionType: string,
  autoCreateEmployers: boolean = false
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [], employers_created: 0 };

  console.log(`[importContributionsBatch] Starting with ${data.length} records`);

  // 1. Pre-load all employers for this clinic (CACHE)
  const { data: allEmployers } = await supabase
    .from('employers')
    .select('id, cnpj')
    .eq('clinic_id', clinicId);
  
  // CRITICAL: Normalize CNPJ keys to avoid mismatches between masked/unmasked formats
  const employerMap = new Map<string, string>();
  (allEmployers || []).forEach(e => {
    const normalized = normalizeCnpj(e.cnpj);
    if (normalized) {
      employerMap.set(normalized, e.id);
    }
  });
  console.log(`[importContributionsBatch] Loaded ${employerMap.size} employers into cache`);

  // 2. Pre-load all contribution types for this clinic (CACHE)
  const { data: allTypes } = await supabase
    .from('contribution_types')
    .select('id, name')
    .eq('clinic_id', clinicId);
  
  const typeMap = new Map<string, string>();
  (allTypes || []).forEach(t => {
    typeMap.set(t.name.trim().toUpperCase(), t.id);
  });
  console.log(`[importContributionsBatch] Loaded ${typeMap.size} contribution types into cache`);

  // 3. Determine base status from conversion type
  const statusMap: Record<string, string> = {
    contributions_paid: 'paid',
    contributions_pending: 'pending',
    contributions_cancelled: 'cancelled',
    lytex_invoices: 'pending',
  };
  const baseStatus = statusMap[conversionType] || 'pending';
  const todayStr = new Date().toISOString().split('T')[0];

  // 4. Process all rows and build insert array
  const toInsert: Record<string, unknown>[] = [];
  const competenceKeysToInsert = new Set<string>();
  const typesToCreate = new Set<string>();

  // First pass: identify types to create
  for (const row of data) {
    const typeName = String(row.contribution_type || row.tipo || row.type || 'Contribuição Padrão').trim();
    const normalizedTypeName = typeName.toUpperCase();
    if (!typeMap.has(normalizedTypeName)) {
      typesToCreate.add(typeName);
    }
  }

  // Create missing types in batch
  if (typesToCreate.size > 0) {
    console.log(`[importContributionsBatch] Creating ${typesToCreate.size} new contribution types`);
    for (const typeName of typesToCreate) {
      const normalizedName = typeName.trim().toUpperCase();
      // Double check it wasn't created by a concurrent request
      if (!typeMap.has(normalizedName)) {
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
          // Try to fetch if already exists (race condition)
          const { data: existingType } = await supabase
            .from('contribution_types')
            .select('id')
            .eq('clinic_id', clinicId)
            .ilike('name', normalizedName)
            .limit(1)
            .single();
          
          if (existingType) {
            typeMap.set(normalizedName, existingType.id);
          } else {
            console.error(`[importContributionsBatch] Failed to create type: ${typeName}`, createError);
          }
        } else if (newType) {
          typeMap.set(normalizedName, newType.id);
          console.log(`[importContributionsBatch] Created type: ${typeName} -> ${newType.id}`);
        }
      }
    }
  }

  // Second pass: build contributions to insert
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const cnpj = normalizeCnpj(row.cnpj);
      if (!cnpj) {
        result.errors.push({ row: i + 1, message: 'CNPJ inválido ou ausente', cnpj: String(row.cnpj || '') });
        continue;
      }

      let employerId = employerMap.get(cnpj);
      if (!employerId) {
        if (autoCreateEmployers) {
          // Extract employer name from row or use placeholder
          const employerName = extractEmployerName(row) || `EMPRESA ${formatCnpj(cnpj)}`;
          
          const { data: newEmployer, error: createError } = await supabase
            .from('employers')
            .insert({
              clinic_id: clinicId,
              cnpj: cnpj,
              name: employerName.toUpperCase(),
              is_active: true,
            })
            .select('id')
            .single();
          
          if (createError) {
            // Check if it was created by concurrent request
            const { data: existingEmployer } = await supabase
              .from('employers')
              .select('id')
              .eq('clinic_id', clinicId)
              .eq('cnpj', cnpj)
              .single();
            
            if (existingEmployer) {
              employerId = existingEmployer.id;
              employerMap.set(cnpj, employerId!);
            } else {
              result.errors.push({ row: i + 1, message: `Falha ao criar empresa: ${formatCnpj(cnpj)} - ${createError.message}`, cnpj });
              continue;
            }
          } else if (newEmployer) {
            employerId = newEmployer.id;
            employerMap.set(cnpj, employerId!);
            result.employers_created = (result.employers_created || 0) + 1;
            console.log(`[importContributionsBatch] Created employer: ${employerName} (${formatCnpj(cnpj)})`);
          }
        } else {
          result.errors.push({ row: i + 1, message: `Empresa não encontrada: ${formatCnpj(cnpj)}`, cnpj });
          continue;
        }
      }

      const value = parseCurrency(row.value);
      if (value < 0) {
        result.errors.push({ row: i + 1, message: 'Valor negativo não permitido', cnpj });
        continue;
      }

      const dueDate = parseDate(row.due_date) || new Date().toISOString().split('T')[0];
      const paymentDate = row.payment_date ? parseDate(row.payment_date) : null;

      const typeName = String(row.contribution_type || row.tipo || row.type || 'Contribuição Padrão').trim();
      const normalizedTypeName = typeName.toUpperCase();
      const typeId = typeMap.get(normalizedTypeName);

      if (!typeId) {
        result.errors.push({ row: i + 1, message: `Tipo de contribuição não encontrado: ${typeName}`, cnpj });
        continue;
      }

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

      // Check for duplicates within this batch
      if (competenceKeysToInsert.has(activeCompetenceKey)) {
        result.skipped++;
        continue;
      }

      competenceKeysToInsert.add(activeCompetenceKey);

      // Determine final status: if base is not 'paid' and due_date is past, set to 'overdue'
      let finalStatus = baseStatus;
      if (baseStatus !== 'paid' && baseStatus !== 'cancelled') {
        finalStatus = dueDate < todayStr ? 'overdue' : 'pending';
      }

      // NOTE: active_competence_key is a GENERATED ALWAYS column - DO NOT include it in insert!
      toInsert.push({
        clinic_id: clinicId,
        employer_id: employerId,
        contribution_type_id: typeId,
        value,
        due_date: dueDate,
        status: finalStatus,
        competence_month: competenceMonth,
        competence_year: competenceYear,
        paid_at: finalStatus === 'paid' ? (paymentDate || dueDate) : null,
        paid_value: finalStatus === 'paid' ? value : null,
        notes: row.notes || row.description ? String(row.notes || row.description).trim() : null,
      });
    } catch (err) {
      const error = err as Error;
      result.errors.push({ row: i + 1, message: error.message || 'Erro ao processar registro' });
    }
  }

  console.log(`[importContributionsBatch] Prepared ${toInsert.length} contributions for insert`);

  // 5. Batch upsert with onConflict to handle duplicates
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();
      
      // Use upsert with ignoreDuplicates to skip existing records
      const { data: insertedData, error } = await supabase
        .from('employer_contributions')
        .upsert(batch, { 
          onConflict: 'active_competence_key',
          ignoreDuplicates: true 
        })
        .select('id');

      const batchDuration = Date.now() - batchStart;
      
      if (error) {
        console.error(`[importContributionsBatch] Batch ${Math.floor(i / BATCH_SIZE) + 1} error (${batchDuration}ms):`, error);
        result.errors.push({ row: 0, message: `Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}` });
      } else {
        const insertedCount = insertedData?.length || 0;
        result.inserted += insertedCount;
        result.skipped += batch.length - insertedCount;
        console.log(`[importContributionsBatch] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toInsert.length / BATCH_SIZE)}: inserted=${insertedCount}, skipped=${batch.length - insertedCount} (${batchDuration}ms)`);
      }
    }
  }

  return result;
}

// ================== UTILITY FUNCTIONS ==================

function extractEmployerName(row: Record<string, unknown>): string | null {
  // Try to find employer name from common field names
  const nameFields = [
    'razao_social', 'razaoSocial', 'name', 'empresa', 'nome_empresa', 
    'company', 'employer_name', 'nome', 'razão social', 'Razão Social',
    'Empresa', 'Nome', 'RAZAO SOCIAL', 'EMPRESA', 'NOME'
  ];
  
  for (const field of nameFields) {
    const value = row[field];
    if (value && typeof value === 'string') {
      const name = value.trim();
      if (name.length > 2) return name;
    }
  }
  
  return null;
}

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

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
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
