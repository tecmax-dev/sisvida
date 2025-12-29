-- Add granular permissions for Anamnesis Templates
INSERT INTO permission_definitions (key, name, description, category, order_index, is_active)
VALUES 
  ('view_anamnesis_templates', 'Visualizar Templates de Anamnese', 'Ver templates de anamnese', 'Prontuário', 8, true),
  ('edit_anamnesis_templates', 'Editar Templates de Anamnese', 'Editar templates de anamnese existentes', 'Prontuário', 9, true),
  ('delete_anamnesis_templates', 'Excluir Templates de Anamnese', 'Excluir templates de anamnese', 'Prontuário', 10, true),
  ('send_anamnesis_whatsapp', 'Enviar Anamnese por WhatsApp', 'Enviar formulários de anamnese por WhatsApp', 'Prontuário', 11, true)
ON CONFLICT (key) DO NOTHING;