import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { contribution_id, value, portal_type, portal_id } = body || {};

    if (!contribution_id || value === undefined || value === null) {
      return new Response(
        JSON.stringify({ error: "contribution_id e value são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const valueInCents = Math.round(Number(value));
    if (isNaN(valueInCents) || valueInCents <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor deve ser maior que zero" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: contribution, error: contribError } = await supabase
      .from("employer_contributions")
      .select(`
        *,
        employer:employers(id, name, cnpj, email, phone, clinic_id),
        contribution_type:contribution_types(name)
      `)
      .eq("id", contribution_id)
      .single();

    if (contribError || !contribution) {
      return new Response(
        JSON.stringify({ error: "Contribuição não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Regra 1: somente boletos pendentes (já emitidos) podem ter valor alterado
    if (contribution.status !== "pending") {
      return new Response(
        JSON.stringify({
          error:
            "Somente boletos pendentes (a vencer) podem ter o valor alterado.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Regra 2: nao permite alterar boletos vencidos
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = String(contribution.due_date).slice(0, 10).split("-").map(Number);
    const dueDate = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    if (dueDate < today) {
      return new Response(
        JSON.stringify({
          error:
            "Este boleto já está vencido. A alteração de valor só é permitida para boletos a vencer.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validacao de permissao por portal e limite de 1 alteracao
    const isPortal = portal_type === "employer" || portal_type === "accounting_office";

    if (isPortal) {
      if (!portal_id) {
        return new Response(
          JSON.stringify({ error: "portal_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (portal_type === "employer") {
        if (contribution.employer_id !== portal_id) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para acessar esta contribuição" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        const { data: link } = await supabase
          .from("accounting_office_employers")
          .select("id")
          .eq("accounting_office_id", portal_id)
          .eq("employer_id", contribution.employer_id)
          .maybeSingle();
        if (!link) {
          return new Response(
            JSON.stringify({ error: "Você não tem permissão para acessar esta contribuição" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Regra 3: somente 1 alteracao via portal; depois disso somente o gestor
      const currentCount = contribution.portal_value_change_count || 0;
      if (currentCount >= 1) {
        return new Response(
          JSON.stringify({
            error:
              "Este boleto já foi alterado uma vez pelo portal. Para novas alterações, entre em contato com o gestor do sindicato.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const monthNames = [
      "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
    ];
    const typeName = contribution.contribution_type?.name || "Contribuição";
    const description = `${typeName} - ${monthNames[contribution.competence_month - 1]}/${contribution.competence_year}`;
    const dueDateStr = String(contribution.due_date).slice(0, 10);

    // Atualizar valor na Lytex via lytex-api (mantém mesmo invoice_id)
    let lytexUpdated = false;
    let lytexError: string | null = null;

    if (contribution.lytex_invoice_id) {
      try {
        const { data: lytexResp, error: invokeErr } = await supabase.functions.invoke(
          "lytex-api",
          {
            body: {
              action: "update_invoice",
              invoiceId: contribution.lytex_invoice_id,
              contributionId: contribution.id,
              value: valueInCents,
              dueDate: dueDateStr,
              description,
            },
          },
        );

        if (invokeErr) {
          lytexError = invokeErr.message || "Falha ao invocar lytex-api";
          console.error("[ChangeValue] Erro ao invocar lytex-api:", invokeErr);
        } else if (lytexResp?.lytexUpdated === false) {
          lytexError = lytexResp?.lytexError || "Lytex recusou a atualização";
          console.warn("[ChangeValue] Lytex não atualizado:", lytexError);
        } else {
          lytexUpdated = true;
        }
      } catch (e: any) {
        lytexError = e?.message || "Erro inesperado ao atualizar Lytex";
        console.error("[ChangeValue] Exceção ao atualizar Lytex:", e);
      }

      // Se Lytex falhou, abortar para não deixar boleto fora de sincronia
      if (!lytexUpdated) {
        return new Response(
          JSON.stringify({
            error: `Não foi possível atualizar o boleto na Lytex: ${lytexError}. Nenhuma alteração foi aplicada.`,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // Sem boleto Lytex vinculado: atualiza apenas valor no banco
      const { error: vErr } = await supabase
        .from("employer_contributions")
        .update({ value: valueInCents })
        .eq("id", contribution_id);
      if (vErr) {
        return new Response(
          JSON.stringify({ error: "Erro ao salvar novo valor" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const newCount = isPortal
      ? (contribution.portal_value_change_count || 0) + 1
      : (contribution.portal_value_change_count || 0);

    const oldValue = contribution.value;
    const oldNotes = contribution.notes || "";
    const changeNote = `Valor alterado em ${new Date().toLocaleDateString("pt-BR")} de R$ ${(oldValue / 100).toFixed(2)} para R$ ${(valueInCents / 100).toFixed(2)}${isPortal ? ` (portal ${portal_type})` : " (gestor)"}.`;

    // Atualizar contador e notas (lytex-api já atualizou value no banco)
    const { error: updateError } = await supabase
      .from("employer_contributions")
      .update({
        portal_value_change_count: newCount,
        notes: oldNotes ? `${oldNotes}\n${changeNote}` : changeNote,
      })
      .eq("id", contribution_id);

    if (updateError) {
      console.error("[ChangeValue] Erro ao atualizar metadados:", updateError);
    }

    // Log de portal
    if (isPortal && portal_id) {
      const logTable = portal_type === "accounting_office"
        ? "accounting_office_portal_logs"
        : "employer_portal_logs";
      const logData = portal_type === "accounting_office"
        ? { accounting_office_id: portal_id, action: "change_value" }
        : { employer_id: portal_id, action: "change_value" };

      try {
        await supabase.from(logTable).insert({
          ...logData,
          ip_address: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: {
            contribution_id,
            old_value: oldValue,
            new_value: valueInCents,
            new_change_count: newCount,
          },
        });
      } catch (e) {
        console.error("[ChangeValue] warn log insert failed:", e);
      }
    }

    // Buscar URL atualizada do boleto
    const { data: refreshed } = await supabase
      .from("employer_contributions")
      .select("lytex_invoice_url")
      .eq("id", contribution_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Valor do boleto atualizado com sucesso na Lytex!",
        lytex_invoice_url: refreshed?.lytex_invoice_url || contribution.lytex_invoice_url || null,
        lytex_updated: lytexUpdated,
        portal_value_change_count: newCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[ChangeValue] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});