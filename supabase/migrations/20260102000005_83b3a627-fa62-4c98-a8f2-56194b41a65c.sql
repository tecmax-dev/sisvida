-- Insert WhatsApp integration features into system_features
INSERT INTO public.system_features (key, name, description, category, icon, is_active) VALUES
('whatsapp_evolution_api', 'Evolution API', 'Integração com Evolution API para envio de mensagens WhatsApp', 'whatsapp', 'MessageSquare', true),
('whatsapp_twilio', 'Twilio WhatsApp', 'Integração com Twilio para envio de mensagens WhatsApp', 'whatsapp', 'Phone', true),
('whatsapp_campaigns', 'Campanhas WhatsApp', 'Envio de campanhas de marketing em massa via WhatsApp', 'whatsapp', 'Megaphone', true),
('whatsapp_automations', 'Automações WhatsApp', 'Fluxos automatizados de mensagens via WhatsApp', 'whatsapp', 'Workflow', true),
('whatsapp_ai_assistant', 'Assistente IA WhatsApp', 'Assistente de IA para atendimento automatizado via WhatsApp', 'whatsapp', 'Bot', true),
('whatsapp_birthday_messages', 'Mensagens de Aniversário', 'Envio automático de mensagens de aniversário via WhatsApp', 'whatsapp', 'Cake', true),
('whatsapp_appointment_reminders', 'Lembretes de Consulta', 'Envio automático de lembretes de consultas via WhatsApp', 'whatsapp', 'Bell', true),
('whatsapp_booking', 'Agendamento por WhatsApp', 'Permitir que pacientes agendem consultas via WhatsApp', 'whatsapp', 'Calendar', true),
('whatsapp_documents', 'Envio de Documentos', 'Envio de documentos e arquivos via WhatsApp', 'whatsapp', 'FileText', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon;