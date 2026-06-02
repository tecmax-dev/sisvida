import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

// Chatgoo já recebe outgoing echoes nativamente da Meta. Mirror removido.

function renderTemplateBody(components: any[], variables: string[]): string {
  if (!Array.isArray(components)) return "";
  let headerText = "";
  let bodyText = "";
  let footerText = "";
  let varIdx = 0;
  const substitute = (text: string, count: number) => {
    let out = text;
    for (let i = 0; i < count; i++) {
      const val = variables[varIdx++] ?? "";
      out = out.replace(/\{\{\d+\}\}/, String(val));
    }
    return out;
  };
  for (const comp of components) {
    const text = comp.text || "";
    const matches = text.match(/\{\{\d+\}\}/g);
    const numVars = matches ? matches.length : 0;
    if (comp.type === "HEADER") {
      headerText = numVars > 0 ? substitute(text, numVars) : text;
    } else if (comp.type === "BODY") {
      bodyText = numVars > 0 ? substitute(text, numVars) : text;
    } else if (comp.type === "FOOTER") {
      footerText = text;
    } else if (comp.type === "BUTTONS") {
      const btns = (comp.buttons || []).map((b: any) => `▸ ${b.text || b.url || ""}`).join("\n");
      if (btns) footerText = (footerText ? footerText + "\n\n" : "") + btns;
    }
  }
  return [headerText, bodyText, footerText].filter(Boolean).join("\n\n");
}

