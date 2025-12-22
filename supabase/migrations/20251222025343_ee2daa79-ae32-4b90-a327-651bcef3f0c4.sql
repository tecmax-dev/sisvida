-- Criar policy para permitir leitura pública dos procedimentos ativos
CREATE POLICY "Allow public read of active procedures" 
ON public.procedures 
FOR SELECT 
TO public 
USING (is_active = true);