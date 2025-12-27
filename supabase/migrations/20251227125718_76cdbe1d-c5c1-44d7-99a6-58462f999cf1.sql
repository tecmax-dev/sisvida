-- Adicionar novas permissões para Catálogo e Orçamentos
INSERT INTO public.permission_definitions (key, name, description, category, order_index, is_active)
VALUES 
  -- Catálogo
  ('view_catalog', 'Visualizar Catálogo', 'Acesso ao catálogo de produtos e serviços', 'Catálogo', 1, true),
  ('manage_catalog', 'Gerenciar Catálogo', 'Criar/editar produtos e serviços do catálogo', 'Catálogo', 2, true),
  -- Orçamentos (view_budgets já existe)
  ('manage_budgets', 'Gerenciar Orçamentos', 'Criar/editar orçamentos', 'Orçamentos', 2, true),
  ('send_budget_whatsapp', 'Enviar Orçamento WhatsApp', 'Enviar orçamentos via WhatsApp', 'Orçamentos', 3, true),
  ('approve_budgets', 'Aprovar/Rejeitar Orçamentos', 'Aprovar ou rejeitar orçamentos', 'Orçamentos', 4, true),
  ('convert_budgets', 'Converter Orçamentos', 'Converter orçamentos em agendamento/financeiro', 'Orçamentos', 5, true)
ON CONFLICT (key) DO NOTHING;