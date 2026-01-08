import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  cnae_fiscal?: number | null;
  cnae_fiscal_descricao?: string;
}

interface CnpjResponse {
  ok: boolean;
  error?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  cnae_fiscal?: number | null;
  cnae_fiscal_descricao?: string;
}

export function useCnpjLookup() {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const { toast } = useToast();

  const lookupCnpj = async (cnpj: string): Promise<CnpjData | null> => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ deve ter 14 dígitos",
        variant: "destructive",
      });
      return null;
    }

    setCnpjLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke<CnpjResponse>('lookup-cnpj', {
        body: { cnpj: cleanCnpj }
      });

      if (error) {
        console.error("Erro ao chamar função:", error);
        toast({
          title: "Erro na consulta",
          description: "Não foi possível conectar ao serviço. Verifique sua conexão.",
          variant: "destructive",
        });
        return null;
      }

      if (!data?.ok) {
        toast({
          title: data?.error === 'CNPJ não encontrado' ? "CNPJ não encontrado" : "Erro na consulta",
          description: data?.error || "Erro desconhecido",
          variant: "destructive",
        });
        return null;
      }
      
      toast({
        title: "CNPJ encontrado",
        description: data.razao_social || data.nome_fantasia,
      });

      return {
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        cnpj: data.cnpj || cleanCnpj,
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        cep: data.cep || '',
        telefone: data.telefone || '',
        email: data.email || '',
        cnae_fiscal: data.cnae_fiscal,
        cnae_fiscal_descricao: data.cnae_fiscal_descricao || '',
      };
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      toast({
        title: "Erro na consulta",
        description: "Não foi possível consultar o CNPJ. Verifique sua conexão.",
        variant: "destructive",
      });
      return null;
    } finally {
      setCnpjLoading(false);
    }
  };

  return { lookupCnpj, cnpjLoading };
}
