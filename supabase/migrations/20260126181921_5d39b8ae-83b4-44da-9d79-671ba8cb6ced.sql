-- Atualizar política INSERT para permitir que o app mobile (anon) crie declarações
-- Primeiro, remover a política existente se houver
DROP POLICY IF EXISTS "Users with clinic access can create authorizations" ON public.union_authorizations;

-- Criar política para usuários autenticados com acesso à clínica
CREATE POLICY "Authenticated users with clinic access can create authorizations"
ON public.union_authorizations
FOR INSERT
TO authenticated
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

-- Criar política para o app mobile (anon) permitir criação de declarações self-service
-- O paciente só pode criar para si mesmo (created_by = patient_id)
CREATE POLICY "Mobile app can create self-service authorizations"
ON public.union_authorizations
FOR INSERT
TO anon
WITH CHECK (
  patient_id IS NOT NULL 
  AND created_by IS NOT NULL 
  AND created_by = patient_id
);