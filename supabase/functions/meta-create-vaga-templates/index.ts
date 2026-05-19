import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

interface Prof {
  slug: string;
  nome: string;
  especialidade: string;
}

const PROFISSIONAIS: Prof[] = [
  { slug: "daniela_sales", nome: "Daniela Sales", especialidade: "Terapia Ocupacional / Massagem Relaxante" },
  { slug: "eliney_silva", nome: "Eliney Silva", especialidade: "Psicologia" },
  { slug: "jorge_avelar", nome: "Jorge Avelar", especialidade: "Ortopedia" },
  { slug: "jose_alcides", nome: "José Alcides", especialidade: "Clínica Geral" },
  { slug: "juliane_leite", nome: "Juliane Leite", especialidade: "Clínica Geral Odontológica" },
  { slug: "marcelo_aguiar", nome: "Marcelo Aguiar", especialidade: "Clínica Geral Odontológica" },
  { slug: "pedro_roberto", nome: "Pedro Roberto", especialidade: "Urologia" },
  { slug: "uiara_tiuba", nome: "Uiara Tiuba", especialidade: "Pediatria" },
];

function buildTemplate(p: Prof) {
  return {
    name: `vaga_medica_${p.slug}_v3`,
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          `Olá, {{1}}. Há um horário disponível em sua agenda de ${p.especialidade} com ${p.nome} no dia {{2}} às {{3}}, na sede do Sindicato dos Comerciários.\n\n` +
          `Para confirmar ou reagendar, acesse o aplicativo oficial.`,
        example: { body_text: [["Maria", "20/05/2026", "14:30"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Acessar Aplicativo", url: "https://prosindweb.com.br/sindicato" },
        ],
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WABA_ID = Deno.env.get("META_WABA_ID");
    const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    if (!WABA_ID || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "META_WABA_ID e META_WHATSAPP_TOKEN são obrigatórios" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates`;
    const results: any[] = [];

    for (const p of PROFISSIONAIS) {
      const tpl = buildTemplate(p);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(tpl),
        });
        const json = await res.json();
        results.push({ name: tpl.name, ok: res.ok, status: res.status, meta: json });
      } catch (e) {
        results.push({ name: tpl.name, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});