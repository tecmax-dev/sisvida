-- Add permission to unblock patients (for no-show blocks)
INSERT INTO permission_definitions (key, name, description, category, order_index, is_active)
VALUES (
  'unblock_patients',
  'Desbloquear Pacientes',
  'Permite desbloquear pacientes que estão bloqueados por falta',
  'Clientes',
  4,
  true
)
ON CONFLICT (key) DO NOTHING;