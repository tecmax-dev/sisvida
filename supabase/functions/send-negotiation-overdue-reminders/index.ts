import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SYSTEM_LOGO = "https://prosindweb.com.br/prosindweb-whatsapp-header.jpg";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Use Brazil timezone (UTC-3) for date calculations
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3 in minutes
  const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
  const today = `${brazilTime.getFullYear()}-${String(brazilTime.getMonth() + 1).padStart(2, "0")}-${String(brazilTime.getDate()).padStart(2, "0")}`;
  const startOfDay = `${today}T00:00:00-03:00`;

  try {
    // 1. Find overdue installments from active negotiations
    const { data: overdueInstallments, error: fetchError } = await supabase
      .from("negotiation_installments")
      .select(`
        id, installment_number, value, due_date, status, lytex_invoice_url,
        negotiation:debt_negotiations!inner (
          id, negotiation_code, status, clinic_id, employer_id, installments_count, total_negotiated_value,
          employers!inner ( id, name, cnpj, phone )
        )
      `)
      .in("status", ["pending", "overdue"])
      .lt("due_date", today)
      .eq("negotiation.status", "approved");

    if (fetchError) {
      console.error("[overdue-reminders] Error fetching installments:", fetchError);
      return new Response(JSON.stringify({ success: false, error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!overdueInstallments || overdueInstallments.length === 0) {
      console.log("[overdue-reminders] No overdue installments found");
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Nenhuma parcela vencida encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[overdue-reminders] Found ${overdueInstallments.length} overdue installments`);

    // 2. Filter out installments already notified today
    const installmentIds = overdueInstallments.map((i: any) => i.id);
    const { data: alreadySent } = await supabase
      .from("negotiation_installment_notifications")
      .select("installment_id")
      .in("installment_id", installmentIds)
      .gte("sent_at", startOfDay)
      .eq("success", true);

    const alreadySentIds = new Set((alreadySent || []).map((n: any) => n.installment_id));

    // 3. Group overdue installments by employer (to send one consolidated message)
    const groupedByEmployer: Record<string, any[]> = {};
    for (const inst of overdueInstallments as any[]) {
      if (alreadySentIds.has(inst.id)) continue;

      const neg = inst.negotiation;
      const employer = neg?.employers;
      if (!employer?.phone) continue;

      const key = `${neg.clinic_id}::${employer.id}`;
      if (!groupedByEmployer[key]) groupedByEmployer[key] = [];
      groupedByEmployer[key].push(inst);
    }

    let totalSent = 0;
    let totalFailed = 0;

    // 4. For each employer group, build and send message
    for (const [key, installments] of Object.entries(groupedByEmployer)) {
      const [clinicId] = key.split("::");
      const neg = (installments[0] as any).negotiation;
      const employer = neg.employers;

      // Get clinic name and union logo
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("name, whatsapp_header_image_url, reminder_interval")
        .eq("id", clinicId)
        .single();

      const { data: unionEntity } = await supabase
        .from("union_entities")
        .select("logo_url")
        .eq("clinic_id", clinicId)
        .eq("status", "ativa")
        .maybeSingle();

      const logoUrl = unionEntity?.logo_url || clinicData?.whatsapp_header_image_url || DEFAULT_SYSTEM_LOGO;
      const clinicName = clinicData?.name || "Entidade Sindical";

      // Build consolidated message
      let message = `⚠️ *PARCELAS EM ATRASO - ACORDO DE NEGOCIAÇÃO*\n\n`;
      message += `🏢 *Empresa:* ${employer.name}\n`;
      message += `📋 *CNPJ:* ${employer.cnpj}\n`;
      message += `🔢 *Acordo:* ${neg.negotiation_code}\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      let totalOverdue = 0;
      for (const inst of installments as any[]) {
        const daysOverdue = Math.floor(
          (new Date(today).getTime() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        message += `📌 *Parcela ${inst.installment_number}/${neg.installments_count}*\n`;
        message += `📅 Vencimento: ${formatDate(inst.due_date)}\n`;
        message += `⏰ Atraso: ${daysOverdue} dia(s)\n`;
        message += `💵 Valor: ${formatCurrency(inst.value)}\n`;
        if (inst.lytex_invoice_url) {
          message += `🔗 Boleto: ${inst.lytex_invoice_url}\n`;
        }
        message += `\n`;
        totalOverdue += inst.value;
      }

      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `💰 *Total em atraso:* ${formatCurrency(totalOverdue)}\n\n`;
      message += `📞 Entre em contato para regularização.\n\n`;
      message += `_${clinicName}_`;

      // Format phone
      let cleanPhone = employer.phone.replace(/\D/g, "");
      if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

      // Send via send-whatsapp central function
      try {
        const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            phone: cleanPhone,
            message,
            clinicId,
            type: "custom",
            imageUrl: logoUrl,
          }),
        });

        const result = await response.json();
        const success = response.ok && result.success;

        if (!success) {
          console.error(`[overdue-reminders] Failed to send to ${cleanPhone}:`, result);
        } else {
          console.log(`[overdue-reminders] Sent to ${cleanPhone} (${installments.length} parcelas)`);
        }

        // Log each installment notification
        for (const inst of installments as any[]) {
          await supabase.from("negotiation_installment_notifications").insert({
            installment_id: inst.id,
            clinic_id: clinicId,
            phone: cleanPhone,
            success,
            error_message: success ? null : JSON.stringify(result).slice(0, 500),
          });
        }

        if (success) {
          totalSent += installments.length;
          // Update installment status to overdue if still pending
          const pendingIds = installments.filter((i: any) => i.status === "pending").map((i: any) => i.id);
          if (pendingIds.length > 0) {
            await supabase
              .from("negotiation_installments")
              .update({ status: "overdue", updated_at: new Date().toISOString() })
              .in("id", pendingIds);
          }
        } else {
          totalFailed += installments.length;
        }
      } catch (sendErr) {
        console.error(`[overdue-reminders] Error sending to ${cleanPhone}:`, sendErr);
        totalFailed += installments.length;
        for (const inst of installments as any[]) {
          await supabase.from("negotiation_installment_notifications").insert({
            installment_id: inst.id,
            clinic_id: clinicId,
            phone: cleanPhone,
            success: false,
            error_message: String(sendErr).slice(0, 500),
          });
        }
      }

      // Use the clinic-specific interval (default 60s if not set)
      const intervalSeconds = clinicData?.reminder_interval || 60;
      console.log(`[Clinic ${clinicData?.name}] Waiting ${intervalSeconds}s before next negotiation reminder...`);
      await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    }

    console.log(`[overdue-reminders] Done. Sent: ${totalSent}, Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[overdue-reminders] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
