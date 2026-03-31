INSERT INTO public.permission_definitions (key, name, description, category, module_type, order_index, is_active)
VALUES ('union_unblock_patients', 'Desbloquear Pacientes por Falta', 'Permite liberar o bloqueio de agendamento de pacientes que foram bloqueados por falta (no-show)', 'Sindical - Sócios', 'union', 35, true)
ON CONFLICT DO NOTHING;