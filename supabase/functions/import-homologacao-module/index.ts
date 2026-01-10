import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Order of import to respect foreign key dependencies
const IMPORT_ORDER = [
  'settings',
  'professionals',
  'service_types',
  'schedules',
  'professional_services',
  'blocks',
  'appointments',
  'notifications',
];

// Foreign key mappings for ID remapping
const FK_MAPPINGS: Record<string, Record<string, string>> = {
  schedules: { professional_id: 'professionals' },
  professional_services: { 
    professional_id: 'professionals',
    service_type_id: 'service_types'
  },
  blocks: { professional_id: 'professionals' },
  appointments: { 
    professional_id: 'professionals',
    service_type_id: 'service_types'
  },
  notifications: { appointment_id: 'appointments' }
};

// Fields to ignore during import (auto-generated)
const IGNORED_FIELDS = [
  'id',
  'clinic_id',
  'created_at',
  'updated_at',
  'confirmation_token',
];

interface BackupData {
  module: string;
  version: string;
  exported_at: string;
  exported_by?: string;
  clinic?: {
    id: string;
    name: string;
    slug: string;
  };
  data: {
    settings?: any[];
    professionals?: any[];
    service_types?: any[];
    schedules?: any[];
    professional_services?: any[];
    blocks?: any[];
    appointments?: any[];
    notifications?: any[];
  };
  stats?: {
    total_records: number;
    by_table: Record<string, number>;
  };
}

interface ImportOptions {
  clear_existing?: boolean;
  skip_appointments?: boolean;
}

interface ImportResult {
  success: boolean;
  summary: {
    table: string;
    imported: number;
    errors: number;
  }[];
  total_imported: number;
  total_errors: number;
  id_mappings: Record<string, Record<string, string>>;
  error_details: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Admin client for data operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // User client for auth verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user and check if super admin
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check super admin status
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Apenas Super Admins podem importar dados' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { target_clinic_id, backup_data, options = {} }: {
      target_clinic_id: string;
      backup_data: BackupData;
      options: ImportOptions;
    } = await req.json();

    // Validate required fields
    if (!target_clinic_id) {
      return new Response(
        JSON.stringify({ error: 'target_clinic_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!backup_data || backup_data.module !== 'homologacao') {
      return new Response(
        JSON.stringify({ error: 'Backup inválido: module deve ser "homologacao"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify target clinic exists
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('id, name')
      .eq('id', target_clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ error: 'Clínica destino não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[IMPORT] Starting import for clinic: ${clinic.name} (${target_clinic_id})`);
    console.log(`[IMPORT] Options:`, options);

    // ID mapping storage: table -> { oldId -> newId }
    const idMappings: Record<string, Record<string, string>> = {};
    const result: ImportResult = {
      success: true,
      summary: [],
      total_imported: 0,
      total_errors: 0,
      id_mappings: idMappings,
      error_details: [],
    };

    // Clear existing data if requested
    if (options.clear_existing) {
      console.log('[IMPORT] Clearing existing data...');
      
      // Delete in reverse order to respect FKs
      for (const table of [...IMPORT_ORDER].reverse()) {
        if (table === 'settings') {
          // Settings: update to null values instead of delete (unique constraint)
          await supabaseAdmin
            .from(`homologacao_${table}`)
            .delete()
            .eq('clinic_id', target_clinic_id);
        } else {
          await supabaseAdmin
            .from(`homologacao_${table}`)
            .delete()
            .eq('clinic_id', target_clinic_id);
        }
      }
      
      console.log('[IMPORT] Existing data cleared');
    }

    // Import each table in order
    for (const tableName of IMPORT_ORDER) {
      // Skip appointments if requested
      if (options.skip_appointments && (tableName === 'appointments' || tableName === 'notifications')) {
        console.log(`[IMPORT] Skipping ${tableName} (skip_appointments enabled)`);
        continue;
      }

      const records = backup_data.data[tableName as keyof typeof backup_data.data];
      if (!records || records.length === 0) {
        console.log(`[IMPORT] No records for ${tableName}`);
        result.summary.push({ table: tableName, imported: 0, errors: 0 });
        continue;
      }

      console.log(`[IMPORT] Processing ${tableName}: ${records.length} records`);
      
      let imported = 0;
      let errors = 0;
      idMappings[tableName] = {};

      for (const record of records) {
        try {
          const oldId = record.id;
          
          // Clean record: remove ignored fields and set clinic_id
          const cleanRecord: Record<string, any> = {};
          for (const [key, value] of Object.entries(record)) {
            if (!IGNORED_FIELDS.includes(key)) {
              cleanRecord[key] = value;
            }
          }
          cleanRecord.clinic_id = target_clinic_id;

          // Remap foreign keys using ID mappings
          const fkMappings = FK_MAPPINGS[tableName];
          if (fkMappings) {
            for (const [fkField, refTable] of Object.entries(fkMappings)) {
              const oldFkValue = record[fkField];
              if (oldFkValue && idMappings[refTable]?.[oldFkValue]) {
                cleanRecord[fkField] = idMappings[refTable][oldFkValue];
              } else if (oldFkValue) {
                // FK reference not found - skip or nullify
                console.warn(`[IMPORT] FK not found: ${tableName}.${fkField} -> ${refTable}[${oldFkValue}]`);
                cleanRecord[fkField] = null;
              }
            }
          }

          // Special handling for settings (upsert)
          if (tableName === 'settings') {
            const { data: insertedData, error: insertError } = await supabaseAdmin
              .from('homologacao_settings')
              .upsert(cleanRecord, { onConflict: 'clinic_id' })
              .select('id')
              .single();

            if (insertError) {
              console.error(`[IMPORT] Error inserting ${tableName}:`, insertError);
              result.error_details.push(`${tableName}: ${insertError.message}`);
              errors++;
            } else if (insertedData) {
              idMappings[tableName][oldId] = insertedData.id;
              imported++;
            }
          } else {
            // Standard insert
            const { data: insertedData, error: insertError } = await supabaseAdmin
              .from(`homologacao_${tableName}`)
              .insert(cleanRecord)
              .select('id')
              .single();

            if (insertError) {
              console.error(`[IMPORT] Error inserting ${tableName}:`, insertError);
              result.error_details.push(`${tableName}: ${insertError.message}`);
              errors++;
            } else if (insertedData) {
              idMappings[tableName][oldId] = insertedData.id;
              imported++;
            }
          }
        } catch (err) {
          console.error(`[IMPORT] Exception processing ${tableName} record:`, err);
          result.error_details.push(`${tableName}: ${String(err)}`);
          errors++;
        }
      }

      result.summary.push({ table: tableName, imported, errors });
      result.total_imported += imported;
      result.total_errors += errors;
      
      console.log(`[IMPORT] ${tableName}: imported=${imported}, errors=${errors}`);
    }

    // Log import in import_logs
    try {
      await supabaseAdmin
        .from('import_logs')
        .insert({
          clinic_id: target_clinic_id,
          import_type: 'homologacao_module',
          status: result.total_errors > 0 ? 'completed_with_errors' : 'completed',
          total_rows: result.total_imported + result.total_errors,
          success_count: result.total_imported,
          error_count: result.total_errors,
          error_details: result.error_details.length > 0 ? { errors: result.error_details } : null,
          completed_at: new Date().toISOString(),
        });
    } catch (logErr) {
      console.error('[IMPORT] Error logging import:', logErr);
    }

    result.success = result.total_errors === 0;

    console.log(`[IMPORT] Complete. Total: ${result.total_imported} imported, ${result.total_errors} errors`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[IMPORT] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao processar importação',
        details: String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});