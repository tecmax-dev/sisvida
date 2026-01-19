-- Permitir leitura pública do conteúdo ativo do app (para o app mobile)
CREATE POLICY "Public can read active app content"
ON public.union_app_content
FOR SELECT
TO anon, authenticated
USING (is_active = true);