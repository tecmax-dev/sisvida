-- Permitir operação de suporte/migração por super admins
DROP POLICY IF EXISTS "Super admins can manage employers" ON employers;

CREATE POLICY "Super admins can manage employers"
ON employers FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));