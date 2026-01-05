-- Inserir features para o módulo de contribuições sindicais e negociações
INSERT INTO system_features (key, name, description, category, is_active)
VALUES 
  ('employer_contributions', 'Contribuições Sindicais', 'Gestão de contribuições sindicais de empresas empregadoras', 'financial', true),
  ('debt_negotiations', 'Negociações de Débitos', 'Negociação e parcelamento de contribuições em atraso', 'financial', true)
ON CONFLICT (key) DO NOTHING;