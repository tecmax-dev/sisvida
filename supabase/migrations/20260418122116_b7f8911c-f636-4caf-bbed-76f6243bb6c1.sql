-- 1) Inserir novas permissões para visualização de CPF completo
INSERT INTO public.permission_definitions (key, name, description, category, module_type, order_index, is_active)
VALUES 
  ('view_full_cpf_clinic', 'Visualizar CPF completo (Clínica)', 'Permite visualizar o CPF completo (sem máscara) nas telas do módulo clínico. Sem esta permissão, o CPF é exibido mascarado (***.***.***-XX).', 'Pacientes', 'clinic', 100, true),
  ('view_full_cpf_union', 'Visualizar CPF completo (Sindical)', 'Permite visualizar o CPF completo (sem máscara) nas telas do módulo sindical. Sem esta permissão, o CPF é exibido mascarado (***.***.***-XX).', 'Sócios', 'union', 100, true)
ON CONFLICT (key) DO NOTHING;

-- 2) Trigger para bloquear UPDATE da coluna cpf em patients
-- Permite alterar de NULL para valor (correção de cadastro), mas bloqueia mudança de um CPF já existente
CREATE OR REPLACE FUNCTION public.prevent_cpf_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite se o CPF anterior era NULL/vazio (preenchimento inicial)
  IF OLD.cpf IS NULL OR TRIM(OLD.cpf) = '' THEN
    RETURN NEW;
  END IF;

  -- Permite se o CPF não está sendo alterado
  IF OLD.cpf IS NOT DISTINCT FROM NEW.cpf THEN
    RETURN NEW;
  END IF;

  -- Permite se o usuário é super admin (correção emergencial)
  IF EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Bloqueia qualquer outra alteração
  RAISE EXCEPTION 'CPF não pode ser alterado após o cadastro. Entre em contato com um administrador.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cpf_update_patients ON public.patients;
CREATE TRIGGER trg_prevent_cpf_update_patients
BEFORE UPDATE OF cpf ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.prevent_cpf_update();

DROP TRIGGER IF EXISTS trg_prevent_cpf_update_dependents ON public.patient_dependents;
CREATE TRIGGER trg_prevent_cpf_update_dependents
BEFORE UPDATE OF cpf ON public.patient_dependents
FOR EACH ROW
EXECUTE FUNCTION public.prevent_cpf_update();

-- 3) Conceder as novas permissões aos grupos de acesso 'system' atuais (Sindical/Clínica) opt-in posteriormente.
-- Por padrão NINGUÉM (exceto Super Admin) terá a permissão — admins de entidade habilitam manualmente.
-- Isto cumpre o requisito "Padrão inicial: Apenas Super Admin".