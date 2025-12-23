import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export function useCepLookup() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const lookupCep = async (cep: string): Promise<CepData | null> => {
    const cleanedCep = cep.replace(/\D/g, '');
    
    if (cleanedCep.length !== 8) {
      return null;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
        return null;
      }

      return data as CepData;
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível consultar o CEP.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { lookupCep, loading };
}