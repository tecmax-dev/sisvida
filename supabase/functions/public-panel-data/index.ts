import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PublicPanelResponse =
  | { error: string }
  | {
      panel: { id: string; clinic_id: string; name: string; token: string; is_active: boolean };
      clinic: { id: string; name: string; logo_url: string | null } | null;
      currentCall: any | null;
      recentCalls: any[];
    };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" } satisfies PublicPanelResponse), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token inválido" } satisfies PublicPanelResponse), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: panel, error: panelError } = await supabase
      .from("panels")
      .select("id, clinic_id, name, token, is_active")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (panelError) throw panelError;

    if (!panel) {
      return new Response(
        JSON.stringify({ error: "Painel não encontrado ou inativo" } satisfies PublicPanelResponse),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name, logo_url")
      .eq("id", panel.clinic_id)
      .maybeSingle();

    const today = new Date().toISOString().split("T")[0];

    const { data: calls, error: callsError } = await supabase
      .from("queue_calls")
      .select(
        `*,
         queue:queues(name, display_mode)`
      )
      .eq("clinic_id", panel.clinic_id)
      .eq("status", "called")
      .gte("called_at", today)
      .order("called_at", { ascending: false })
      .limit(10);

    if (callsError) throw callsError;

    const transformed = (calls || []).map((item: any) => ({
      ...item,
      ticket_number: `${item.ticket_prefix || ""}${item.ticket_number ?? ""}`,
      patient_name:
        item.patient_name || `Senha ${(item.ticket_prefix || "") + String(item.ticket_number ?? "")}`,
    }));

    const currentCall = transformed[0] ?? null;
    const recentCalls = transformed.slice(1);

    return new Response(
      JSON.stringify({ panel, clinic: clinic ?? null, currentCall, recentCalls } satisfies PublicPanelResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[public-panel-data] error:", err);
    return new Response(JSON.stringify({ error: "Erro ao carregar painel" } satisfies PublicPanelResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
