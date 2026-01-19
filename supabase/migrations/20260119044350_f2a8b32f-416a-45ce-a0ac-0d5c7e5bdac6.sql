-- Add mobile app tab for legal appointments
INSERT INTO mobile_app_tabs (tab_key, tab_name, tab_category, is_active, order_index)
VALUES ('agendamento-juridico', 'Agendamento Jurídico', 'services', true, 10)
ON CONFLICT (tab_key) DO NOTHING;