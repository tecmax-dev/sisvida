-- Migração para atribuir grupos de acesso aos usuários existentes baseado no role
-- Esta migração automaticamente atribui o access_group_id correspondente ao role do usuário

-- Atribuir grupo "Recepcionista" para usuários com role 'receptionist'
UPDATE public.user_roles ur
SET access_group_id = ag.id
FROM public.access_groups ag
WHERE ur.role = 'receptionist'
  AND ur.access_group_id IS NULL
  AND ag.name = 'Recepcionista'
  AND ag.is_system = true;

-- Atribuir grupo "Profissional" para usuários com role 'professional'
UPDATE public.user_roles ur
SET access_group_id = ag.id
FROM public.access_groups ag
WHERE ur.role = 'professional'
  AND ur.access_group_id IS NULL
  AND ag.name = 'Profissional'
  AND ag.is_system = true;

-- Atribuir grupo "Administrativo" para usuários com role 'administrative'
UPDATE public.user_roles ur
SET access_group_id = ag.id
FROM public.access_groups ag
WHERE ur.role = 'administrative'
  AND ur.access_group_id IS NULL
  AND ag.name = 'Administrativo'
  AND ag.is_system = true;

-- Atribuir grupo "Administrador" para usuários com role 'admin' (não owners)
UPDATE public.user_roles ur
SET access_group_id = ag.id
FROM public.access_groups ag
WHERE ur.role = 'admin'
  AND ur.access_group_id IS NULL
  AND ag.name = 'Administrador'
  AND ag.is_system = true;

-- Owners mantêm access_group_id como NULL (têm acesso total por default)