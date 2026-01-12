import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      console.error('[migrate-union-financial-data] Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'clinic_id and entity_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[migrate-union-financial-data] Starting migration for clinic: ${clinic_id}, entity: ${entity_id}`);

    const results = {
      cashRegisters: { migrated: 0, skipped: 0, errors: 0 },
      categories: { migrated: 0, skipped: 0, errors: 0 },
      chartOfAccounts: { migrated: 0, skipped: 0, errors: 0 }
    };

    // ========== MIGRATE CASH REGISTERS ==========
    console.log('[migrate-union-financial-data] Migrating cash registers...');

    // 1. Fetch all active cash registers from the clinic
    const { data: clinicRegisters, error: registersError } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('is_active', true);

    if (registersError) {
      console.error('[migrate-union-financial-data] Error fetching cash registers:', registersError);
      throw registersError;
    }

    console.log(`[migrate-union-financial-data] Found ${clinicRegisters?.length || 0} cash registers to migrate`);

    if (clinicRegisters && clinicRegisters.length > 0) {
      // 2. Get existing union cash registers to avoid duplicates (by name + type)
      const { data: existingRegisters, error: existingRegError } = await supabase
        .from('union_cash_registers')
        .select('name, type')
        .eq('clinic_id', clinic_id);

      if (existingRegError) {
        console.error('[migrate-union-financial-data] Error fetching existing registers:', existingRegError);
        throw existingRegError;
      }

      const existingKeys = new Set(
        existingRegisters?.map(r => `${r.name?.toLowerCase()}-${r.type}`) || []
      );

      // 3. Filter and map cash registers
      const registersToInsert = clinicRegisters
        .filter(register => {
          const key = `${register.name?.toLowerCase()}-${register.type}`;
          if (existingKeys.has(key)) {
            console.log(`[migrate-union-financial-data] Skipping duplicate register: ${register.name}`);
            results.cashRegisters.skipped++;
            return false;
          }
          return true;
        })
        .map(register => ({
          clinic_id: clinic_id,
          name: register.name,
          type: register.type === 'bank' ? 'bank_account' : register.type, // Fix type mapping
          bank_name: register.bank_name,
          agency: register.agency,
          account_number: register.account_number,
          initial_balance: register.initial_balance || 0,
          current_balance: register.initial_balance || 0, // Start fresh
          is_active: true,
        }));

      if (registersToInsert.length > 0) {
        const { data: insertedRegisters, error: insertRegError } = await supabase
          .from('union_cash_registers')
          .insert(registersToInsert)
          .select('id');

        if (insertRegError) {
          console.error('[migrate-union-financial-data] Error inserting cash registers:', insertRegError);
          results.cashRegisters.errors = registersToInsert.length;
        } else {
          results.cashRegisters.migrated = insertedRegisters?.length || 0;
          console.log(`[migrate-union-financial-data] Migrated ${results.cashRegisters.migrated} cash registers`);
        }
      }
    }

    // ========== MIGRATE FINANCIAL CATEGORIES ==========
    console.log('[migrate-union-financial-data] Migrating financial categories...');

    // 1. Fetch all active categories from the clinic
    const { data: clinicCategories, error: categoriesError } = await supabase
      .from('financial_categories')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('is_active', true);

    if (categoriesError) {
      console.error('[migrate-union-financial-data] Error fetching categories:', categoriesError);
      throw categoriesError;
    }

    console.log(`[migrate-union-financial-data] Found ${clinicCategories?.length || 0} categories to migrate`);

    if (clinicCategories && clinicCategories.length > 0) {
      // 2. Get existing union categories to avoid duplicates (by name + type)
      const { data: existingCategories, error: existingCatError } = await supabase
        .from('union_financial_categories')
        .select('name, type')
        .eq('clinic_id', clinic_id);

      if (existingCatError) {
        console.error('[migrate-union-financial-data] Error fetching existing categories:', existingCatError);
        throw existingCatError;
      }

      const existingCatKeys = new Set(
        existingCategories?.map(c => `${c.name?.toLowerCase()}-${c.type}`) || []
      );

      // 3. Filter and map categories (without parent_id first, then update)
      const categoriesToInsert = clinicCategories
        .filter(category => {
          const key = `${category.name?.toLowerCase()}-${category.type}`;
          if (existingCatKeys.has(key)) {
            console.log(`[migrate-union-financial-data] Skipping duplicate category: ${category.name}`);
            results.categories.skipped++;
            return false;
          }
          return true;
        })
        .map(category => ({
          clinic_id: clinic_id,
          name: category.name,
          type: category.type,
          color: category.color,
          icon: null, // union_financial_categories has icon field
          parent_id: null, // Will be updated after all categories are inserted if needed
          is_active: true,
        }));

      if (categoriesToInsert.length > 0) {
        const { data: insertedCategories, error: insertCatError } = await supabase
          .from('union_financial_categories')
          .insert(categoriesToInsert)
          .select('id');

        if (insertCatError) {
          console.error('[migrate-union-financial-data] Error inserting categories:', insertCatError);
          results.categories.errors = categoriesToInsert.length;
        } else {
          results.categories.migrated = insertedCategories?.length || 0;
          console.log(`[migrate-union-financial-data] Migrated ${results.categories.migrated} categories`);
        }
      }
    }

    // ========== MIGRATE CHART OF ACCOUNTS ==========
    console.log('[migrate-union-financial-data] Migrating chart of accounts...');

    // 1. Fetch all active accounts from the clinic
    const { data: clinicAccounts, error: accountsError } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('clinic_id', clinic_id)
      .is('deleted_at', null)
      .eq('is_active', true);

    if (accountsError) {
      console.error('[migrate-union-financial-data] Error fetching chart of accounts:', accountsError);
      throw accountsError;
    }

    console.log(`[migrate-union-financial-data] Found ${clinicAccounts?.length || 0} accounts to migrate`);

    if (clinicAccounts && clinicAccounts.length > 0) {
      // 2. Get existing union accounts to avoid duplicates (by account_code)
      const { data: existingAccounts, error: existingAccError } = await supabase
        .from('union_chart_of_accounts')
        .select('account_code')
        .eq('clinic_id', clinic_id);

      if (existingAccError) {
        console.error('[migrate-union-financial-data] Error fetching existing accounts:', existingAccError);
        throw existingAccError;
      }

      const existingAccountCodes = new Set(
        existingAccounts?.map(a => a.account_code?.toLowerCase()) || []
      );

      // 3. Create ID mapping for parent references
      const idMapping: Record<string, string> = {};

      // Sort accounts by hierarchy level to insert parents first
      const sortedAccounts = [...clinicAccounts].sort((a, b) => 
        (a.hierarchy_level || 1) - (b.hierarchy_level || 1)
      );

      // 4. Filter accounts that don't already exist
      const accountsToInsert = sortedAccounts.filter(account => {
        if (existingAccountCodes.has(account.account_code?.toLowerCase())) {
          console.log(`[migrate-union-financial-data] Skipping duplicate account: ${account.account_code}`);
          results.chartOfAccounts.skipped++;
          return false;
        }
        return true;
      });

      // 5. Insert accounts in batches, respecting hierarchy
      for (const account of accountsToInsert) {
        const newParentId = account.parent_id ? idMapping[account.parent_id] : null;

        const { data: insertedAccount, error: insertAccError } = await supabase
          .from('union_chart_of_accounts')
          .insert({
            clinic_id: clinic_id,
            account_code: account.account_code,
            account_name: account.account_name,
            account_type: account.account_type,
            hierarchy_level: account.hierarchy_level || 1,
            full_path: account.full_path,
            is_synthetic: account.is_synthetic || false,
            is_active: true,
            parent_id: newParentId,
          })
          .select('id')
          .single();

        if (insertAccError) {
          console.error(`[migrate-union-financial-data] Error inserting account ${account.account_code}:`, insertAccError);
          results.chartOfAccounts.errors++;
        } else if (insertedAccount) {
          idMapping[account.id] = insertedAccount.id;
          results.chartOfAccounts.migrated++;
        }
      }

      console.log(`[migrate-union-financial-data] Migrated ${results.chartOfAccounts.migrated} accounts`);
    }

    // Log the migration in union_audit_logs
    await supabase
      .from('union_audit_logs')
      .insert({
        clinic_id: clinic_id,
        action: 'financial_data_migrated',
        entity_type: 'union_financial_data',
        details: {
          entity_id,
          cash_registers: results.cashRegisters,
          categories: results.categories,
          chart_of_accounts: results.chartOfAccounts
        }
      });

    const totalMigrated = results.cashRegisters.migrated + results.categories.migrated + results.chartOfAccounts.migrated;
    const totalSkipped = results.cashRegisters.skipped + results.categories.skipped + results.chartOfAccounts.skipped;

    console.log(`[migrate-union-financial-data] Migration completed. Total migrated: ${totalMigrated}, skipped: ${totalSkipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migrated ${totalMigrated} records successfully`,
        cashRegisters: results.cashRegisters,
        categories: results.categories,
        chartOfAccounts: results.chartOfAccounts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[migrate-union-financial-data] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
