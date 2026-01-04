import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Esta função é chamada por um cron job para sincronizar dados da Lytex
// Configurar no supabase/config.toml com schedule

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("[Lytex Sync Cron] Iniciando sincronização automática...");

    // Buscar todas as clínicas que têm credenciais Lytex configuradas
    // Por enquanto, sincronizar todas as clínicas que têm contribuições
    const { data: clinicsWithContributions, error: clinicsError } = await supabase
      .from("employer_contributions")
      .select("clinic_id")
      .not("lytex_invoice_id", "is", null);

    if (clinicsError) {
      throw new Error(`Erro ao buscar clínicas: ${clinicsError.message}`);
    }

    // Obter IDs únicos de clínicas
    const clinicIds = [...new Set(clinicsWithContributions?.map(c => c.clinic_id) || [])];
    console.log(`[Lytex Sync Cron] Encontradas ${clinicIds.length} clínicas para sincronizar`);

    const results: any[] = [];

    for (const clinicId of clinicIds) {
      try {
        console.log(`[Lytex Sync Cron] Sincronizando clínica: ${clinicId}`);

        // Chamar a função lytex-api com action import_from_lytex
        const { data, error } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "import_from_lytex",
            clinicId,
          },
        });

        if (error) {
          console.error(`[Lytex Sync Cron] Erro na clínica ${clinicId}:`, error);
          results.push({ clinicId, success: false, error: error.message });
        } else {
          console.log(`[Lytex Sync Cron] Clínica ${clinicId} sincronizada:`, data);
          results.push({ clinicId, success: true, ...data });
        }
      } catch (clinicError: any) {
        console.error(`[Lytex Sync Cron] Erro na clínica ${clinicId}:`, clinicError);
        results.push({ clinicId, success: false, error: clinicError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Lytex Sync Cron] Sincronização concluída: ${successCount}/${clinicIds.length} clínicas`);

    return new Response(JSON.stringify({ 
      success: true, 
      totalClinics: clinicIds.length,
      successCount,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Lytex Sync Cron] Erro:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
