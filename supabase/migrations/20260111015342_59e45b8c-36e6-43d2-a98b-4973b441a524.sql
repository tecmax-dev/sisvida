-- Adicionar permissões de Contribuições Sindicais
INSERT INTO permission_definitions (key, name, description, category, order_index, is_active)
VALUES 
  ('view_contributions', 'Visualizar Contribuições', 'Visualizar contribuições sindicais e boletos', 'Contribuições', 1, true),
  ('manage_contributions', 'Gerenciar Contribuições', 'Criar, editar e excluir contribuições', 'Contribuições', 2, true),
  ('generate_boletos', 'Gerar Boletos', 'Gerar boletos via Lytex', 'Contribuições', 3, true),
  ('send_boleto_whatsapp', 'Enviar Boleto WhatsApp', 'Enviar boletos por WhatsApp', 'Contribuições', 4, true),
  ('send_boleto_email', 'Enviar Boleto E-mail', 'Enviar boletos por e-mail', 'Contribuições', 5, true),
  ('view_contribution_reports', 'Visualizar Relatórios', 'Visualizar relatórios de contribuições', 'Contribuições', 6, true),
  ('manage_debt_negotiations', 'Gerenciar Negociações', 'Criar e gerenciar negociações de débitos', 'Contribuições', 7, true)
ON CONFLICT (key) DO NOTHING;