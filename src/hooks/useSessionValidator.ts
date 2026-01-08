import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useSessionValidator() {
  const { signOut } = useAuth();

  const validateSession = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        console.error("[SessionValidator] Sessão inválida:", error?.message || "sessão não encontrada");
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        await signOut();
        return false;
      }

      // Verificar se o token ainda é válido tentando obter o usuário
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("[SessionValidator] Token inválido:", userError?.message || "usuário não encontrado");
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        await signOut();
        return false;
      }

      return true;
    } catch (err) {
      console.error("[SessionValidator] Erro ao validar sessão:", err);
      toast.error("Erro ao verificar sessão. Por favor, faça login novamente.");
      await signOut();
      return false;
    }
  };

  return { validateSession };
}
