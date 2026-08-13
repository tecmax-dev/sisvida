import { supabase } from "@/integrations/supabase/client";

export const executeN8nTest = async () => {
  const clinicId = "89e7585e-7bce-4e58-91fa-c37080d1170d";
  
  console.log("Iniciando Teste Real PROSINGE -> n8n...");
  
  const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
    body: {
      clinicId,
      action: 'test-n8n-connection'
    }
  });

  if (error) {
    console.error("Erro na Edge Function:", error);
    return { ok: false, error };
  }

  console.log("Resultado Real:", data);
  return data;
};
