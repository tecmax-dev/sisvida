import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { contributionIds } = await req.json();
    
    if (!contributionIds || !Array.isArray(contributionIds) || contributionIds.length === 0) {
      return new Response(JSON.stringify({ error: "contributionIds array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Batch] Processando ${contributionIds.length} contribuições`);

    const results: any[] = [];

    for (const contribId of contributionIds) {
      try {
        // Buscar dados da contribuição
        const { data: contrib, error: contribError } = await supabase
          .from("employer_contributions")
          .select(`
            id, value, due_date, competence_month, competence_year,
            lytex_invoice_id,
            employer:employers!employer_contributions_employer_id_fkey(name, cnpj, registration_number),
            contribution_type:contribution_types!employer_contributions_contribution_type_id_fkey(name)
          `)
          .eq("id", contribId)
          .single();

        if (contribError || !contrib) {
          results.push({ id: contribId, success: false, error: "Contribuição não encontrada" });
          continue;
        }

        if (contrib.lytex_invoice_id) {
          results.push({ id: contribId, success: true, skipped: true, message: "Já possui boleto" });
          continue;
        }

        const employer = contrib.employer as any;
        const contribType = contrib.contribution_type as any;

        // Chamar lytex-api internamente
        const { data: invoiceResult, error: invokeError } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "create_invoice",
            contributionId: contrib.id,
            value: contrib.value,
            dueDate: contrib.due_date,
            description: `${contribType?.name || "Contribuição"} - ${String(contrib.competence_month).padStart(2, "0")}/${contrib.competence_year}`,
            enableBoleto: true,
            enablePix: true,
            employer: {
              cnpj: employer?.cnpj,
              name: employer?.name,
            },
          },
        });

        if (invokeError) {
          console.error(`[Batch] Erro contrib ${contribId}:`, invokeError);
          results.push({ id: contribId, success: false, error: invokeError.message });
        } else {
          console.log(`[Batch] Boleto gerado para ${contribId}: ${JSON.stringify(invoiceResult).substring(0, 200)}`);
          results.push({ id: contribId, success: true, invoiceUrl: invoiceResult?.invoiceUrl });
        }
      } catch (err: any) {
        console.error(`[Batch] Exceção contrib ${contribId}:`, err);
        results.push({ id: contribId, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Batch] Erro geral:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
