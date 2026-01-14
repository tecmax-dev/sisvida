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

    // For contribution imports, default to auto_create_employers=true if not explicitly set
    const shouldAutoCreate = auto_create_employers ?? (
      conversion_type.startsWith('contributions') || conversion_type === 'lytex_invoices'
    );

    console.log(`[import-converted-data] auto_create_employers=${shouldAutoCreate} (raw: ${auto_create_employers})`);

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
      case 'cadastro_fornecedores':
        result = await importSuppliersBatch(supabase, clinic_id, data);
        break;
      case 'contributions_paid':
      case 'contributions_pending':
      case 'contributions_cancelled':
      case 'lytex_invoices':
        result = await importContributionsBatch(supabase, clinic_id, data, conversion_type, shouldAutoCreate);
        break;
      case 'contributions_individual':
      case 'contributions_individual_paid':
        result = await importIndividualContributionsBatch(supabase, clinic_id, data, conversion_type, shouldAutoCreate);
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
      let isNegotiatedDebt = false; // Flag para identificar débito negociado (código 99)
      
      if (row.competence) {
        const competence = String(row.competence);
        const match = competence.match(/(\d{1,2})[\/\-](\d{4})/);
        if (match) {
          let parsedMonth = parseInt(match[1]);
          const parsedYear = parseInt(match[2]);
          
          // CÓDIGO ESPECIAL: mês 99 = Débito Negociado → usar dezembro
          if (parsedMonth === 99) {
            console.log(`[importContributionsBatch] Code 99 detected (negotiated debt), converting to month 12 with -DN suffix`);
            parsedMonth = 12;
            isNegotiatedDebt = true;
          }
          
          // VALIDAÇÃO: mês deve estar entre 1-12, ano >= 2020
          if (parsedMonth >= 1 && parsedMonth <= 12 && parsedYear >= 2020) {
            competenceMonth = parsedMonth;
            competenceYear = parsedYear;
          } else {
            console.warn(`[importContributionsBatch] Invalid competence: ${competence}, using defaults (month=${competenceMonth}, year=${competenceYear})`);
          }
        }
      } else if (row.competence_month && row.competence_year) {
        let parsedMonth = parseInt(String(row.competence_month));
        const parsedYear = parseInt(String(row.competence_year));
        
        // CÓDIGO ESPECIAL: mês 99 = Débito Negociado → usar dezembro
        if (parsedMonth === 99) {
          console.log(`[importContributionsBatch] Code 99 detected (negotiated debt), converting to month 12 with -DN suffix`);
          parsedMonth = 12;
          isNegotiatedDebt = true;
        }
        
        // VALIDAÇÃO: mês deve estar entre 1-12, ano >= 2020
        if (parsedMonth >= 1 && parsedMonth <= 12 && parsedYear >= 2020) {
          competenceMonth = parsedMonth;
          competenceYear = parsedYear;
        } else {
          console.warn(`[importContributionsBatch] Invalid month/year: ${row.competence_month}/${row.competence_year}, using defaults`);
        }
      }

      // Gerar chave única - adicionar sufixo -DN para débitos negociados (código 99)
      // Isso permite que exista uma contribuição normal de dezembro E um débito negociado do mesmo período
      let activeCompetenceKey = `${employerId}-${typeId}-${competenceYear}-${competenceMonth}`;
      if (isNegotiatedDebt) {
        activeCompetenceKey = `${activeCompetenceKey}-DN`;
      }

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
      // The is_negotiated_debt flag is used by the generated column to add -DN suffix
      toInsert.push({
        clinic_id: clinicId,
        employer_id: employerId,
        contribution_type_id: typeId,
        value,
        due_date: dueDate,
        status: finalStatus,
        competence_month: competenceMonth,
        competence_year: competenceYear,
        is_negotiated_debt: isNegotiatedDebt, // Flag para débitos negociados (código 99)
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

// ================== INDIVIDUAL CONTRIBUTIONS (PESSOA FÍSICA) ==================

async function importIndividualContributionsBatch(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[],
  conversionType: string,
  autoCreateMembers: boolean = false
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  console.log(`[importIndividualContributionsBatch] Starting with ${data.length} records`);

  // 1. Pre-load all patients for this clinic (CACHE)
  const { data: allPatients } = await supabase
    .from('patients')
    .select('id, cpf, name')
    .eq('clinic_id', clinicId);
  
  // Normalize CPF keys
  const patientMap = new Map<string, { id: string; name: string }>();
  (allPatients || []).forEach(p => {
    const normalized = normalizeCpf(p.cpf);
    if (normalized) {
      patientMap.set(normalized, { id: p.id, name: p.name });
    }
  });
  console.log(`[importIndividualContributionsBatch] Loaded ${patientMap.size} patients into cache`);

  // 2. Pre-load all contribution types for this clinic (CACHE)
  const { data: allTypes } = await supabase
    .from('contribution_types')
    .select('id, name')
    .eq('clinic_id', clinicId);
  
  const typeMap = new Map<string, string>();
  (allTypes || []).forEach(t => {
    typeMap.set(t.name.trim().toUpperCase(), t.id);
  });
  console.log(`[importIndividualContributionsBatch] Loaded ${typeMap.size} contribution types into cache`);

  // 3. Find or create the "Contribuição Individual" type
  let individualTypeId = typeMap.get('130 - CONTRIBUIÇÃO INDIVIDUAL');
  if (!individualTypeId) {
    // Try to find by partial name
    for (const [name, id] of typeMap.entries()) {
      if (name.includes('INDIVIDUAL') || name.includes('PESSOA FÍSICA') || name.includes('PESSOA FISICA')) {
        individualTypeId = id;
        break;
      }
    }
  }
  if (!individualTypeId) {
    // Create the type
    const { data: newType, error: typeError } = await supabase
      .from('contribution_types')
      .insert({
        clinic_id: clinicId,
        name: '130 - CONTRIBUIÇÃO INDIVIDUAL',
        description: 'Contribuição de pessoa física (CPF)',
        default_value: 0,
        is_active: true,
      })
      .select('id')
      .single();
    
    if (typeError || !newType) {
      console.error('[importIndividualContributionsBatch] Failed to create type:', typeError);
      result.errors.push({ row: 0, message: 'Falha ao criar tipo de contribuição individual' });
      return result;
    }
    individualTypeId = newType.id;
    console.log(`[importIndividualContributionsBatch] Created individual contribution type: ${individualTypeId}`);
  }

  // 4. Determine base status from conversion type
  const baseStatus = conversionType.includes('paid') ? 'paid' : 'pending';
  const todayStr = new Date().toISOString().split('T')[0];

  // 5. Process all rows and build insert array
  const toInsert: Record<string, unknown>[] = [];
  const competenceKeysToInsert = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      // Debug: log first few rows to see what fields are coming in
      if (i < 3) {
        console.log(`[importIndividualContributionsBatch] Row ${i + 1} fields:`, Object.keys(row).join(', '));
        console.log(`[importIndividualContributionsBatch] Row ${i + 1} data:`, JSON.stringify(row));
      }

      // Try to get CPF from various field names
      const cpfValue = row.cpf || row.CPF || row.documento || row.DOCUMENTO || row.cnpj || row.CNPJ;
      const cpf = normalizeCpf(cpfValue);
      
      if (!cpf) {
        result.errors.push({ row: i + 1, message: `CPF inválido ou ausente. Valor recebido: ${String(cpfValue || 'vazio')}`, cnpj: String(cpfValue || '') });
        continue;
      }

      // Find patient (member) by CPF or auto-create if not found
      let patient = patientMap.get(cpf);
      if (!patient && autoCreateMembers) {
        // Auto-create the member/patient from the Lytex data
        const memberName = row.name ? String(row.name).trim() : `SÓCIO ${formatCpf(cpf)}`;
        const memberEmail = row.email ? String(row.email).trim().toLowerCase() : null;
        const memberPhone = row.phone ? String(row.phone).replace(/\D/g, '') : null;
        
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            clinic_id: clinicId,
            cpf: cpf,
            name: memberName,
            email: memberEmail,
            phone: memberPhone,
            is_active: true,
            tag: 'Sócio', // Default tag for union members
          })
          .select('id, name')
          .single();
        
        if (patientError) {
          // Check if it's a duplicate CPF error
          if (patientError.code === '23505') {
            // Try to fetch the existing patient
            const { data: existingPatient } = await supabase
              .from('patients')
              .select('id, name')
              .eq('clinic_id', clinicId)
              .eq('cpf', cpf)
              .maybeSingle();
            
            if (existingPatient) {
              patient = existingPatient;
              patientMap.set(cpf, patient);
            } else {
              result.errors.push({ row: i + 1, message: `Sócio não encontrado e falha ao criar: ${patientError.message}`, cnpj: cpf });
              continue;
            }
          } else {
            result.errors.push({ row: i + 1, message: `Falha ao criar sócio: ${patientError.message}`, cnpj: cpf });
            continue;
          }
        } else if (newPatient) {
          patient = newPatient;
          patientMap.set(cpf, patient);
          console.log(`[importIndividualContributionsBatch] Auto-created member: ${memberName} (${formatCpf(cpf)})`);
        }
      }
      
      if (!patient) {
        result.errors.push({ row: i + 1, message: `Sócio não encontrado com CPF: ${formatCpf(cpf)}. Ative a opção "Criar empresas automaticamente" para cadastrar novos sócios.`, cnpj: cpf });
        continue;
      }

      const value = parseCurrency(row.value);
      if (value < 0) {
        result.errors.push({ row: i + 1, message: 'Valor negativo não permitido', cnpj: cpf });
        continue;
      }

      const dueDate = parseDate(row.due_date) || new Date().toISOString().split('T')[0];
      const paymentDate = row.payment_date ? parseDate(row.payment_date) : null;

      // Get the type from the row or use individual type
      const typeName = String(row.contribution_type || row.tipo || row.type || '').trim();
      let typeId = individualTypeId;
      if (typeName) {
        const normalizedTypeName = typeName.toUpperCase();
        const customTypeId = typeMap.get(normalizedTypeName);
        if (customTypeId) {
          typeId = customTypeId;
        }
      }

      // Parse competence - try from competence field first, then from description
      let competenceYear = new Date().getFullYear();
      let competenceMonth = new Date().getMonth() + 1;
      
      if (row.competence) {
        const competence = String(row.competence);
        const match = competence.match(/(\d{1,2})[\/\-](\d{4})/);
        if (match) {
          const parsedMonth = parseInt(match[1]);
          const parsedYear = parseInt(match[2]);
          if (parsedMonth >= 1 && parsedMonth <= 12 && parsedYear >= 2020) {
            competenceMonth = parsedMonth;
            competenceYear = parsedYear;
          }
        }
      } else if (row.description) {
        // Try to extract competence from description (e.g., "MENSALIDADE INDIVIDUAL REFERENTE JANEIRO DE 2025")
        const descStr = String(row.description).toUpperCase();
        
        // Month names mapping
        const monthNames: Record<string, number> = {
          'JANEIRO': 1, 'FEVEREIRO': 2, 'MARCO': 3, 'MARÇO': 3, 'ABRIL': 4,
          'MAIO': 5, 'JUNHO': 6, 'JULHO': 7, 'AGOSTO': 8,
          'SETEMBRO': 9, 'OUTUBRO': 10, 'NOVEMBRO': 11, 'DEZEMBRO': 12
        };
        
        // Try pattern: "REFERENTE JANEIRO DE 2025" or "REFERENTE: JULHO/2025"
        const monthYearMatch = descStr.match(/(?:REFERENTE|REF\.?|COMPETENCIA|COMPETÊNCIA)[\s:]*([A-Z]+)[\s\/DE]*(\d{4})/i);
        if (monthYearMatch) {
          const monthName = monthYearMatch[1].trim();
          const year = parseInt(monthYearMatch[2]);
          const month = monthNames[monthName];
          if (month && year >= 2020) {
            competenceMonth = month;
            competenceYear = year;
          }
        } else {
          // Try pattern: "MM/YYYY" or "YYYY-MM"
          const numericMatch = descStr.match(/(\d{1,2})[\/\-](\d{4})/);
          if (numericMatch) {
            const parsedMonth = parseInt(numericMatch[1]);
            const parsedYear = parseInt(numericMatch[2]);
            if (parsedMonth >= 1 && parsedMonth <= 12 && parsedYear >= 2020) {
              competenceMonth = parsedMonth;
              competenceYear = parsedYear;
            }
          }
        }
      }

      // Generate unique key using member_id instead of employer_id
      // Format: member-{member_id}-{type_id}-{year}-{month}
      const activeCompetenceKey = `member-${patient.id}-${typeId}-${competenceYear}-${competenceMonth}`;

      // Check for duplicates within this batch
      if (competenceKeysToInsert.has(activeCompetenceKey)) {
        result.skipped++;
        continue;
      }

      competenceKeysToInsert.add(activeCompetenceKey);

      // Determine final status - check row.status from Lytex first
      let finalStatus: string = baseStatus;
      const rowStatus = String(row.status || '').toLowerCase().trim();
      if (rowStatus.includes('pago') || rowStatus === 'paid') {
        finalStatus = 'paid';
      } else if (rowStatus.includes('aguardando') || rowStatus === 'pending') {
        finalStatus = 'pending';
      } else if (rowStatus.includes('cancelad') || rowStatus === 'cancelled') {
        finalStatus = 'cancelled';
      } else if (baseStatus === 'pending') {
        finalStatus = dueDate < todayStr ? 'overdue' : 'pending';
      }

      // For individual contributions, we need to create a "virtual" employer record 
      // or use member_id directly. Since employer_id is required, we need to handle this.
      // Option: Create a placeholder employer for the member if needed
      
      // Check if we have an employer for this CPF (treated as CNPJ)
      let employerId: string | null = null;
      const { data: existingEmployer } = await supabase
        .from('employers')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('cnpj', cpf)
        .maybeSingle();
      
      if (existingEmployer) {
        employerId = existingEmployer.id;
      } else {
        // Create an employer entry for this individual (using CPF as CNPJ)
        const { data: newEmployer, error: employerError } = await supabase
          .from('employers')
          .insert({
            clinic_id: clinicId,
            cnpj: cpf,
            name: patient.name || `SÓCIO ${formatCpf(cpf)}`,
            is_active: true,
          })
          .select('id')
          .single();
        
        if (employerError) {
          result.errors.push({ row: i + 1, message: `Falha ao criar registro de sócio: ${employerError.message}`, cnpj: cpf });
          continue;
        }
        employerId = newEmployer!.id;
        console.log(`[importIndividualContributionsBatch] Created employer for individual: ${patient.name} (${formatCpf(cpf)})`);
      }

      // Extract lytex_invoice_id if present
      const lytexInvoiceId = row.lytex_invoice_id ? String(row.lytex_invoice_id).trim() : null;

      toInsert.push({
        clinic_id: clinicId,
        employer_id: employerId,
        member_id: patient.id, // Link to the patient/member
        contribution_type_id: typeId,
        value,
        due_date: dueDate,
        status: finalStatus,
        competence_month: competenceMonth,
        competence_year: competenceYear,
        paid_at: finalStatus === 'paid' ? (paymentDate || dueDate) : null,
        paid_value: finalStatus === 'paid' ? value : null,
        notes: row.notes || row.description ? String(row.notes || row.description).trim() : null,
        origin: 'import',
        lytex_invoice_id: lytexInvoiceId,
      });
    } catch (err) {
      const error = err as Error;
      result.errors.push({ row: i + 1, message: error.message || 'Erro ao processar registro' });
    }
  }

  console.log(`[importIndividualContributionsBatch] Prepared ${toInsert.length} individual contributions for insert`);

  // 6. Batch insert (no upsert since we're using member_id which has different unique key)
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();
      
      const { data: insertedData, error } = await supabase
        .from('employer_contributions')
        .insert(batch)
        .select('id');

      const batchDuration = Date.now() - batchStart;
      
      if (error) {
        console.error(`[importIndividualContributionsBatch] Batch ${Math.floor(i / BATCH_SIZE) + 1} error (${batchDuration}ms):`, error);
        // Try inserting one by one to identify problematic records
        for (let j = 0; j < batch.length; j++) {
          const { error: singleError } = await supabase
            .from('employer_contributions')
            .insert(batch[j]);
          if (singleError) {
            if (singleError.code === '23505') { // Unique violation
              result.skipped++;
            } else {
              result.errors.push({ row: i + j + 1, message: singleError.message });
            }
          } else {
            result.inserted++;
          }
        }
      } else {
        const insertedCount = insertedData?.length || batch.length;
        result.inserted += insertedCount;
        console.log(`[importIndividualContributionsBatch] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toInsert.length / BATCH_SIZE)}: inserted=${insertedCount} (${batchDuration}ms)`);
      }
    }
  }

  return result;
}

