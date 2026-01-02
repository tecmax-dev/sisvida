import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "CNPJ não encontrado",
            description: "Verifique se o CNPJ está correto",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro na consulta",
            description: "Não foi possível consultar o CNPJ. Tente novamente.",
            variant: "destructive",
          });
        }
        return null;
      }

      const data = await response.json();
      
      toast({
        title: "CNPJ encontrado",
        description: data.razao_social || data.nome_fantasia,
      });

      return {
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
