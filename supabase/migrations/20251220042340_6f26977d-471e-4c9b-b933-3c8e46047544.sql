-- Criar bucket público para avatares de profissionais
INSERT INTO storage.buckets (id, name, public) 
VALUES ('professional-avatars', 'professional-avatars', true);

-- Política: Usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload professional avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'professional-avatars');

-- Política: Usuários autenticados podem atualizar avatares
CREATE POLICY "Authenticated users can update professional avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'professional-avatars');

-- Política: Qualquer pessoa pode visualizar (público)
CREATE POLICY "Anyone can view professional avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'professional-avatars');

-- Política: Usuários autenticados podem deletar
CREATE POLICY "Authenticated users can delete professional avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'professional-avatars');