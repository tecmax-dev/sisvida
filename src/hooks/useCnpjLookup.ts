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

// Valida CNPJ usando algoritmo módulo 11
function isValidCnpj(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  
  if (cleanCnpj.length !== 14) return false;
  
  // Rejeita CNPJs com todos os dígitos iguais
  if (/^(\d)\1+$/.test(cleanCnpj)) return false;
  
  // Calcula primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCnpj[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleanCnpj[12]) !== digit1) return false;
  
  // Calcula segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCnpj[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cleanCnpj[13]) === digit2;
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

    if (!isValidCnpj(cleanCnpj)) {
      toast({
        title: "CNPJ inválido",
        description: "Os dígitos verificadores do CNPJ estão incorretos. Verifique se digitou corretamente.",
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
