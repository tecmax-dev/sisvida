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
  trade_name: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  cnae_code: string | null;
  cnae_description: string | null;
}

interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  ddd_telefone_1: string;
  email: string | null;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  situacao_cadastral: string;
  descricao_situacao_cadastral: string;
}

interface ResultItem {
  employer_id: string;
  employer_name: string;
  cnpj: string;
  new_data: {
    name?: string;
    trade_name?: string | null;
    cep?: string | null;
    address?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    email?: string | null;
    cnae_code?: string | null;
    cnae_description?: string | null;
  } | null;
  status: 'updated' | 'no_changes' | 'invalid_cnpj' | 'inactive' | 'error';
  error?: string;
  situacao?: string;
}

interface Summary {
  total: number;
  updated: number;
  no_changes: number;
  invalid_cnpj: number;
  inactive: number;
  errors: number;
  dry_run: boolean;
}

function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

function formatPhone(dddPhone: string | null): string | null {
  if (!dddPhone) return null;
  const cleaned = dddPhone.replace(/\D/g, '');
  if (cleaned.length < 10) return null;
  
  const ddd = cleaned.substring(0, 2);
  const number = cleaned.substring(2);
  
  if (number.length === 9) {
    return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
  } else if (number.length === 8) {
    return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
  }
  
  return `(${ddd}) ${number}`;
}

function formatCep(cep: string | null): string | null {
  if (!cep) return null;
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return null;
  return `${cleaned.substring(0, 5)}-${cleaned.substring(5)}`;
}

