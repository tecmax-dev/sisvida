import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brazilian states for state holidays
const BRAZILIAN_STATES: Record<string, { name: string; holidays: { name: string; day: number; month: number }[] }> = {
  AC: { name: "Acre", holidays: [{ name: "Dia do Evangélico", day: 23, month: 1 }] },
  AL: { name: "Alagoas", holidays: [{ name: "Emancipação Política", day: 16, month: 9 }] },
  AP: { name: "Amapá", holidays: [{ name: "Criação do Território Federal", day: 13, month: 9 }] },
  AM: { name: "Amazonas", holidays: [{ name: "Elevação do Amazonas", day: 5, month: 9 }] },
  BA: { name: "Bahia", holidays: [{ name: "Independência da Bahia", day: 2, month: 7 }] },
  CE: { name: "Ceará", holidays: [{ name: "Data Magna do Ceará", day: 25, month: 3 }] },
  DF: { name: "Distrito Federal", holidays: [{ name: "Fundação de Brasília", day: 21, month: 4 }] },
  ES: { name: "Espírito Santo", holidays: [{ name: "Data Magna do ES", day: 23, month: 5 }] },
  GO: { name: "Goiás", holidays: [{ name: "Criação do Estado", day: 26, month: 7 }] },
  MA: { name: "Maranhão", holidays: [{ name: "Adesão do Maranhão", day: 28, month: 7 }] },
  MT: { name: "Mato Grosso", holidays: [{ name: "Divino Santo", day: 29, month: 11 }] },
  MS: { name: "Mato Grosso do Sul", holidays: [{ name: "Criação do Estado", day: 11, month: 10 }] },
  MG: { name: "Minas Gerais", holidays: [{ name: "Data Magna de Minas", day: 21, month: 4 }] },
  PA: { name: "Pará", holidays: [{ name: "Adesão do Pará", day: 15, month: 8 }] },
  PB: { name: "Paraíba", holidays: [{ name: "Fundação da Paraíba", day: 5, month: 8 }] },
  PR: { name: "Paraná", holidays: [{ name: "Emancipação Política", day: 19, month: 12 }] },
  PE: { name: "Pernambuco", holidays: [{ name: "Revolução Pernambucana", day: 6, month: 3 }] },
  PI: { name: "Piauí", holidays: [{ name: "Dia do Piauí", day: 19, month: 10 }] },
  RJ: { name: "Rio de Janeiro", holidays: [{ name: "Dia de São Jorge", day: 23, month: 4 }] },
  RN: { name: "Rio Grande do Norte", holidays: [{ name: "Mártires de Cunhaú e Uruaçu", day: 3, month: 10 }] },
  RS: { name: "Rio Grande do Sul", holidays: [{ name: "Dia do Gaúcho", day: 20, month: 9 }] },
  RO: { name: "Rondônia", holidays: [{ name: "Criação do Estado", day: 4, month: 1 }] },
  RR: { name: "Roraima", holidays: [{ name: "Criação de Roraima", day: 5, month: 10 }] },
  SC: { name: "Santa Catarina", holidays: [{ name: "Dia de Santa Catarina", day: 25, month: 11 }] },
  SP: { name: "São Paulo", holidays: [{ name: "Revolução Constitucionalista", day: 9, month: 7 }] },
  SE: { name: "Sergipe", holidays: [{ name: "Emancipação Política", day: 8, month: 7 }] },
  TO: { name: "Tocantins", holidays: [{ name: "Criação do Estado", day: 5, month: 10 }] },
};

