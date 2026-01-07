import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function successResponse(data: any, pagination?: any) {
  const body: any = { success: true, data };
  if (pagination) body.pagination = pagination;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API Key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("SOURCE_API_KEY");

    if (!apiKey || apiKey !== expectedKey) {
      console.error("[data-export-api] Invalid or missing API key");
      return errorResponse("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const pathname = url.pathname.replace(/^\/data-export-api\/?/, "").replace(/\/$/, "");
    const clinicId = url.searchParams.get("clinic_id");

    if (!clinicId) {
      return errorResponse("clinic_id query parameter is required", 400);
    }

    console.log(`[data-export-api] Request: ${pathname} for clinic ${clinicId}`);

    // Pagination helper
    const getPage = () => parseInt(url.searchParams.get("page") || "1", 10);
    const getLimit = () => Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 1000);

    switch (pathname) {
      case "procedures": {
        const { data, error } = await supabase
          .from("procedures")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("name");
        if (error) throw error;
        return successResponse(data);
      }

      case "insurance_plans": {
        const { data, error } = await supabase
          .from("insurance_plans")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("name");
        if (error) throw error;
        return successResponse(data);
      }

      case "specialties": {
        const { data, error } = await supabase
          .from("specialties")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("name");
        if (error) throw error;
        return successResponse(data);
      }

      case "financial_categories": {
        const { data, error } = await supabase
          .from("financial_categories")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("name");
        if (error) throw error;
        return successResponse(data);
      }

      case "professionals": {
        const { data, error } = await supabase
          .from("professionals")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("name");
        if (error) throw error;
        return successResponse(data);
      }

      case "professional_procedures": {
        const { data, error } = await supabase
          .from("professional_procedures")
          .select("*, professionals!inner(clinic_id)")
          .eq("professionals.clinic_id", clinicId);
        if (error) throw error;
        // Remove nested professionals object
        const cleaned = data?.map(({ professionals, ...rest }) => rest);
        return successResponse(cleaned);
      }

      case "professional_insurance_plans": {
        const { data, error } = await supabase
          .from("professional_insurance_plans")
          .select("*, professionals!inner(clinic_id)")
          .eq("professionals.clinic_id", clinicId);
        if (error) throw error;
        const cleaned = data?.map(({ professionals, ...rest }) => rest);
        return successResponse(cleaned);
      }

      case "professional_schedules": {
        const { data, error } = await supabase
          .from("professional_schedules")
          .select("*, professionals!inner(clinic_id)")
          .eq("professionals.clinic_id", clinicId);
        if (error) throw error;
        const cleaned = data?.map(({ professionals, ...rest }) => rest);
        return successResponse(cleaned);
      }

      case "patients": {
        const page = getPage();
        const limit = getLimit();
        const offset = (page - 1) * limit;

        const { count } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        const { data, error } = await supabase
          .from("patients")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("name")
          .range(offset, offset + limit - 1);
        if (error) throw error;

        return successResponse(data, { page, limit, total: count || 0 });
      }

      case "patient_dependents": {
        const { data, error } = await supabase
          .from("patient_dependents")
          .select("*, patients!inner(clinic_id)")
          .eq("patients.clinic_id", clinicId);
        if (error) throw error;
        const cleaned = data?.map(({ patients, ...rest }) => rest);
        return successResponse(cleaned);
      }

      case "patient_cards": {
        const { data, error } = await supabase
          .from("patient_cards")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return successResponse(data);
      }

      case "appointments": {
        const page = getPage();
        const limit = getLimit();
        const offset = (page - 1) * limit;
        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");

        let countQuery = supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        let query = supabase
          .from("appointments")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("appointment_date", { ascending: false });

        if (startDate) {
          countQuery = countQuery.gte("appointment_date", startDate);
          query = query.gte("appointment_date", startDate);
        }
        if (endDate) {
          countQuery = countQuery.lte("appointment_date", endDate);
          query = query.lte("appointment_date", endDate);
        }

        const { count } = await countQuery;
        const { data, error } = await query.range(offset, offset + limit - 1);
        if (error) throw error;

        return successResponse(data, { page, limit, total: count || 0 });
      }

      case "medical_records": {
        const page = getPage();
        const limit = getLimit();
        const offset = (page - 1) * limit;

        const { count } = await supabase
          .from("medical_records")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        const { data, error } = await supabase
          .from("medical_records")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;

        return successResponse(data, { page, limit, total: count || 0 });
      }

      case "prescriptions": {
        const page = getPage();
        const limit = getLimit();
        const offset = (page - 1) * limit;

        const { count } = await supabase
          .from("prescriptions")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        const { data, error } = await supabase
          .from("prescriptions")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;

        return successResponse(data, { page, limit, total: count || 0 });
      }

      case "financial_transactions": {
        const page = getPage();
        const limit = getLimit();
        const offset = (page - 1) * limit;
        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");

        let countQuery = supabase
          .from("financial_transactions")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        let query = supabase
          .from("financial_transactions")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("transaction_date", { ascending: false });

        if (startDate) {
          countQuery = countQuery.gte("transaction_date", startDate);
          query = query.gte("transaction_date", startDate);
        }
        if (endDate) {
          countQuery = countQuery.lte("transaction_date", endDate);
          query = query.lte("transaction_date", endDate);
        }

        const { count } = await countQuery;
        const { data, error } = await query.range(offset, offset + limit - 1);
        if (error) throw error;

        return successResponse(data, { page, limit, total: count || 0 });
      }

      case "automation_flows": {
        const { data, error } = await supabase
          .from("automation_flows")
          .select("*")
          .eq("clinic_id", clinicId)
          .is("deleted_at", null)
          .order("name");
        if (error) throw error;
        return successResponse(data);
      }

      case "access_groups": {
        const { data: groups, error: groupsError } = await supabase
          .from("access_groups")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("name");
        if (groupsError) throw groupsError;

        // Fetch permissions for each group
        const groupIds = groups?.map((g) => g.id) || [];
        const { data: permissions, error: permError } = await supabase
          .from("access_group_permissions")
          .select("*")
          .in("access_group_id", groupIds);
        if (permError) throw permError;

        // Attach permissions to groups
        const result = groups?.map((group) => ({
          ...group,
          permissions: permissions?.filter((p) => p.access_group_id === group.id) || [],
        }));

        return successResponse(result);
      }

      case "evolution_configs": {
        const { data, error } = await supabase
          .from("evolution_configs")
          .select("*")
          .eq("clinic_id", clinicId);
        if (error) throw error;
        return successResponse(data);
      }

      default:
        return errorResponse(`Unknown endpoint: ${pathname}`, 404);
    }
  } catch (error: any) {
    console.error("[data-export-api] Error:", error);
    return errorResponse(error?.message || "Internal server error", 500);
  }
});