interface SendBody {
  to: string; // E.164 sem +, ex: 5573999999999
  template_name: string;
  language?: string;
    variables?: string[]; // valores para {{1}}, {{2}}, ... (distribuídos automaticamente)
    button_variables?: string[]; // valores legados
    ticket_id?: string;
    phone_number_id?: string;
    token?: string;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function countComponentVariables(components: any[]): number {
  return components.reduce((total, comp) => {
    if (comp.type === "BODY" || comp.type === "HEADER") {
      const text = comp.text || "";
      const matches = text.match(/\{\{\d+\}\}/g);
      if (!matches) return total;
      return total + new Set(matches.map((m: string) => m.replace(/[^0-9]/g, ""))).size;
    }

    if (comp.type === "BUTTONS") {
      const buttons = comp.buttons || [];
      return total + buttons.filter((button: any) =>
        button.type === "URL" && /\{\{\d+\}\}/.test(button.url || "")
      ).length;
    }

    return total;
  }, 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SendBody = await req.json();
    const { to, template_name, language = "pt_BR", variables = [], ticket_id, phone_number_id, token } = body;
    
    console.log(`[meta-send-template] Request for template: ${template_name} to: ${to}`);

    const PHONE_ID = phone_number_id || Deno.env.get("META_PHONE_NUMBER_ID") || "1110151302179856";
    const TOKEN = token || Deno.env.get("META_WHATSAPP_TOKEN");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!PHONE_ID || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "META_PHONE_NUMBER_ID e META_WHATSAPP_TOKEN são obrigatórios" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!to || !template_name) {
      return new Response(
        JSON.stringify({ error: "to e template_name são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Buscar template (necessário fora do if para usar components depois)
    let tpl: any = null;
    if (template_name !== "hello_world") {
      const { data } = await supabase
        .from("whatsapp_meta_templates")
        .select("status, variables_count, components")
        .eq("name", template_name)
        .eq("language", language)
        .maybeSingle();
      tpl = data;

      if (!tpl) {
        // Auto-heal: template pode estar aprovado na Meta mas ainda não sincronizado localmente.
        console.log(`[meta-send-template] Template ${template_name} ausente no cache. Forçando sync com Meta...`);
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/meta-sync-templates`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: "{}",
          });
          const { data: refreshed } = await supabase
            .from("whatsapp_meta_templates")
            .select("status, variables_count, components")
            .eq("name", template_name)
            .eq("language", language)
            .maybeSingle();
          if (refreshed) tpl = refreshed;
        } catch (e) {
          console.error("[meta-send-template] Falha ao sincronizar templates:", e);
        }
        if (!tpl) {
          return new Response(
            JSON.stringify({ error: `Template ${template_name} (${language}) não encontrado mesmo após sync.` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      if (tpl.status !== "APPROVED") {
        // Auto-heal: status local pode estar desatualizado em relação à Meta.
        // Forçar sincronização e re-checar antes de falhar.
        console.log(`[meta-send-template] Status local ${tpl.status} para ${template_name}. Forçando sync com Meta...`);
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/meta-sync-templates`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: "{}",
          });
          const { data: refreshed } = await supabase
            .from("whatsapp_meta_templates")
            .select("status, variables_count, components")
            .eq("name", template_name)
            .eq("language", language)
            .maybeSingle();
          if (refreshed) tpl = refreshed;
        } catch (e) {
          console.error("[meta-send-template] Falha ao re-sincronizar templates:", e);
        }
        if (tpl.status !== "APPROVED") {
          return new Response(
            JSON.stringify({ error: `Template não aprovado (status atual: ${tpl.status})` }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      const expectedVariables = countComponentVariables((tpl?.components as any[]) || []);
      if (expectedVariables !== variables.length) {
        return new Response(
          JSON.stringify({
            error: `Quantidade de variáveis inválida. Template requer ${expectedVariables}, recebido ${variables.length}.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Distribuir variáveis entre os componentes do template
    const metaComponents: any[] = [];
    const components = (tpl?.components as any[]) || [];
    
    // Variáveis são fornecidas em uma lista plana. Precisamos saber quantas variáveis cada componente espera.
    let varIndex = 0;
    
    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      const text = comp.text || "";
      
      // Contar quantas variáveis {{n}} existem neste componente
      const matches = text.match(/\{\{\d+\}\}/g);
      const numVars = matches ? matches.length : 0;
      
      if (comp.type === "BODY" && numVars > 0) {
        const compVars = variables.slice(varIndex, varIndex + numVars);
        varIndex += numVars;
        
        metaComponents.push({
          type: "body",
          parameters: compVars.map(v => ({ type: "text", text: String(v) }))
        });
      } else if (comp.type === "HEADER" && numVars > 0) {
        const compVars = variables.slice(varIndex, varIndex + numVars);
        varIndex += numVars;
        
        metaComponents.push({
          type: "header",
          parameters: compVars.map(v => ({ type: "text", text: String(v) }))
        });
      } else if (comp.type === "BUTTONS") {
        const buttons = comp.buttons || [];
        console.log(`[meta-send-template] Template has ${buttons.length} buttons.`);
        
        for (let bIdx = 0; bIdx < buttons.length; bIdx++) {
          const button = buttons[bIdx];
          
          if (button.type === "URL" && button.url && button.url.includes("{{1}}")) {
            const buttonUrlPrefix = button.url.slice(0, button.url.indexOf("{{1}}"));
            const compVars = variables.slice(varIndex, varIndex + 1).map((value) => {
              const text = String(value);
              if (!buttonUrlPrefix.includes("?") && text.includes("=") && !text.startsWith("?") && !text.startsWith("&")) {
                return `?${text}`;
              }
              return text;
            });
            varIndex += 1;
            
            metaComponents.push({
              type: "button",
              sub_type: "url",
              index: String(bIdx),
              parameters: compVars.map(v => ({ type: "text", text: String(v) }))
            });
          } else if (button.type === "QUICK_REPLY") {
            // Quick reply buttons with no variables must still be acknowledged 
            // in the components array if they exist in the template, 
            // according to some Meta API versions/edge cases.
            metaComponents.push({
              type: "button",
              sub_type: "quick_reply",
              index: String(bIdx),
              parameters: [] // No parameters for static quick replies
            });
          }
        }
      }
    }

    // Fallback: se não conseguimos distribuir variáveis mas temos variáveis e nenhum componente adicionado
    if (metaComponents.length === 0 && variables.length > 0) {
      console.log("[meta-send-template] Fallback distribution to body");
      metaComponents.push({
        type: "body",
        parameters: variables.map(v => ({ type: "text", text: String(v) }))
      });
    }

    const payload = {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "template",
      template: {
        name: template_name,
        language: { code: language },
         ...(metaComponents.length > 0 ? { components: metaComponents } : {}),
      },
    };

    console.log(`[meta-send-template] Payload sent to Meta: ${JSON.stringify(payload)}`);

    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(payload),
      },
    );

    const json = await res.json();

    if (!res.ok) {
      console.error("[meta-send-template] Meta error:", json);
      return new Response(
        JSON.stringify({ error: "Falha no envio Meta", meta: json }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messageId = json.messages?.[0]?.id ?? null;

    // Espelhar envio para o painel Chatgoo (não-bloqueante)
    try {
      mirrorOutgoingToChatgoo({
        to: normalizePhone(to),
        phoneId: PHONE_ID,
        displayPhone: Deno.env.get("META_DISPLAY_PHONE_NUMBER") || "557332311784",
        templateName: template_name,
        components: (tpl?.components as any[]) || [],
        variables,
        metaResponse: json,
      });
    } catch (mirrorErr) {
      console.error("[meta-send-template] mirror error (ignored):", mirrorErr);
    }

    // Registrar no ticket se fornecido
    if (ticket_id) {
      await supabase.from("whatsapp_ticket_messages").insert({
        ticket_id,
        sender_type: "operator",
        message_type: "template",
        content: `[Template: ${template_name}]`,
        metadata: { template_name, language, variables, meta_message_id: messageId },
      });
      await supabase
        .from("whatsapp_tickets")
        .update({ last_message_at: new Date().toISOString(), last_message: `[Template: ${template_name}]` })
        .eq("id", ticket_id);
    }

    return new Response(
      JSON.stringify({ success: true, message_id: messageId, meta: json }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[meta-send-template] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
