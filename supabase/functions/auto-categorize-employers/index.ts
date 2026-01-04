import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CNPJResponse {
  cnpj: string;
  razao_social: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
}

interface CategoryMapping {
  id: string;
  name: string;
  keywords: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clinic_id, dry_run = true } = await req.json();

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-categorize] Iniciando para clinic_id: ${clinic_id}, dry_run: ${dry_run}`);

    // Buscar categorias da clínica
    const { data: categories, error: catError } = await supabase
      .from('employer_categories')
      .select('id, name')
      .eq('clinic_id', clinic_id)
      .eq('is_active', true);

    if (catError) {
      console.error('[auto-categorize] Erro ao buscar categorias:', catError);
      throw catError;
    }

    if (!categories || categories.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma categoria encontrada para esta clínica' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-categorize] Categorias encontradas: ${categories.map(c => c.name).join(', ')}`);

    // Criar mapeamento de palavras-chave para categorias
    const categoryMappings: CategoryMapping[] = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      keywords: generateKeywords(cat.name)
    }));

    // Buscar empresas sem categoria
    const { data: employers, error: empError } = await supabase
      .from('employers')
      .select('id, cnpj, name, category_id')
      .eq('clinic_id', clinic_id)
      .is('category_id', null);

    if (empError) {
      console.error('[auto-categorize] Erro ao buscar empresas:', empError);
      throw empError;
    }

    console.log(`[auto-categorize] Empresas sem categoria: ${employers?.length || 0}`);

    const results: Array<{
      employer_id: string;
      employer_name: string;
      cnpj: string;
      cnae_code: number | null;
      cnae_description: string | null;
      matched_category: string | null;
      category_id: string | null;
      status: 'matched' | 'no_match' | 'error' | 'api_error';
      error?: string;
    }> = [];

    for (const employer of employers || []) {
      // Limpar CNPJ (remover pontos, traços, barras)
      const cleanCnpj = employer.cnpj.replace(/\D/g, '');
      
      if (cleanCnpj.length !== 14) {
        results.push({
          employer_id: employer.id,
          employer_name: employer.name,
          cnpj: employer.cnpj,
          cnae_code: null,
          cnae_description: null,
          matched_category: null,
          category_id: null,
          status: 'error',
          error: 'CNPJ inválido'
        });
        continue;
      }

      try {
        // Consultar BrasilAPI
        console.log(`[auto-categorize] Consultando CNPJ: ${cleanCnpj}`);
        
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        
        if (!response.ok) {
          console.error(`[auto-categorize] Erro na API para CNPJ ${cleanCnpj}: ${response.status}`);
          results.push({
            employer_id: employer.id,
            employer_name: employer.name,
            cnpj: employer.cnpj,
            cnae_code: null,
            cnae_description: null,
            matched_category: null,
            category_id: null,
            status: 'api_error',
            error: `API retornou status ${response.status}`
          });
          // Aguardar um pouco para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        const cnpjData: CNPJResponse = await response.json();
        console.log(`[auto-categorize] CNAE: ${cnpjData.cnae_fiscal} - ${cnpjData.cnae_fiscal_descricao}`);

        // Tentar encontrar categoria correspondente
        const matchedCategory = findMatchingCategory(
          cnpjData.cnae_fiscal,
          cnpjData.cnae_fiscal_descricao,
          categoryMappings
        );

        // Se não for dry_run, atualizar a empresa (SEMPRE salvar CNAE, mesmo sem match de categoria)
        if (!dry_run) {
          const updateData: Record<string, unknown> = {
            cnae_code: cnpjData.cnae_fiscal.toString(),
            cnae_description: cnpjData.cnae_fiscal_descricao
          };
          
          if (matchedCategory) {
            updateData.category_id = matchedCategory.id;
          }

          const { error: updateError } = await supabase
            .from('employers')
            .update(updateData)
            .eq('id', employer.id);

          if (updateError) {
            console.error(`[auto-categorize] Erro ao atualizar empresa ${employer.id}:`, updateError);
          }
        }

        if (matchedCategory) {
          console.log(`[auto-categorize] Match encontrado: ${matchedCategory.name}`);

          results.push({
            employer_id: employer.id,
            employer_name: employer.name,
            cnpj: employer.cnpj,
            cnae_code: cnpjData.cnae_fiscal,
            cnae_description: cnpjData.cnae_fiscal_descricao,
            matched_category: matchedCategory.name,
            category_id: matchedCategory.id,
            status: 'matched'
          });
        } else {
          results.push({
            employer_id: employer.id,
            employer_name: employer.name,
            cnpj: employer.cnpj,
            cnae_code: cnpjData.cnae_fiscal,
            cnae_description: cnpjData.cnae_fiscal_descricao,
            matched_category: null,
            category_id: null,
            status: 'no_match'
          });
        }

        // Aguardar 500ms entre requisições para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[auto-categorize] Erro ao processar empresa ${employer.id}:`, error);
        results.push({
          employer_id: employer.id,
          employer_name: employer.name,
          cnpj: employer.cnpj,
          cnae_code: null,
          cnae_description: null,
          matched_category: null,
          category_id: null,
          status: 'error',
          error: errorMessage
        });
      }
    }

    const summary = {
      total: results.length,
      matched: results.filter(r => r.status === 'matched').length,
      no_match: results.filter(r => r.status === 'no_match').length,
      errors: results.filter(r => r.status === 'error' || r.status === 'api_error').length,
      dry_run
    };

    console.log(`[auto-categorize] Resumo:`, summary);

    return new Response(
      JSON.stringify({ summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[auto-categorize] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateKeywords(categoryName: string): string[] {
  const name = categoryName.toLowerCase();
  const keywords: string[] = [];
  
  // Comércio Varejista
  if (name.includes('varejo') || name.includes('varejista')) {
    keywords.push(
      'varejo', 'varejista', 'loja', 'lojas',
      'comercio varejista', 'comércio varejista',
      'venda a varejo', 'vendas a varejo'
    );
    // CNAEs de varejo começam com 47
  }
  
  // Supermercados / Atacadista
  if (name.includes('supermercado') || name.includes('atacado') || name.includes('atacadista')) {
    keywords.push(
      'supermercado', 'supermercados', 'hipermercado', 'hipermercados',
      'atacado', 'atacadista', 'atacarejo',
      'mercearia', 'mercado', 'minimercado',
      'comercio atacadista', 'comércio atacadista'
    );
    // CNAEs de atacado começam com 46, supermercados são 4711-3
  }
  
  // Indústria
  if (name.includes('industria') || name.includes('indústria') || name.includes('industrial')) {
    keywords.push(
      'industria', 'indústria', 'industrial', 'fabricação', 'fabricacao',
      'manufatura', 'produção', 'producao'
    );
  }
  
  // Serviços
  if (name.includes('serviço') || name.includes('servico')) {
    keywords.push(
      'serviço', 'servico', 'serviços', 'servicos',
      'prestação de serviço', 'prestadora'
    );
  }
  
  // Alimentação
  if (name.includes('alimenta') || name.includes('restaurante') || name.includes('bar')) {
    keywords.push(
      'restaurante', 'restaurantes', 'alimentação', 'alimentacao',
      'bar', 'lanchonete', 'cafeteria', 'padaria'
    );
  }
  
  // Adicionar o próprio nome como keyword
  keywords.push(name);
  
  return keywords;
}

function findMatchingCategory(
  cnaeCode: number,
  cnaeDescription: string,
  categories: CategoryMapping[]
): CategoryMapping | null {
  const descLower = cnaeDescription.toLowerCase();
  const cnaeStr = cnaeCode.toString();
  
  for (const category of categories) {
    const catNameLower = category.name.toLowerCase();
    
    // Verificar por código CNAE
    // Varejo: começa com 47
    if ((catNameLower.includes('varejo') || catNameLower.includes('varejista')) && cnaeStr.startsWith('47')) {
      return category;
    }
    
    // Atacado/Supermercados: começa com 46 ou é 4711 (supermercados)
    if ((catNameLower.includes('atacado') || catNameLower.includes('atacadista') || catNameLower.includes('supermercado'))) {
      if (cnaeStr.startsWith('46') || cnaeStr.startsWith('4711')) {
        return category;
      }
    }
    
    // Verificar por palavras-chave na descrição do CNAE
    for (const keyword of category.keywords) {
      if (descLower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}
