-- Inserir plano Trial padrão se não existir
INSERT INTO subscription_plans (name, description, max_professionals, monthly_price, is_default_trial, is_public, features)
SELECT 'Trial', 'Plano gratuito de avaliação por 14 dias', 1, 0, true, false, '["Agendamento online", "Prontuário eletrônico", "1 profissional"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE is_default_trial = true);