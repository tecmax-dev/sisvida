import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, appointmentId, sessionId, clinicId } = await req.json();
    
    console.log("[telemedicine] Action:", action, { appointmentId, sessionId, clinicId });

    switch (action) {
      case "create-session": {
        // Verify appointment exists
        const { data: appointment, error: aptError } = await supabase
          .from("appointments")
          .select("id, clinic_id, patient_id, patient:patients(name, phone)")
          .eq("id", appointmentId)
          .single();

        if (aptError || !appointment) {
          console.error("[telemedicine] Appointment not found:", aptError);
          return new Response(
            JSON.stringify({ error: "Appointment not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if session already exists
        const { data: existingSession } = await supabase
          .from("telemedicine_sessions")
          .select("*")
          .eq("appointment_id", appointmentId)
          .maybeSingle();

        if (existingSession) {
          console.log("[telemedicine] Returning existing session:", existingSession.id);
          return new Response(
            JSON.stringify({ session: existingSession }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create new session
        const roomId = `room_${appointmentId}_${Date.now()}`;
        
        const { data: session, error: createError } = await supabase
          .from("telemedicine_sessions")
          .insert({
            appointment_id: appointmentId,
            clinic_id: appointment.clinic_id,
            room_id: roomId,
            status: "waiting",
          })
          .select()
          .single();

        if (createError) {
          console.error("[telemedicine] Error creating session:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create session" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("[telemedicine] Session created:", session.id);

        // Generate patient link
        const patientLink = `${supabaseUrl.replace('.supabase.co', '')}/telemedicina/${session.patient_token}`;

        return new Response(
          JSON.stringify({ 
            session,
            patientLink,
            patientPhone: (appointment.patient as any)?.phone,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get-session": {
        const { data: session, error } = await supabase
          .from("telemedicine_sessions")
          .select(`
            *,
            appointment:appointments (
              id,
              appointment_date,
              start_time,
              patient:patients (name, phone),
              professional:professionals (name, specialty)
            )
          `)
          .eq("id", sessionId)
          .single();

        if (error) {
          console.error("[telemedicine] Error getting session:", error);
          return new Response(
            JSON.stringify({ error: "Session not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ session }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update-status": {
        const { status, endedAt } = await req.json();
        
        const updateData: any = { status };
        if (status === "in_progress" && !await hasStartedAt(supabase, sessionId)) {
          updateData.started_at = new Date().toISOString();
        }
        if (status === "ended") {
          updateData.ended_at = endedAt || new Date().toISOString();
        }

        const { error } = await supabase
          .from("telemedicine_sessions")
          .update(updateData)
          .eq("id", sessionId);

        if (error) {
          console.error("[telemedicine] Error updating status:", error);
          return new Response(
            JSON.stringify({ error: "Failed to update status" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[telemedicine] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function hasStartedAt(supabase: any, sessionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("telemedicine_sessions")
    .select("started_at")
    .eq("id", sessionId)
    .single();
  return !!data?.started_at;
}
