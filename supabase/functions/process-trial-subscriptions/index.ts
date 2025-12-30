import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    console.log(`[process-trial-subscriptions] Running at ${today.toISOString()}`);

    // Find trial subscriptions where trial has ended
    const { data: expiredTrials, error: fetchError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        clinic_id,
        plan_id,
        trial_ends_at,
        current_period_end,
        clinics!inner (
          id,
          name
        ),
        subscription_plans!inner (
          id,
          name,
          monthly_price
        )
      `)
      .eq('status', 'trial')
      .lte('trial_ends_at', today.toISOString());

    if (fetchError) {
      console.error('[process-trial-subscriptions] Error fetching trials:', fetchError);
      throw fetchError;
    }

    console.log(`[process-trial-subscriptions] Found ${expiredTrials?.length || 0} expired trials`);

    if (!expiredTrials || expiredTrials.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum trial expirado encontrado',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { clinic_name: string; success: boolean; error?: string }[] = [];

    for (const subscription of expiredTrials) {
      const clinic = subscription.clinics as any;
      const plan = subscription.subscription_plans as any;

      try {
        console.log(`[process-trial-subscriptions] Processing clinic: ${clinic.name}`);

        // Calculate new period end (30 days from now)
        const newPeriodEnd = new Date();
        newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

        // Transition from trial to active
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_end: newPeriodEnd.toISOString(),
          })
          .eq('id', subscription.id);

        if (updateError) {
          console.error(`[process-trial-subscriptions] Error updating ${clinic.name}:`, updateError);
          results.push({ clinic_name: clinic.name, success: false, error: updateError.message });
          continue;
        }

        console.log(`[process-trial-subscriptions] Trial ended for ${clinic.name} - now active until ${newPeriodEnd.toISOString()}`);
        results.push({ clinic_name: clinic.name, success: true });

      } catch (clinicError) {
        console.error(`[process-trial-subscriptions] Error processing ${clinic.name}:`, clinicError);
        results.push({ 
          clinic_name: clinic.name, 
          success: false, 
          error: clinicError instanceof Error ? clinicError.message : 'Erro desconhecido' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[process-trial-subscriptions] Completed: ${successCount} activated, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processado: ${successCount} ativados, ${failedCount} com erro`,
        processed: expiredTrials.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-trial-subscriptions] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