// Calculate Easter date using Anonymous Gregorian algorithm
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Get all Brazilian holidays for a given year
function getBrazilianHolidays(year: number, state?: string): { name: string; date: string; type: "national" | "state" }[] {
  const holidays: { name: string; date: string; type: "national" | "state" }[] = [];
  
  // Fixed national holidays
  const fixedHolidays = [
    { name: "Confraternização Universal", day: 1, month: 1 },
    { name: "Tiradentes", day: 21, month: 4 },
    { name: "Dia do Trabalho", day: 1, month: 5 },
    { name: "Independência do Brasil", day: 7, month: 9 },
    { name: "Nossa Senhora Aparecida", day: 12, month: 10 },
    { name: "Finados", day: 2, month: 11 },
    { name: "Proclamação da República", day: 15, month: 11 },
    { name: "Natal", day: 25, month: 12 },
  ];

  for (const holiday of fixedHolidays) {
    const date = new Date(year, holiday.month - 1, holiday.day);
    holidays.push({
      name: holiday.name,
      date: date.toISOString().split("T")[0],
      type: "national",
    });
  }

  // Calculate movable holidays based on Easter
  const easter = calculateEaster(year);
  
  // Carnaval (47 days before Easter - the Tuesday)
  const carnaval = new Date(easter);
  carnaval.setDate(easter.getDate() - 47);
  holidays.push({
    name: "Carnaval",
    date: carnaval.toISOString().split("T")[0],
    type: "national",
  });

  // Sexta-feira Santa (2 days before Easter)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({
    name: "Sexta-feira Santa",
    date: goodFriday.toISOString().split("T")[0],
    type: "national",
  });

  // Páscoa
  holidays.push({
    name: "Páscoa",
    date: easter.toISOString().split("T")[0],
    type: "national",
  });

  // Corpus Christi (60 days after Easter)
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push({
    name: "Corpus Christi",
    date: corpusChristi.toISOString().split("T")[0],
    type: "national",
  });

  // Add state holidays if state is provided
  if (state && BRAZILIAN_STATES[state]) {
    for (const holiday of BRAZILIAN_STATES[state].holidays) {
      const date = new Date(year, holiday.month - 1, holiday.day);
      holidays.push({
        name: holiday.name,
        date: date.toISOString().split("T")[0],
        type: "state",
      });
    }
  }

  // Sort by date
  holidays.sort((a, b) => a.date.localeCompare(b.date));

  return holidays;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clinic_id, year, state, import_holidays, selected_dates } = await req.json();

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: "clinic_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetYear = year || new Date().getFullYear();

    // Get all holidays for the year
    const holidays = getBrazilianHolidays(targetYear, state);

    // Check which holidays are already imported
    const { data: existingBlocks, error: blocksError } = await supabase
      .from("homologacao_blocks")
      .select("block_date, reason")
      .eq("clinic_id", clinic_id)
      .eq("block_type", "holiday")
      .gte("block_date", `${targetYear}-01-01`)
      .lte("block_date", `${targetYear}-12-31`);

    if (blocksError) {
      console.error("Error fetching existing blocks:", blocksError);
      throw blocksError;
    }

    const existingDates = new Set(existingBlocks?.map(b => b.block_date) || []);

    // Mark holidays as imported or not
    const holidaysWithStatus = holidays.map(h => ({
      ...h,
      isImported: existingDates.has(h.date),
    }));

    // If import_holidays is true, import selected holidays
    if (import_holidays && selected_dates && selected_dates.length > 0) {
      const holidaysToImport = holidays.filter(
        h => selected_dates.includes(h.date) && !existingDates.has(h.date)
      );

      if (holidaysToImport.length > 0) {
        const blocksToInsert = holidaysToImport.map(h => ({
          clinic_id,
          block_date: h.date,
          reason: h.name,
          block_type: "holiday",
          professional_id: null,
        }));

        const { error: insertError } = await supabase
          .from("homologacao_blocks")
          .insert(blocksToInsert);

        if (insertError) {
          console.error("Error inserting holidays:", insertError);
          throw insertError;
        }

        console.log(`Imported ${holidaysToImport.length} holidays for clinic ${clinic_id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            imported: holidaysToImport.length,
            holidays: holidaysToImport 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, imported: 0, message: "No new holidays to import" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return holidays list with import status
    return new Response(
      JSON.stringify({ 
        holidays: holidaysWithStatus,
        year: targetYear,
        state: state || null,
        states: Object.entries(BRAZILIAN_STATES).map(([code, data]) => ({
          code,
          name: data.name,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in fetch-brazilian-holidays:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
