-- Adicionar coluna para configurar tipo de visualização de mapa
ALTER TABLE clinics
ADD COLUMN map_view_type TEXT DEFAULT 'streetview';

-- Valores possíveis: 'streetview', 'map', 'both', 'none'
COMMENT ON COLUMN clinics.map_view_type IS 'Tipo de visualização de mapa na página pública: streetview, map, both, none';