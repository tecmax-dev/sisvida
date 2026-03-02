
-- 1. Add manage_card_expiry permission to Clientes category for clinic module
INSERT INTO public.permission_definitions (key, name, description, category, module_type, order_index, is_active)
VALUES (
  'manage_card_expiry_clinic',
  'Editar Validade de Carteirinha',
  'Permite editar a data de validade das carteirinhas dos pacientes',
  'Clientes',
  'clinic',
  20,
  true
)
ON CONFLICT (key) DO NOTHING;

-- 2. Add patient_swap_deadline_hours to clinics table (global default)
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS patient_swap_deadline_hours numeric DEFAULT NULL;

-- 3. Add patient_swap_deadline_hours to access_groups table (per-group override)
ALTER TABLE public.access_groups ADD COLUMN IF NOT EXISTS patient_swap_deadline_hours numeric DEFAULT NULL;

-- 4. Add permission for configuring patient swap deadline
INSERT INTO public.permission_definitions (key, name, description, category, module_type, order_index, is_active)
VALUES (
  'manage_patient_swap_deadline',
  'Limite de Troca de Paciente',
  'Define o limite de horas antecipadas para trocar o paciente em um agendamento',
  'Agendamento',
  'clinic',
  15,
  true
)
ON CONFLICT (key) DO NOTHING;
