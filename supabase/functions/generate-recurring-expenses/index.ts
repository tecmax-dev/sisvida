import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { clinic_id, items } = await req.json();
    // items: Array<{ check_number: string, frequency: 'monthly' | 'weekly' | 'biweekly', biweekly_days?: [number, number] }>

    if (!clinic_id || !items || !items.length) {
      throw new Error("clinic_id and items are required");
    }

    let totalGenerated = 0;

    for (const item of items) {
      const { check_number, frequency, biweekly_days } = item;

      // Find existing expense by check_number
      const { data: sources, error: srcErr } = await supabase
        .from("union_financial_transactions")
        .select("*")
        .eq("clinic_id", clinic_id)
        .eq("check_number", check_number)
        .eq("type", "expense")
        .order("created_at", { ascending: false })
        .limit(1);

      if (srcErr) throw srcErr;
      if (!sources || sources.length === 0) {
        console.warn(`Check ${check_number} not found, skipping`);
        continue;
      }

      const source = sources[0];
      const startDate = new Date(source.due_date || source.created_at);
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 3);

      const futureDates = generateDates(startDate, endDate, frequency, biweekly_days);

      const newRecords = futureDates.map((d) => ({
        clinic_id: source.clinic_id,
        type: source.type,
        description: source.description,
        amount: source.amount,
        net_value: source.net_value,
        discount_value: source.discount_value,
        interest_value: source.interest_value,
        due_date: formatDate(d),
        category_id: source.category_id,
        supplier_id: source.supplier_id,
        cash_register_id: source.cash_register_id,
        cost_center_id: source.cost_center_id,
        payment_method: source.payment_method,
        check_number: null, // Empty — will be filled on reconciliation
        document_number: source.document_number,
        notes: source.notes,
        status: "pending",
        created_by: source.created_by,
        recurrence_type: frequency,
        recurrence_source_id: source.id,
      }));

      // Insert in batches of 100
      for (let i = 0; i < newRecords.length; i += 100) {
        const batch = newRecords.slice(i, i + 100);
        const { error: insErr } = await supabase
          .from("union_financial_transactions")
          .insert(batch);
        if (insErr) throw insErr;
      }

      // Mark original with recurrence_type too
      await supabase
        .from("union_financial_transactions")
        .update({ recurrence_type: frequency })
        .eq("id", source.id);

      totalGenerated += newRecords.length;
      console.log(`Check ${check_number}: generated ${newRecords.length} recurring entries (${frequency})`);
    }

    return new Response(
      JSON.stringify({ success: true, total_generated: totalGenerated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateDates(
  start: Date,
  end: Date,
  frequency: string,
  biweeklyDays?: number[]
): Date[] {
  const dates: Date[] = [];
  
  if (frequency === "monthly") {
    // Same day each month, starting from next month
    const d = new Date(start);
    d.setMonth(d.getMonth() + 1);
    while (d <= end) {
      dates.push(new Date(d));
      d.setMonth(d.getMonth() + 1);
    }
  } else if (frequency === "weekly") {
    // Every week (same day of week), starting from next week
    const d = new Date(start);
    d.setDate(d.getDate() + 7);
    while (d <= end) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }
  } else if (frequency === "biweekly") {
    // Two specific days per month
    const days = biweeklyDays || [15, 30];
    const d = new Date(start);
    d.setMonth(d.getMonth() + 1); // Start from next month
    d.setDate(1);
    
    while (d <= end) {
      const year = d.getFullYear();
      const month = d.getMonth();
      
      for (const day of days) {
        // Handle months with fewer days (e.g., Feb doesn't have 30)
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const actualDay = Math.min(day, lastDayOfMonth);
        const date = new Date(year, month, actualDay);
        if (date <= end && date > start) {
          dates.push(date);
        }
      }
      
      d.setMonth(d.getMonth() + 1);
    }
  }

  return dates;
}
