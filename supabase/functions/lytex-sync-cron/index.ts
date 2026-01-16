import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Esta função é chamada por um cron job para sincronizar e conciliar boletos pagos da Lytex
// Configurar no supabase/config.toml com schedule

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("[Lytex Sync Cron] Iniciando sincronização automática de boletos pagos...");

    // Buscar todas as clínicas que têm credenciais Lytex configuradas
    // Por enquanto, sincronizar todas as clínicas que têm contribuições com boleto Lytex
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

    const results: Array<{
      clinicId: string;
      success: boolean;
      conciliated?: number;
      alreadyConciliated?: number;
      ignored?: number;
      errors?: number;
      error?: string;
    }> = [];

    for (const clinicId of clinicIds) {
      try {
        console.log(`[Lytex Sync Cron] Sincronizando clínica: ${clinicId}`);

        // 1. Buscar e conciliar boletos pagos na Lytex
        // Processa TODAS as contribuições pendentes para garantir conciliação completa
        // CORREÇÃO: Remover filtro daysBack para processar TODO o histórico pendente
        // Muitas contribuições antigas (>180 dias) estavam sendo ignoradas
        const { data: fetchResult, error: fetchError } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "fetch_paid_invoices",
            clinicId,
            mode: "automatic", // Marca como execução automática no log
            daysBack: null, // Processar TODAS as contribuições pendentes (sem limite de data)
            onlyPending: true, // Apenas contribuições que ainda não estão pagas
          },
        });

        if (fetchError) {
          console.error(`[Lytex Sync Cron] Erro ao buscar pagos na clínica ${clinicId}:`, fetchError);
          results.push({ 
            clinicId, 
            success: false, 
            error: fetchError.message 
          });
          continue;
        }

        console.log(`[Lytex Sync Cron] Clínica ${clinicId} conciliada:`, {
          conciliated: fetchResult?.conciliated || 0,
          alreadyConciliated: fetchResult?.alreadyConciliated || 0,
          pendingInLytex: fetchResult?.pendingInLytex || 0,
          errors: fetchResult?.errors || 0,
        });

        // 2. Depois, atualizar status das contribuições pendentes (sync_all_pending original)
        const { data: syncResult, error: syncError } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "sync_all_pending",
            clinicId,
          },
        });

        if (syncError) {
          console.error(`[Lytex Sync Cron] Erro no sync_all_pending da clínica ${clinicId}:`, syncError);
        }

        results.push({ 
          clinicId, 
          success: true, 
          conciliated: fetchResult?.conciliated || 0,
          alreadyConciliated: fetchResult?.alreadyConciliated || 0,
          ignored: fetchResult?.ignored || 0,
          errors: fetchResult?.errors || 0,
          ...(syncResult || {}),
        });

      } catch (clinicError: any) {
        console.error(`[Lytex Sync Cron] Erro na clínica ${clinicId}:`, clinicError);
        results.push({ clinicId, success: false, error: clinicError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalConciliated = results.reduce((sum, r) => sum + (r.conciliated || 0), 0);
    
    console.log(`[Lytex Sync Cron] Sincronização concluída: ${successCount}/${clinicIds.length} clínicas, ${totalConciliated} boletos conciliados`);

    return new Response(JSON.stringify({ 
      success: true, 
      totalClinics: clinicIds.length,
      successCount,
      totalConciliated,
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