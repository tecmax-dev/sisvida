INSERT INTO public.permission_definitions (key, name, description, category, module_type, order_index, is_active)
VALUES ('send_professional_agenda', 'Enviar Agenda do Profissional', 'Permite enviar a agenda diária do profissional via WhatsApp', 'Agendamento', 'clinic', 6, true)
ON CONFLICT DO NOTHING;