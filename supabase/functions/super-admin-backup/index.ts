import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado - Apenas Super Admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Super Admin backup iniciado por: ${user.email}`);

    // Tables to export (global configurations only)
    const tablesToExport = [
      "subscription_plans",
      "system_features",
      "plan_features",
      "subscription_addons",
      "permission_definitions",
      "feature_permissions",
      "hero_settings",
      "carousel_banners",
      "global_config",
      "national_holidays",
      "state_holidays",
      "contribution_types",
      "chat_sectors",
      "chat_settings",
      "chat_working_hours",
      "chat_quick_responses",
    ];

    const data: Record<string, unknown[]> = {};
    const recordCounts: Record<string, number> = {};
    const errors: string[] = [];

    // Fetch all data
    for (const table of tablesToExport) {
      try {
        // For carousel_banners, only get global ones (without clinic_id)
        let query = supabaseAdmin.from(table).select("*");
        
        if (table === "carousel_banners") {
          query = query.is("clinic_id", null);
        }
        
        // For contribution_types, skip as they are clinic-specific
        if (table === "contribution_types") {
          // Get contribution types that have no clinic or are templates
          query = supabaseAdmin.from(table).select("*").limit(0);
        }

        const { data: tableData, error: tableError } = await query;

        if (tableError) {
          console.error(`Error fetching ${table}:`, tableError);
          errors.push(`${table}: ${tableError.message}`);
          data[table] = [];
          recordCounts[table] = 0;
        } else {
          data[table] = tableData || [];
          recordCounts[table] = tableData?.length || 0;
          console.log(`Exported ${table}: ${recordCounts[table]} records`);
        }
      } catch (e) {
        console.error(`Exception fetching ${table}:`, e);
        errors.push(`${table}: Table may not exist`);
        data[table] = [];
        recordCounts[table] = 0;
      }
    }

    // Calculate totals
    const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);

    // Build the backup JSON structure
    const backup = {
      version: "2.0",
      type: "super_admin_config",
      generated_at: new Date().toISOString(),
      generated_by: user.email,
      
      import_instructions: {
        description: "Este arquivo contém as configurações globais do sistema. Use estas instruções para importar em outro projeto.",
        order: [
          "subscription_plans",
          "system_features",
          "plan_features",
          "subscription_addons",
          "permission_definitions",
          "feature_permissions",
          "hero_settings",
          "carousel_banners",
          "global_config",
          "national_holidays",
          "state_holidays",
          "chat_sectors",
          "chat_settings",
          "chat_working_hours",
          "chat_quick_responses",
        ],
        notes: [
          "IMPORTANTE: Importar na ordem especificada para respeitar foreign keys",
          "UUIDs são preservados - a IA deve usar UPSERT com onConflict: 'id'",
          "global_config contém credenciais sensíveis - revisar/mascarar antes de importar",
          "carousel_banners exportados são apenas os globais (clinic_id = null)",
          "Após importar, executar: supabase.rpc('refresh_materialized_views') se existir",
        ],
        conflict_strategy: "upsert_by_id",
        example_import_code: `
// Código de exemplo para a IA usar na importação
const backupData = JSON.parse(fileContents);

for (const tableName of backupData.import_instructions.order) {
  const tableData = backupData.data[tableName];
  if (tableData && tableData.length > 0) {
    const { error } = await supabase
      .from(tableName)
      .upsert(tableData, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(\`Erro ao importar \${tableName}:\`, error);
    } else {
      console.log(\`Importado \${tableName}: \${tableData.length} registros\`);
    }
  }
}
        `.trim(),
      },
      
      schema_hints: {
        subscription_plans: {
          primary_key: "id",
          unique_constraints: ["slug"],
          notes: "Planos de assinatura (Basic, Trial, Pro, Master, Enterprise)",
        },
        system_features: {
          primary_key: "id",
          unique_constraints: ["feature_key"],
          notes: "Recursos do sistema organizados por categoria",
        },
        plan_features: {
          primary_key: "id",
          foreign_keys: ["plan_id -> subscription_plans.id", "feature_id -> system_features.id"],
          notes: "Vínculo N:N entre planos e features",
        },
        subscription_addons: {
          primary_key: "id",
          unique_constraints: ["addon_key"],
          notes: "Add-ons opcionais (WhatsApp Avançado, API, Telemedicina)",
        },
        permission_definitions: {
          primary_key: "id",
          unique_constraints: ["permission_key"],
          notes: "Definições de permissões do sistema por categoria",
        },
        feature_permissions: {
          primary_key: "id",
          foreign_keys: ["feature_id -> system_features.id", "permission_id -> permission_definitions.id"],
          notes: "Vínculo N:N entre features e permissions",
        },
        hero_settings: {
          primary_key: "id",
          notes: "Configurações da hero section da landing page",
        },
        carousel_banners: {
          primary_key: "id",
          notes: "Banners do carrossel (apenas globais, sem clinic_id)",
        },
        global_config: {
          primary_key: "id",
          notes: "ATENÇÃO: Contém API keys sensíveis - mascarar antes de compartilhar",
          sensitive_fields: ["evolution_api_key", "openai_api_key", "smtp_password"],
        },
        national_holidays: {
          primary_key: "id",
          notes: "Feriados nacionais do Brasil",
        },
        state_holidays: {
          primary_key: "id",
          notes: "Feriados estaduais",
        },
      },
      
      data,
      
      metadata: {
        record_counts: recordCounts,
        total_records: totalRecords,
        tables_exported: tablesToExport.length,
        export_errors: errors.length > 0 ? errors : undefined,
      },
    };

    // Return as downloadable JSON
    const jsonString = JSON.stringify(backup, null, 2);
    const filename = `super_admin_config_${new Date().toISOString().split('T')[0]}.json`;

    return new Response(jsonString, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("Super admin backup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
