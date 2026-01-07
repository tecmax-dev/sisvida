import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
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

    // Pagination params
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "1000", 10), 10000);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    console.log(`[data-export-api] Request: ${pathname}, limit: ${limit}, offset: ${offset}`);

    switch (pathname) {
      case "health": {
        return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
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

      case "patients": {
        const { data, error, count } = await supabase
          .from("patients")
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

      case "appointments": {
        const { data, error, count } = await supabase
          .from("appointments")
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

      case "rooms": {
        const { data, error, count } = await supabase
          .from("rooms")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "appointment_procedures": {
        const { data, error, count } = await supabase
          .from("appointment_procedures")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "payment_methods": {
        const { data, error, count } = await supabase
          .from("payment_methods")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "anamnesis_templates": {
        const { data, error, count } = await supabase
          .from("anamnese_templates")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "anamnesis_records": {
        const { data, error, count } = await supabase
          .from("anamnese_responses")
          .select("*, anamnese_answers(*)", { count: "exact" })
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

      case "professional_procedures": {
        const { data, error, count } = await supabase
          .from("professional_procedures")
          .select("*", { count: "exact" })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "professional_schedules": {
        const { data, error, count } = await supabase
          .from("professionals")
          .select("id, clinic_id, name, schedule", { count: "exact" })
          .not("schedule", "is", null)
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return successResponse(data, count || 0);
      }

      case "schedule_exceptions": {
        const { data, error, count } = await supabase
          .from("schedule_exceptions")
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
