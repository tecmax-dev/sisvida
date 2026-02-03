import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FilterPayload {
  clinic_id: string;
  start_date: string; // ISO string
  end_date: string; // ISO string
  date_filter_type: "competence" | "due_date" | "paid_at";
  status: string;
  employer_id?: string | null;
  contribution_type_id?: string | null;
  origin_filter?: string | null;
}

interface AuditLog {
  received_at: string;
  payload: FilterPayload;
  query_description: string;
  filters_applied: string[];
  row_count: number;
  execution_time_ms: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: FilterPayload = await req.json();
    console.log("=== FILTER CONTRIBUTIONS REQUEST ===");
    console.log("Received payload:", JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.clinic_id || !payload.start_date || !payload.end_date) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: clinic_id, start_date, end_date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Build query step by step, tracking filters
    const filtersApplied: string[] = [];
    let queryDescription = "SELECT * FROM employer_contributions";
    const queryConditions: string[] = [];

    // Base query with joins
    let query = supabase
      .from("employer_contributions")
      .select(`
        *,
        employers:employers!employer_contributions_employer_id_fkey (
          id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number
        ),
        contribution_types:contribution_types!employer_contributions_contribution_type_id_fkey (
          id, name, description, default_value, is_active
        )
      `)
      .eq("clinic_id", payload.clinic_id);
    
    filtersApplied.push(`clinic_id = '${payload.clinic_id}'`);
    queryConditions.push(`clinic_id = '${payload.clinic_id}'`);

    // Parse dates
    const startDate = new Date(payload.start_date);
    const endDate = new Date(payload.end_date);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Apply date filter based on type
    if (payload.date_filter_type === "competence") {
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;

      // Filter by competence year/month range
      query = query
        .or(`and(competence_year.gt.${startYear}),and(competence_year.eq.${startYear},competence_month.gte.${startMonth})`)
        .or(`and(competence_year.lt.${endYear}),and(competence_year.eq.${endYear},competence_month.lte.${endMonth})`);
      
      // Simpler approach: fetch all and let client filter, but log what we intended
      // Actually, let's use gte/lte on a computed approach
      query = supabase
        .from("employer_contributions")
        .select(`
          *,
          employers:employers!employer_contributions_employer_id_fkey (
            id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number
          ),
          contribution_types:contribution_types!employer_contributions_contribution_type_id_fkey (
            id, name, description, default_value, is_active
          )
        `)
        .eq("clinic_id", payload.clinic_id)
        .gte("competence_year", startYear)
        .lte("competence_year", endYear);

      filtersApplied.push(`date_filter_type = 'competence'`);
      filtersApplied.push(`competence_year >= ${startYear} AND competence_year <= ${endYear}`);
      queryConditions.push(`competence_year >= ${startYear} AND competence_year <= ${endYear}`);
      queryConditions.push(`(competence_month filtered in application for precise range)`);

    } else if (payload.date_filter_type === "due_date") {
      const startStr = payload.start_date.split("T")[0];
      const endStr = payload.end_date.split("T")[0];
      query = query.gte("due_date", startStr).lte("due_date", endStr);
      
      filtersApplied.push(`date_filter_type = 'due_date'`);
      filtersApplied.push(`due_date >= '${startStr}' AND due_date <= '${endStr}'`);
      queryConditions.push(`due_date >= '${startStr}' AND due_date <= '${endStr}'`);

    } else if (payload.date_filter_type === "paid_at") {
      query = query.not("paid_at", "is", null);
      query = query.gte("paid_at", startDate.toISOString()).lte("paid_at", endDate.toISOString());
      
      filtersApplied.push(`date_filter_type = 'paid_at'`);
      filtersApplied.push(`paid_at IS NOT NULL`);
      filtersApplied.push(`paid_at >= '${startDate.toISOString()}' AND paid_at <= '${endDate.toISOString()}'`);
      queryConditions.push(`paid_at IS NOT NULL AND paid_at BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`);
    }

    // Status filter
    if (payload.status && payload.status !== "all") {
      if (payload.status === "hide_cancelled") {
        query = query.neq("status", "cancelled");
        filtersApplied.push(`status != 'cancelled'`);
        queryConditions.push(`status != 'cancelled'`);
      } else if (payload.status === "pending") {
        query = query.in("status", ["pending", "awaiting_value"]);
        filtersApplied.push(`status IN ('pending', 'awaiting_value')`);
        queryConditions.push(`status IN ('pending', 'awaiting_value')`);
      } else {
        query = query.eq("status", payload.status);
        filtersApplied.push(`status = '${payload.status}'`);
        queryConditions.push(`status = '${payload.status}'`);
      }
    }

    // Employer filter
    if (payload.employer_id) {
      query = query.eq("employer_id", payload.employer_id);
      filtersApplied.push(`employer_id = '${payload.employer_id}'`);
      queryConditions.push(`employer_id = '${payload.employer_id}'`);
    }

    // Contribution type filter
    if (payload.contribution_type_id && payload.contribution_type_id !== "all") {
      query = query.eq("contribution_type_id", payload.contribution_type_id);
      filtersApplied.push(`contribution_type_id = '${payload.contribution_type_id}'`);
      queryConditions.push(`contribution_type_id = '${payload.contribution_type_id}'`);
    }

    // Origin filter
    if (payload.origin_filter && payload.origin_filter !== "all") {
      query = query.eq("origin", payload.origin_filter);
      filtersApplied.push(`origin = '${payload.origin_filter}'`);
      queryConditions.push(`origin = '${payload.origin_filter}'`);
    }

    // Order and execute
    query = query
      .order("competence_year", { ascending: false })
      .order("competence_month", { ascending: false })
      .order("created_at", { ascending: false });

    // Build final query description
    queryDescription = `SELECT *, employers.*, contribution_types.* FROM employer_contributions WHERE ${queryConditions.join(" AND ")} ORDER BY competence_year DESC, competence_month DESC, created_at DESC`;

    console.log("=== QUERY DESCRIPTION ===");
    console.log(queryDescription);
    console.log("=== FILTERS APPLIED ===");
    console.log(filtersApplied);

    // Execute query with pagination to bypass 1000 limit
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Query error:", error);
        return new Response(
          JSON.stringify({ 
            error: error.message,
            audit: {
              received_at: new Date().toISOString(),
              payload,
              query_description: queryDescription,
              filters_applied: filtersApplied,
              error: error.message,
            }
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    // Post-filter for competence month if using competence date filter
    if (payload.date_filter_type === "competence") {
      const startMonth = startDate.getMonth() + 1;
      const endMonth = endDate.getMonth() + 1;
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      allData = allData.filter((c) => {
        const cDate = new Date(c.competence_year, c.competence_month - 1, 1);
        return cDate >= startDate && cDate <= endDate;
      });

      filtersApplied.push(`(post-filter) competence date between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    }

    const executionTime = Date.now() - startTime;

    // Build audit log
    const audit: AuditLog = {
      received_at: new Date().toISOString(),
      payload,
      query_description: queryDescription,
      filters_applied: filtersApplied,
      row_count: allData.length,
      execution_time_ms: executionTime,
    };

    console.log("=== AUDIT LOG ===");
    console.log(JSON.stringify(audit, null, 2));

    return new Response(
      JSON.stringify({
        data: allData,
        audit,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
