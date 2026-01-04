import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface ResultItem {
  employer_id: string;
  employer_name: string;
  cnpj: string;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: 'updated' | 'no_cep' | 'invalid_cep' | 'error';
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clinic_id, dry_run = true } = await req.json();

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: "clinic_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar todas as empresas da clínica que têm CEP mas faltam dados de endereço
    const { data: employers, error: fetchError } = await supabase
      .from("employers")
      .select("id, name, cnpj, cep, address, neighborhood, city, state")
      .eq("clinic_id", clinic_id)
      .not("cep", "is", null);

    if (fetchError) {
      throw new Error(`Erro ao buscar empresas: ${fetchError.message}`);
    }

    // Filtrar empresas que precisam de atualização (têm CEP mas faltam dados)
    const employersToUpdate = (employers || []).filter((emp: Employer) => 
      emp.cep && emp.cep.replace(/\D/g, '').length === 8 && (!emp.address || !emp.city || !emp.state)
    );

    const results: ResultItem[] = [];
    let updated = 0;
    let noCep = 0;
    let invalidCep = 0;
    let errors = 0;

    // Processar também empresas sem CEP para contagem
    const allEmployers = employers || [];
    const withoutCep = allEmployers.filter((emp: Employer) => !emp.cep || emp.cep.replace(/\D/g, '').length !== 8);
    noCep = withoutCep.length;

    for (const employer of employersToUpdate) {
      const cleanedCep = employer.cep!.replace(/\D/g, '');

      try {
        // Adicionar delay para evitar rate limiting da API
        await new Promise(resolve => setTimeout(resolve, 200));

        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data: ViaCepResponse = await response.json();

        if (data.erro) {
          results.push({
            employer_id: employer.id,
            employer_name: employer.name,
            cnpj: employer.cnpj,
            cep: employer.cep,
            address: null,
            neighborhood: null,
            city: null,
            state: null,
            status: 'invalid_cep',
            error: 'CEP não encontrado'
          });
          invalidCep++;
          continue;
        }

        const updateData = {
          address: data.logradouro || employer.address,
          neighborhood: data.bairro || employer.neighborhood,
          city: data.localidade || employer.city,
          state: data.uf || employer.state,
        };

        if (!dry_run) {
          const { error: updateError } = await supabase
            .from("employers")
            .update(updateData)
            .eq("id", employer.id);

          if (updateError) {
            throw new Error(updateError.message);
          }
        }

        results.push({
          employer_id: employer.id,
          employer_name: employer.name,
          cnpj: employer.cnpj,
          cep: employer.cep,
          address: updateData.address,
          neighborhood: updateData.neighborhood,
          city: updateData.city,
          state: updateData.state,
          status: 'updated'
        });
        updated++;

      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        results.push({
          employer_id: employer.id,
          employer_name: employer.name,
          cnpj: employer.cnpj,
          cep: employer.cep,
          address: null,
          neighborhood: null,
          city: null,
          state: null,
          status: 'error',
          error: message
        });
        errors++;
      }
    }

    // Adicionar empresas sem CEP ao resultado
    for (const emp of withoutCep) {
      results.push({
        employer_id: emp.id,
        employer_name: emp.name,
        cnpj: emp.cnpj,
        cep: emp.cep,
        address: emp.address,
        neighborhood: emp.neighborhood,
        city: emp.city,
        state: emp.state,
        status: 'no_cep'
      });
    }

    return new Response(
      JSON.stringify({
        results,
        summary: {
          total: allEmployers.length,
          updated,
          no_cep: noCep,
          invalid_cep: invalidCep,
          errors,
          dry_run
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});