-- Permitir que o público veja templates ativos (necessário para exibir perguntas na página pública)
CREATE POLICY "Public can view active templates"
ON anamnese_templates FOR SELECT
USING (is_active = true);