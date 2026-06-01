-- Add new permissions to allow/block adding dependents to member records
-- For both clinic module and union module

INSERT INTO public.permission_definitions (key, name, description, category, parent_key, order_index, module_type)
VALUES
  (
    'manage_patient_dependents',
    'Gerenciar Dependentes',
    'Permite incluir, editar e remover dependentes nos cadastros de pacientes/sócios',
    'Clientes',
    'manage_patients',
    50,
    'clinic'
  ),
  (
    'union_manage_member_dependents',
    'Gerenciar Dependentes do Sócio',
    'Permite incluir, editar e remover dependentes nos cadastros de sócios',
    'Sindical - Sócios',
    'union_manage_members',
    50,
    'union'
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  parent_key = EXCLUDED.parent_key,
  module_type = EXCLUDED.module_type,
  is_active = true;

-- Grant the new permissions to all existing "system" admin/owner-like groups so
-- existing behavior is preserved (admins/owners keep ability to add dependents).
INSERT INTO public.access_group_permissions (access_group_id, permission_key)
SELECT ag.id, pd.key
FROM public.access_groups ag
CROSS JOIN public.permission_definitions pd
WHERE pd.key IN ('manage_patient_dependents','union_manage_member_dependents')
  AND ag.is_system = true
  AND (
    -- system admin/owner-style groups: those that already have manage_patients or union_manage_members
    EXISTS (
      SELECT 1 FROM public.access_group_permissions agp2
      WHERE agp2.access_group_id = ag.id
        AND agp2.permission_key IN ('manage_patients','union_manage_members')
    )
  )
ON CONFLICT DO NOTHING;