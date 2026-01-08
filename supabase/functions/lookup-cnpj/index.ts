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
        JSON.stringify({ ok: false, error: 'CNPJ é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      return new Response(
        JSON.stringify({ ok: false, error: 'CNPJ deve ter 14 dígitos' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up CNPJ: ${cleanCnpj}`);
    
    // Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response;
    try {
      response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LovableApp/1.0',
          'Accept': 'application/json',
        },
      });
    } catch (fetchError: unknown) {
      console.error('Fetch error:', fetchError);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ ok: false, error: 'Tempo esgotado. Tente novamente.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ ok: false, error: 'Erro de conexão com o serviço de CNPJ' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      clearTimeout(timeoutId);
    }
    
    console.log(`BrasilAPI response status: ${response.status}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ ok: false, error: 'CNPJ não encontrado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Muitas requisições. Aguarde alguns segundos.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error(`BrasilAPI error: ${response.status}`);
      return new Response(
        JSON.stringify({ ok: false, error: 'Erro ao consultar CNPJ. Tente novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    console.log(`CNPJ found: ${data.razao_social}`);

    return new Response(
      JSON.stringify({
        ok: true,
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up CNPJ:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'Erro interno ao consultar CNPJ' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
