-- Remover política antiga que pode estar usando role incorreto
DROP POLICY IF EXISTS "Users can view professionals of their clinics" ON public.professionals;

-- Criar nova política corrigida explicitamente para usuários autenticados
CREATE POLICY "Users can view professionals of their clinics"
ON public.professionals
FOR SELECT
TO authenticated
USING (has_clinic_access(auth.uid(), clinic_id));