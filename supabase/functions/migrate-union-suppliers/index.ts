import { createClient } from 'npm:@supabase/supabase-js@2';
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT verification bypass for internal calls
const SIGNING_SECRET = Deno.env.get("SUPABASE_JWT_SECRET");

async function verifyJWT(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  // For now, accept any valid token format for internal calls
  return authHeader.startsWith("Bearer ");
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clinic_id, entity_id } = await req.json();

    if (!clinic_id || !entity_id) {
      console.error('[migrate-union-suppliers] Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'clinic_id and entity_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[migrate-union-suppliers] Starting migration for clinic: ${clinic_id}, entity: ${entity_id}`);

    // 1. Fetch all active suppliers from the clinic
    const { data: clinicSuppliers, error: fetchError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('is_active', true);

    if (fetchError) {
      console.error('[migrate-union-suppliers] Error fetching clinic suppliers:', fetchError);
      throw fetchError;
    }

    console.log(`[migrate-union-suppliers] Found ${clinicSuppliers?.length || 0} suppliers to migrate`);

    if (!clinicSuppliers || clinicSuppliers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No suppliers to migrate',
          migrated: 0,
          skipped: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get existing union suppliers to avoid duplicates (by CNPJ)
    const { data: existingUnionSuppliers, error: existingError } = await supabase
      .from('union_suppliers')
      .select('cnpj')
      .eq('clinic_id', clinic_id)
      .not('cnpj', 'is', null);

    if (existingError) {
      console.error('[migrate-union-suppliers] Error fetching existing union suppliers:', existingError);
      throw existingError;
    }

    const existingCnpjs = new Set(existingUnionSuppliers?.map(s => s.cnpj?.replace(/\D/g, '')) || []);
    console.log(`[migrate-union-suppliers] Found ${existingCnpjs.size} existing union suppliers by CNPJ`);

    // 3. Map and filter suppliers to union_suppliers format
    const suppliersToInsert = clinicSuppliers
      .filter(supplier => {
        // Skip if CNPJ already exists in union_suppliers
        if (supplier.cnpj) {
          const normalizedCnpj = supplier.cnpj.replace(/\D/g, '');
          if (existingCnpjs.has(normalizedCnpj)) {
            console.log(`[migrate-union-suppliers] Skipping duplicate CNPJ: ${supplier.cnpj}`);
            return false;
          }
        }
        return true;
      })
      .map(supplier => ({
        clinic_id: clinic_id,
        name: supplier.name,
        trade_name: null, // suppliers table doesn't have trade_name
        cnpj: supplier.cnpj,
        cpf: null, // suppliers table doesn't have cpf
        email: supplier.email,
        phone: supplier.phone,
        contact_name: supplier.contact_name,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state,
        zip_code: null, // suppliers table doesn't have zip_code
        notes: supplier.notes,
        is_active: supplier.is_active ?? true,
      }));

    console.log(`[migrate-union-suppliers] Preparing to insert ${suppliersToInsert.length} suppliers`);

    if (suppliersToInsert.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All suppliers already migrated',
          migrated: 0,
          skipped: clinicSuppliers.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Insert in batches of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < suppliersToInsert.length; i += BATCH_SIZE) {
      const batch = suppliersToInsert.slice(i, i + BATCH_SIZE);
      
      const { data: insertedData, error: insertError } = await supabase
        .from('union_suppliers')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error(`[migrate-union-suppliers] Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError);
        totalErrors += batch.length;
      } else {
        totalInserted += insertedData?.length || 0;
        console.log(`[migrate-union-suppliers] Batch ${i / BATCH_SIZE + 1} inserted: ${insertedData?.length || 0} suppliers`);
      }
    }

    // 5. Log the migration in union_audit_logs
    await supabase
      .from('union_audit_logs')
      .insert({
        clinic_id: clinic_id,
        action: 'suppliers_migrated',
        entity_type: 'union_suppliers',
        details: {
          entity_id,
          total_clinic_suppliers: clinicSuppliers.length,
          migrated: totalInserted,
          skipped: clinicSuppliers.length - suppliersToInsert.length,
          errors: totalErrors
        }
      });

    console.log(`[migrate-union-suppliers] Migration completed. Inserted: ${totalInserted}, Skipped: ${clinicSuppliers.length - suppliersToInsert.length}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Migrated ${totalInserted} suppliers successfully`,
        migrated: totalInserted,
        skipped: clinicSuppliers.length - suppliersToInsert.length,
        errors: totalErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[migrate-union-suppliers] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
