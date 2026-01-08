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
      const { data, error } = await supabase.functions.invoke('lookup-cnpj', {
        body: { cnpj: cleanCnpj }
      });

      if (error) {
        console.error("Erro ao buscar CNPJ:", error);
        toast({
          title: "Erro na consulta",
          description: "Não foi possível consultar o CNPJ. Tente novamente.",
          variant: "destructive",
        });
        return null;
      }

      if (data.error) {
        toast({
          title: data.error === 'CNPJ não encontrado' ? "CNPJ não encontrado" : "Erro na consulta",
          description: data.error === 'CNPJ não encontrado' 
            ? "Verifique se o CNPJ está correto" 
            : data.error,
          variant: "destructive",
        });
        return null;
      }
      
      toast({
        title: "CNPJ encontrado",
        description: data.razao_social || data.nome_fantasia,
      });

      return data as CnpjData;
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
