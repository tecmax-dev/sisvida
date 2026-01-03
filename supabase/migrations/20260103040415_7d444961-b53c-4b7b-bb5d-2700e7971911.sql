-- Inserir add-on do Multiatendimento WhatsApp
INSERT INTO public.subscription_addons (key, name, description, monthly_price, features, is_active)
VALUES (
  'whatsapp_multiattendance',
  'Multiatendimento WhatsApp',
  'Módulo de atendimento humano no WhatsApp com múltiplos operadores, filas, setores e Kanban',
  199.00,
  '["Múltiplos operadores", "Gestão de filas", "Setores/Departamentos", "Kanban de tickets", "Respostas rápidas", "Histórico completo", "Transferências", "Relatórios"]',
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features;