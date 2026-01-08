import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    
    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      return new Response(
        JSON.stringify({ error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up CNPJ: ${cleanCnpj}`);
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'CNPJ não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar CNPJ' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    console.log(`CNPJ found: ${data.razao_social}`);

    return new Response(
      JSON.stringify({
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        cnpj: cleanCnpj,
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        cep: data.cep || '',
        telefone: data.ddd_telefone_1 || '',
        email: data.email || '',
        cnae_fiscal: data.cnae_fiscal || null,
        cnae_fiscal_descricao: data.cnae_fiscal_descricao || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up CNPJ:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao consultar CNPJ' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
