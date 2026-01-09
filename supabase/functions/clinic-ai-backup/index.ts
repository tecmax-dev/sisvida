import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify super admin
    const { data: superAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado - apenas super admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get clinic_id from query params
    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinic_id");
    
    if (!clinicId) {
      return new Response(JSON.stringify({ error: "clinic_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting AI backup for clinic: ${clinicId}`);

    // Fetch clinic info
    const { data: clinicData, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("*")
      .eq("id", clinicId)
      .single();

    if (clinicError || !clinicData) {
      return new Response(JSON.stringify({ error: "Clínica não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper function to fetch all data with pagination
    const fetchAllData = async (table: string, filter: { column: string; value: string } | null, orderBy?: string) => {
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabaseAdmin.from(table).select("*");
        
        if (filter) {
          query = query.eq(filter.column, filter.value);
        }
        
        if (orderBy) {
          query = query.order(orderBy, { ascending: true });
        }
        
        const { data, error } = await query.range(from, from + pageSize - 1);
        
        if (error) {
          console.error(`Error fetching ${table}:`, error);
          return { data: allData, error: error.message };
        }
        
        if (data && data.length > 0) {
          allData.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return { data: allData, error: null };
    };

    // Define tables in import order (respecting foreign keys)
    const tablesToExport = [
      { table: "clinics", filter: { column: "id", value: clinicId }, orderBy: "created_at" },
      { table: "contribution_types", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "employer_categories", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "employers", filter: { column: "clinic_id", value: clinicId }, orderBy: "trade_name" },
      { table: "insurance_plans", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "professionals", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "procedures", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "patients", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "patient_dependents", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "patient_cards", filter: { column: "clinic_id", value: clinicId }, orderBy: "created_at" },
      { table: "accounting_offices", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "employer_contributions", filter: { column: "clinic_id", value: clinicId }, orderBy: "due_date" },
      { table: "medical_records", filter: { column: "clinic_id", value: clinicId }, orderBy: "created_at" },
      { table: "appointments", filter: { column: "clinic_id", value: clinicId }, orderBy: "appointment_date" },
      { table: "user_roles", filter: { column: "clinic_id", value: clinicId }, orderBy: "created_at" },
      { table: "access_groups", filter: { column: "clinic_id", value: clinicId }, orderBy: "name" },
      { table: "clinic_holidays", filter: { column: "clinic_id", value: clinicId }, orderBy: "holiday_date" },
      { table: "document_settings", filter: { column: "clinic_id", value: clinicId }, orderBy: null },
    ];

    const data: Record<string, any[]> = {};
    const metadata: Record<string, number> = {};
    const errors: string[] = [];

    // Fetch data for each table
    for (const config of tablesToExport) {
      console.log(`Fetching ${config.table}...`);
      const result = await fetchAllData(config.table, config.filter, config.orderBy || undefined);
      data[config.table] = result.data;
      metadata[config.table] = result.data.length;
      if (result.error) {
        errors.push(`${config.table}: ${result.error}`);
      }
      console.log(`${config.table}: ${result.data.length} records`);
    }

    // Fetch accounting_office_employers (via accounting_offices)
    const accountingOfficeIds = data.accounting_offices?.map((ao: any) => ao.id) || [];
    if (accountingOfficeIds.length > 0) {
      const { data: aoeData, error: aoeError } = await supabaseAdmin
        .from("accounting_office_employers")
        .select("*")
        .in("accounting_office_id", accountingOfficeIds);
      
      data.accounting_office_employers = aoeData || [];
      metadata.accounting_office_employers = data.accounting_office_employers.length;
      if (aoeError) errors.push(`accounting_office_employers: ${aoeError.message}`);
    } else {
      data.accounting_office_employers = [];
      metadata.accounting_office_employers = 0;
    }

    // Fetch access_group_permissions (via access_groups)
    const accessGroupIds = data.access_groups?.map((ag: any) => ag.id) || [];
    if (accessGroupIds.length > 0) {
      const { data: agpData, error: agpError } = await supabaseAdmin
        .from("access_group_permissions")
        .select("*")
        .in("access_group_id", accessGroupIds);
      
      data.access_group_permissions = agpData || [];
      metadata.access_group_permissions = data.access_group_permissions.length;
      if (agpError) errors.push(`access_group_permissions: ${agpError.message}`);
    } else {
      data.access_group_permissions = [];
      metadata.access_group_permissions = 0;
    }

    const totalRecords = Object.values(metadata).reduce((sum, count) => sum + count, 0);

    // Build the AI-optimized backup structure
    const backup = {
      version: "2.0",
      type: "clinic_full_backup_ai",
      generated_at: new Date().toISOString(),
      
      ai_import_instructions: {
        description: "Backup completo da clínica otimizado para importação por IA",
        language: "pt-BR",
        important_rules: [
          "1. SEMPRE importar na ordem especificada em import_order",
          "2. Usar UPSERT (INSERT ... ON CONFLICT) para preservar UUIDs originais",
          "3. Substituir clinic_id pelo ID da clínica destino em TODOS os registros",
          "4. Manter todos os relacionamentos (patient_id, employer_id, etc.) intactos",
          "5. Para patient_cards, gerar novos card_number se houver conflito",
          "6. Verificar foreign keys antes de cada inserção",
          "7. Usar transação única para garantir atomicidade",
          "8. Campos created_at e updated_at podem ser preservados ou regenerados"
        ],
        import_order: [
          { step: 1, table: "clinics", description: "Criar/atualizar a clínica destino primeiro", notes: "Este registro define o novo clinic_id" },
          { step: 2, table: "contribution_types", description: "Tipos de contribuição", notes: "Referenciado por employer_contributions" },
          { step: 3, table: "employer_categories", description: "Categorias de empresas", notes: "Referenciado por employers" },
          { step: 4, table: "employers", description: "Empresas/empregadores", notes: "Referencia employer_categories, referenciado por patients" },
          { step: 5, table: "insurance_plans", description: "Planos de saúde", notes: "Referenciado por patients" },
          { step: 6, table: "professionals", description: "Profissionais de saúde", notes: "Referenciado por appointments e medical_records" },
          { step: 7, table: "procedures", description: "Procedimentos médicos", notes: "Referenciado por appointments" },
          { step: 8, table: "patients", description: "Pacientes/associados", notes: "Referencia employer_id e insurance_plan_id" },
          { step: 9, table: "patient_dependents", description: "Dependentes dos pacientes", notes: "Referencia patient_id" },
          { step: 10, table: "patient_cards", description: "Carteirinhas dos pacientes", notes: "Referencia patient_id, card_number deve ser único por clínica" },
          { step: 11, table: "accounting_offices", description: "Escritórios de contabilidade", notes: "Referenciado por accounting_office_employers" },
          { step: 12, table: "accounting_office_employers", description: "Vínculo escritório-empresa", notes: "Referencia accounting_office_id e employer_id" },
          { step: 13, table: "employer_contributions", description: "Contribuições/boletos mensais", notes: "Referencia employer_id e contribution_type_id" },
          { step: 14, table: "medical_records", description: "Prontuários médicos", notes: "Referencia patient_id e professional_id" },
          { step: 15, table: "appointments", description: "Agendamentos", notes: "Referencia patient_id, professional_id e procedure_id" },
          { step: 16, table: "access_groups", description: "Grupos de acesso/permissões", notes: "Referenciado por access_group_permissions" },
          { step: 17, table: "access_group_permissions", description: "Permissões dos grupos", notes: "Referencia access_group_id" },
          { step: 18, table: "user_roles", description: "Papéis de usuários", notes: "Vincula auth.users à clínica" },
          { step: 19, table: "clinic_holidays", description: "Feriados da clínica", notes: "Feriados personalizados" },
          { step: 20, table: "document_settings", description: "Configurações de documentos", notes: "Templates de prescrição, atestado, etc." }
        ],
        example_import_code: `
-- Exemplo de importação SQL (ajustar clinic_id)
BEGIN;

-- 1. Inserir/atualizar clínica
INSERT INTO clinics (id, name, slug, ...)
SELECT id, name, slug, ...
FROM json_populate_recordset(null::clinics, '[...]')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, ...;

-- 2. Inserir tipos de contribuição (substituir clinic_id)
INSERT INTO contribution_types (id, clinic_id, name, ...)
SELECT id, 'NEW_CLINIC_ID', name, ...
FROM json_populate_recordset(null::contribution_types, '[...]')
ON CONFLICT (id) DO UPDATE SET ...;

-- Continuar na ordem especificada...

COMMIT;
        `.trim()
      },
      
      schema_hints: {
        clinics: {
          primary_key: "id",
          unique_constraints: ["slug"],
          notes: "Registro principal da clínica"
        },
        contribution_types: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id" },
          unique_constraints: ["clinic_id + name"],
          notes: "Tipos de contribuição (mensalidade, taxa, etc.)"
        },
        employer_categories: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id" },
          notes: "Categorias para agrupar empresas"
        },
        employers: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id", category_id: "employer_categories.id" },
          unique_constraints: ["clinic_id + cnpj"],
          notes: "Empresas/empregadores dos associados"
        },
        patients: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id", employer_id: "employers.id", insurance_plan_id: "insurance_plans.id" },
          unique_constraints: ["clinic_id + cpf"],
          notes: "Pacientes/associados - employer_id pode ser NULL"
        },
        patient_dependents: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id", patient_id: "patients.id" },
          notes: "Dependentes vinculados ao titular"
        },
        patient_cards: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id", patient_id: "patients.id" },
          unique_constraints: ["clinic_id + card_number"],
          notes: "Carteirinhas - card_number gerado automaticamente"
        },
        employer_contributions: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id", employer_id: "employers.id", contribution_type_id: "contribution_types.id" },
          notes: "Contribuições mensais das empresas"
        },
        medical_records: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id", patient_id: "patients.id", professional_id: "professionals.id" },
          notes: "Prontuários e atendimentos"
        },
        appointments: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id", patient_id: "patients.id", professional_id: "professionals.id", procedure_id: "procedures.id" },
          notes: "Agendamentos de consultas"
        },
        accounting_offices: {
          primary_key: "id",
          foreign_keys: { clinic_id: "clinics.id" },
          notes: "Escritórios de contabilidade"
        },
        accounting_office_employers: {
          primary_key: "id",
          foreign_keys: { accounting_office_id: "accounting_offices.id", employer_id: "employers.id" },
          notes: "Vínculo muitos-para-muitos entre escritórios e empresas"
        }
      },
      
      clinic_info: {
        id: clinicData.id,
        name: clinicData.name,
        slug: clinicData.slug,
        created_at: clinicData.created_at
      },
      
      data: data,
      
      metadata: {
        record_counts: metadata,
        total_records: totalRecords,
        export_errors: errors,
        tables_exported: Object.keys(data).length
      }
    };

    console.log(`Backup complete: ${totalRecords} records from ${Object.keys(data).length} tables`);

    const jsonContent = JSON.stringify(backup, null, 2);
    const filename = `backup_ai_${clinicData.slug}_${new Date().toISOString().split('T')[0]}.json`;

    return new Response(jsonContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("Backup error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
