-- Remover política atual que está faltando WITH CHECK
DROP POLICY IF EXISTS "Clinic admins can manage employers" ON employers;

-- Criar política corrigida com USING e WITH CHECK
CREATE POLICY "Clinic admins can manage employers"
ON employers FOR ALL
TO authenticated
USING (is_clinic_admin(auth.uid(), clinic_id))
WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));