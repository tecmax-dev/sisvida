-- Adicionar coluna para URL de embed personalizado do mapa
ALTER TABLE clinics 
ADD COLUMN custom_map_embed_url TEXT;