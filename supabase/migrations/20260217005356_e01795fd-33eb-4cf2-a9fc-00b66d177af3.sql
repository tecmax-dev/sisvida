
-- Hide Trial from landing page
UPDATE subscription_plans SET is_public = false WHERE id = '44232f22-cef2-4d4b-b804-abee081e2e12';

-- Update Basic to Essence R$299
UPDATE subscription_plans SET name = 'Essence', monthly_price = 299.00, description = 'Plano Essence com recursos essenciais' WHERE id = 'fca17e1d-57a8-4095-bb83-09e6f0325ac1';

-- Update Pro to "Sob Medida" with price 0 (custom)
UPDATE subscription_plans SET name = 'Sob Medida', monthly_price = 0.00, description = 'Plano personalizado para sua necessidade' WHERE id = 'be3574ea-835f-4a4a-8bc0-14cdc5d20b32';