async function processEmployer(
  employer: Employer, 
  supabase: any, 
  dryRun: boolean
): Promise<ResultItem> {
  const cleanedCnpj = cleanCnpj(employer.cnpj);

  if (cleanedCnpj.length !== 14) {
    return {
      employer_id: employer.id,
      employer_name: employer.name,
      cnpj: employer.cnpj,
      new_data: null,
      status: 'invalid_cnpj',
      error: 'CNPJ deve ter 14 dígitos'
    };
  }

  try {
    console.log(`[sync-employer-cnpj] Fetching CNPJ: ${cleanedCnpj}`);
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          employer_id: employer.id,
          employer_name: employer.name,
          cnpj: employer.cnpj,
          new_data: null,
          status: 'invalid_cnpj',
          error: 'CNPJ não encontrado na Receita Federal'
        };
      }
      throw new Error(`API retornou status ${response.status}`);
    }

    const data: BrasilApiCnpjResponse = await response.json();

    // Verificar situação cadastral
    if (data.situacao_cadastral !== "2" && data.descricao_situacao_cadastral?.toLowerCase() !== "ativa") {
      return {
        employer_id: employer.id,
        employer_name: employer.name,
        cnpj: employer.cnpj,
        new_data: null,
        status: 'inactive',
        situacao: data.descricao_situacao_cadastral || 'Inativa',
        error: `Empresa ${data.descricao_situacao_cadastral || 'inativa'}`
      };
    }

    // Montar endereço completo
    let fullAddress = data.logradouro || '';
    if (data.numero) fullAddress += `, ${data.numero}`;
    if (data.complemento) fullAddress += ` - ${data.complemento}`;

    const newData = {
      name: data.razao_social,
      trade_name: data.nome_fantasia || null,
      cep: formatCep(data.cep),
      address: fullAddress || null,
      neighborhood: data.bairro || null,
      city: data.municipio || null,
      state: data.uf || null,
      phone: formatPhone(data.ddd_telefone_1),
      email: data.email?.toLowerCase() || null,
      cnae_code: String(data.cnae_fiscal) || null,
      cnae_description: data.cnae_fiscal_descricao || null,
    };

    // Verificar se há mudanças significativas
    const hasChanges = 
      (newData.cep && newData.cep !== employer.cep) ||
      (newData.address && newData.address !== employer.address) ||
      (newData.neighborhood && newData.neighborhood !== employer.neighborhood) ||
      (newData.city && newData.city !== employer.city) ||
      (newData.state && newData.state !== employer.state) ||
      (newData.phone && newData.phone !== employer.phone) ||
      (newData.email && newData.email !== employer.email) ||
      (newData.cnae_code && newData.cnae_code !== employer.cnae_code);

    if (!hasChanges) {
      return {
        employer_id: employer.id,
        employer_name: employer.name,
        cnpj: employer.cnpj,
        new_data: newData,
        status: 'no_changes'
      };
    }

    if (!dryRun) {
      // Atualizar apenas campos que têm valor
      const updateFields: Record<string, unknown> = {};
      if (newData.cep) updateFields.cep = newData.cep;
      if (newData.address) updateFields.address = newData.address;
      if (newData.neighborhood) updateFields.neighborhood = newData.neighborhood;
      if (newData.city) updateFields.city = newData.city;
      if (newData.state) updateFields.state = newData.state;
      if (newData.phone) updateFields.phone = newData.phone;
      if (newData.email) updateFields.email = newData.email;
      if (newData.cnae_code) updateFields.cnae_code = newData.cnae_code;
      if (newData.cnae_description) updateFields.cnae_description = newData.cnae_description;
      if (newData.trade_name) updateFields.trade_name = newData.trade_name;

      const { error: updateError } = await supabase
        .from("employers")
        .update(updateFields)
        .eq("id", employer.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    return {
      employer_id: employer.id,
      employer_name: employer.name,
      cnpj: employer.cnpj,
      new_data: newData,
      status: 'updated'
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[sync-employer-cnpj] Error for ${employer.cnpj}:`, message);
    return {
      employer_id: employer.id,
      employer_name: employer.name,
      cnpj: employer.cnpj,
      new_data: null,
      status: 'error',
      error: message
    };
  }
}

// Processar em lotes com delay entre cada lote
async function processBatch(
  employers: Employer[], 
  supabase: any, 
  dryRun: boolean,
  batchSize: number = 5
): Promise<ResultItem[]> {
  const results: ResultItem[] = [];
  
  for (let i = 0; i < employers.length; i += batchSize) {
    const batch = employers.slice(i, i + batchSize);
    console.log(`[sync-employer-cnpj] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(employers.length / batchSize)}`);
    
    // Processar lote em paralelo
    const batchResults = await Promise.all(
      batch.map(employer => processEmployer(employer, supabase, dryRun))
    );
    
    results.push(...batchResults);
    
    // Delay entre lotes para evitar rate limiting
    if (i + batchSize < employers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clinic_id, dry_run = true, employer_ids = null } = await req.json();

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: "clinic_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-employer-cnpj] Starting sync for clinic ${clinic_id}, dry_run: ${dry_run}`);

    // Buscar empresas (todas ou específicas)
    let query = supabase
      .from("employers")
      .select("id, name, trade_name, cnpj, cep, address, neighborhood, city, state, phone, email, cnae_code, cnae_description")
      .eq("clinic_id", clinic_id)
      .not("cnpj", "is", null);

    if (employer_ids && Array.isArray(employer_ids) && employer_ids.length > 0) {
      query = query.in("id", employer_ids);
    }

    const { data: employers, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Erro ao buscar empresas: ${fetchError.message}`);
    }

    console.log(`[sync-employer-cnpj] Found ${(employers || []).length} employers to process`);

    // Processar em lotes paralelos (5 por vez)
    const results = await processBatch(employers || [], supabase, dry_run, 5);

    // Calcular resumo
    const summary: Summary = {
      total: results.length,
      updated: results.filter(r => r.status === 'updated').length,
      no_changes: results.filter(r => r.status === 'no_changes').length,
      invalid_cnpj: results.filter(r => r.status === 'invalid_cnpj').length,
      inactive: results.filter(r => r.status === 'inactive').length,
      errors: results.filter(r => r.status === 'error').length,
      dry_run
    };

    console.log(`[sync-employer-cnpj] Completed:`, summary);

    return new Response(
      JSON.stringify({ results, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[sync-employer-cnpj] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
