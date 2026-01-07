import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, X-API-Key",
};

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function successResponse(data: any, total: number) {
  return new Response(JSON.stringify({ data, total }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API Key (case-insensitive header check)
    const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("SOURCE_API_KEY");

    if (!apiKey || apiKey !== expectedKey) {
      console.error("[data-export-api] Invalid or missing API key");
      return errorResponse("Unauthorized", 401);
    }

    // Create Supabase client with service role for global access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const pathname = url.pathname.replace(/^\/data-export-api\/?/, "").replace(/\/$/, "");

    // Pagination params
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "1000", 10), 10000);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    console.log(`[data-export-api] Request: ${pathname}, limit: ${limit}, offset: ${offset}`);

    switch (pathname) {
      case "health": {
        return new Response(JSON.stringify({ 
          status: "ok", 
          timestamp: new Date().toISOString(),
          version: "1.0.0"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "clinics": {
        const { data, error, count } = await supabase
          .from("clinics")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "procedures": {
        const { data, error, count } = await supabase
          .from("procedures")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "insurance_plans": {
        const { data, error, count } = await supabase
          .from("insurance_plans")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "rooms": {
        const { data, error, count } = await supabase
          .from("rooms")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "professionals": {
        const { data, error, count } = await supabase
          .from("professionals")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "professional_availability": {
        const { data, error, count } = await supabase
          .from("schedule_exceptions")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "patients": {
        const { data, error, count } = await supabase
          .from("patients")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "patient_dependents": {
        const { data, error, count } = await supabase
          .from("patient_dependents")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "appointments": {
        const { data, error, count } = await supabase
          .from("appointments")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "medical_records": {
        const { data, error, count } = await supabase
          .from("medical_records")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "financial_categories": {
        const { data, error, count } = await supabase
          .from("financial_categories")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "financial_transactions": {
        const { data, error, count } = await supabase
          .from("financial_transactions")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "user_roles": {
        const { data, error, count } = await supabase
          .from("user_roles")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      default:
        return errorResponse(`Unknown endpoint: ${pathname}`, 404);
    }
  } catch (error: any) {
    console.error("[data-export-api] Error:", error);
    return errorResponse(error?.message || "Internal server error", 500);
  }
});