// ================== SUPPLIER IMPORT FUNCTION ==================

async function importSuppliersBatch(
  supabase: SupabaseClient,
  clinicId: string,
  data: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  console.log(`[importSuppliersBatch] Starting with ${data.length} records`);

  // Load existing suppliers by CNPJ
  const cnpjsToCheck = data
    .map(row => normalizeCnpj(row.cnpj))
    .filter((cnpj): cnpj is string => cnpj !== null);
  
  const { data: existingSuppliers } = await supabase
    .from('suppliers')
    .select('id, cnpj')
    .eq('clinic_id', clinicId)
    .in('cnpj', cnpjsToCheck);
  
  // Normalize CNPJ keys for consistent lookup
  const existingCnpjMap = new Map<string, string>();
  (existingSuppliers || []).forEach(s => {
    const normalized = normalizeCnpj(s.cnpj);
    if (normalized) {
      existingCnpjMap.set(normalized, s.id);
    }
  });

  console.log(`[importSuppliersBatch] Found ${existingCnpjMap.size} existing suppliers by CNPJ`);

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    // Name is required
    const name = String(row.name || '').trim();
    if (!name || name.length < 2) {
      result.errors.push({ row: i + 1, message: 'Nome é obrigatório (mínimo 2 caracteres)' });
      continue;
    }

    const cnpj = normalizeCnpj(row.cnpj);

    const supplierData: Record<string, unknown> = {
      clinic_id: clinicId,
      name: name.toUpperCase(),
      cnpj: cnpj || null,
      email: row.email ? String(row.email).trim().toLowerCase() : null,
      phone: row.phone ? normalizePhone(row.phone) : null,
      address: row.address ? String(row.address).trim() : null,
      city: row.city ? String(row.city).trim() : null,
      state: row.state ? String(row.state).trim().toUpperCase() : null,
      contact_name: row.contact_name ? String(row.contact_name).trim() : null,
      notes: row.notes ? String(row.notes).trim() : null,
      is_active: true,
    };

    // Check for existing by CNPJ if present
    const existingId = cnpj ? existingCnpjMap.get(cnpj) : undefined;
    if (existingId) {
      toUpdate.push({ id: existingId, data: supplierData });
    } else {
      toInsert.push(supplierData);
    }
  }

  console.log(`[importSuppliersBatch] To insert: ${toInsert.length}, To update: ${toUpdate.length}`);

  // Batch insert
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('suppliers').insert(batch);
      if (error) {
        console.error('[importSuppliersBatch] Insert error:', error);
        result.errors.push({ row: 0, message: `Erro ao inserir lote: ${error.message}` });
      } else {
        result.inserted += batch.length;
      }
    }
  }

  // Batch update
  const updatePromises = toUpdate.map(async ({ id, data: supplierData }) => {
    const { error } = await supabase.from('suppliers').update(supplierData).eq('id', id);
    return error ? 'error' : 'success';
  });
  
  const updateResults = await Promise.all(updatePromises);
  result.updated = updateResults.filter(r => r === 'success').length;

  console.log(`[importSuppliersBatch] Complete: inserted=${result.inserted}, updated=${result.updated}`);

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

function formatCpf(cpf: string): string {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
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
  if (typeof value === 'number') {
    // If already a number, assume it's in reais and convert to cents
    return Math.round(value * 100);
  }
  if (!value) return 0;

  let str = String(value).trim();
  str = str.replace(/[R$\s]/g, '');

  // Check for Brazilian format (1.234,56)
  if (str.includes(',') && str.lastIndexOf(',') > str.lastIndexOf('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(str);
  // Convert to cents (integer)
  return isNaN(num) ? 0 : Math.round(num * 100);
}
