INSERT INTO public.permission_definitions (key, name, description, category, order_index, module_type)
VALUES
  ('manage_calendar_slot_blocks', 'Bloquear/Desbloquear Horários (Agenda)', 'Permite bloquear e desbloquear manualmente horários livres na agenda clínica/sindical', 'Agendamento', 50, 'clinic'),
  ('manage_homologacao_slot_blocks', 'Bloquear/Desbloquear Horários (Homologação)', 'Permite bloquear e desbloquear manualmente horários livres na agenda de homologação sindical', 'Sindical - Homologação', 50, 'union')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  module_type = EXCLUDED.module_type,
  is_active = true;