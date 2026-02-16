-- Add permission for managing card expiry dates
INSERT INTO public.permission_definitions (key, name, description, category, module_type, order_index, is_active)
VALUES (
  'manage_card_expiry',
  'Editar Validade de Carteirinha',
  'Permite editar a data de validade das carteirinhas dos sócios e dependentes',
  'Sindical - Sócios',
  'union',
  30,
  true
)
ON CONFLICT DO NOTHING;