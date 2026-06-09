import { createClient } from "npm:@supabase/supabase-js@2";
import { blockedByOptOut } from "../_shared/opt-out.ts";

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
    const { phone, clinicId, contributionIds } = await req.json();

    if (!phone || !clinicId || !contributionIds?.length) {
      return new Response(JSON.stringify({ error: "phone, clinicId, contributionIds required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Meta WhatsApp compliance: bloqueia disparo em massa se contato optou-out.
    if (await blockedByOptOut({
      clinicId,
      phone,
      sourceFunction: "batch-send-boleto-whatsapp",
    })) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Contato com opt-out ativo (PARAR). Boletos não enviados via WhatsApp.",
          blocked_by: "opt_out",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar contribuições com dados
    const { data: contributions, error } = await supabase
      .from("employer_contributions")
      .select(`
        id, value, due_date, competence_month, competence_year, lytex_invoice_url,
        employer:employers!employer_contributions_employer_id_fkey(name, trade_name, cnpj),
        contribution_type:contribution_types!employer_contributions_contribution_type_id_fkey(name)
      `)
      .in("id", contributionIds);

    if (error || !contributions?.length) {
      return new Response(JSON.stringify({ error: "Contribuições não encontradas" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const contrib of contributions) {
      const employer = contrib.employer as any;
      const contribType = contrib.contribution_type as any;
      const valueBRL = (contrib.value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const companyName = employer?.trade_name || employer?.name || "Empresa";
      const cnpjFormatted = (employer?.cnpj || "").replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
      );
      const competence = `${String(contrib.competence_month).padStart(2, "0")}/${contrib.competence_year}`;
      const dueDate = new Date(contrib.due_date + "T12:00:00");
      const dueDateFormatted = dueDate.toLocaleDateString("pt-BR");

      const message = `📋 *Boleto - ${contribType?.name || "Contribuição"}*\n\n` +
        `🏢 *Empresa:* ${companyName}\n` +
        `📄 *CNPJ:* ${cnpjFormatted}\n` +
        `📅 *Competência:* ${competence}\n` +
        `💰 *Valor:* R$ ${valueBRL}\n` +
        `📆 *Vencimento:* ${dueDateFormatted}\n\n` +
        `🔗 *Link do boleto:*\n${contrib.lytex_invoice_url || "Não disponível"}\n\n` +
        `_SECMI - Sindicato dos Empregados no Comércio_`;

      try {
        const templateComponents = [
          companyName,
          competence,
          valueBRL,
          dueDateFormatted,
          contrib.lytex_invoice_url || "N/A"
        ];

        const { data: sendResult, error: sendError } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone,
            message,
            clinicId,
            type: "custom",
            templateName: "boleto_mensalidade",
            templateComponents: templateComponents
          },
        });

        if (sendError) {
          console.error(`[Batch-WA] Erro ao enviar para ${companyName}:`, sendError);
          results.push({ id: contrib.id, company: companyName, success: false, error: sendError.message });
        } else {
          console.log(`[Batch-WA] Enviado: ${companyName} - R$ ${valueBRL}`);
          results.push({ id: contrib.id, company: companyName, success: true });
        }

        // Delay de 2s entre mensagens para não ser bloqueado
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        results.push({ id: contrib.id, company: companyName, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
