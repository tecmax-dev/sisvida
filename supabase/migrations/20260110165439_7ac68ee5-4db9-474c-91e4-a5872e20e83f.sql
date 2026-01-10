-- =============================================
-- FASE 1: Adicionar campos necessários para página pública e protocolo
-- =============================================

-- Primeiro, adicionar colunas SEM a constraint UNIQUE no slug
ALTER TABLE public.homologacao_professionals 
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state_code text,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric,
ADD COLUMN IF NOT EXISTS manager_phone text,
ADD COLUMN IF NOT EXISTS public_booking_enabled boolean DEFAULT true;

-- Criar extensão unaccent se não existir
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Gerar slugs únicos para profissionais existentes
-- Usando o ID como sufixo para garantir unicidade
UPDATE public.homologacao_professionals
SET slug = lower(regexp_replace(
  translate(name, 'áàãâéèêíìîóòõôúùûçÁÀÃÂÉÈÊÍÌÎÓÒÕÔÚÙÛÇñÑ', 'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUCnN'),
  '[^a-z0-9]+', '-', 'g'
)) || '-' || substring(id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

-- Agora podemos adicionar a constraint UNIQUE
ALTER TABLE public.homologacao_professionals
ADD CONSTRAINT homologacao_professionals_slug_unique UNIQUE (slug);

-- Criar índice para busca por slug
CREATE INDEX IF NOT EXISTS idx_homologacao_professionals_slug ON public.homologacao_professionals(slug);

-- Criar sequência para protocolo
CREATE SEQUENCE IF NOT EXISTS homologacao_protocol_seq START 1;

-- Função para gerar número de protocolo único
CREATE OR REPLACE FUNCTION public.generate_homologacao_protocol(p_clinic_id uuid)
RETURNS text AS $$
DECLARE
  v_year text;
  v_sequence integer;
  v_protocol text;
BEGIN
  v_year := to_char(current_date, 'YYYY');
  
  -- Buscar o próximo número da sequência para esta clínica no ano atual
  SELECT COALESCE(MAX(
    CASE 
      WHEN protocol_number ~ ('^HOM-' || v_year || '-\d+$') 
      THEN CAST(split_part(protocol_number, '-', 3) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM public.homologacao_appointments
  WHERE clinic_id = p_clinic_id;
  
  -- Gerar protocolo no formato HOM-YYYY-XXXXX
  v_protocol := 'HOM-' || v_year || '-' || lpad(v_sequence::text, 5, '0');
  
  RETURN v_protocol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar slug único para profissional
CREATE OR REPLACE FUNCTION public.generate_professional_slug()
RETURNS trigger AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Gerar slug base a partir do nome
  base_slug := lower(regexp_replace(unaccent(NEW.name), '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Verificar unicidade e adicionar sufixo se necessário
  final_slug := base_slug;
  WHILE EXISTS (
    SELECT 1 FROM public.homologacao_professionals 
    WHERE slug = final_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar slug automaticamente quando não informado
DROP TRIGGER IF EXISTS trigger_generate_professional_slug ON public.homologacao_professionals;
CREATE TRIGGER trigger_generate_professional_slug
BEFORE INSERT OR UPDATE ON public.homologacao_professionals
FOR EACH ROW
WHEN (NEW.slug IS NULL OR NEW.slug = '')
EXECUTE FUNCTION public.generate_professional_slug();

-- =============================================
-- FASE 2: Políticas RLS para acesso público
-- =============================================

-- Política para acesso público aos horários (para mostrar disponibilidade)
DROP POLICY IF EXISTS "Public can read active homologacao_schedules" ON public.homologacao_schedules;
CREATE POLICY "Public can read active homologacao_schedules"
ON public.homologacao_schedules
FOR SELECT
USING (is_active = true);

-- Política para inserção pública de agendamentos (página pública)
DROP POLICY IF EXISTS "Public can create homologacao_appointments" ON public.homologacao_appointments;
CREATE POLICY "Public can create homologacao_appointments"
ON public.homologacao_appointments
FOR INSERT
WITH CHECK (true);

-- Política para consulta pública de agendamentos (verificar disponibilidade)
DROP POLICY IF EXISTS "Public can check appointment availability" ON public.homologacao_appointments;
CREATE POLICY "Public can check appointment availability"
ON public.homologacao_appointments
FOR SELECT
USING (true);

-- Política para leitura pública de tipos de serviço
DROP POLICY IF EXISTS "Public can read active homologacao_service_types" ON public.homologacao_service_types;
CREATE POLICY "Public can read active homologacao_service_types"
ON public.homologacao_service_types
FOR SELECT
USING (is_active = true);

-- =============================================
-- FASE 3: Coluna adicional para notificações
-- =============================================

ALTER TABLE public.homologacao_notifications
ADD COLUMN IF NOT EXISTS protocol_sent boolean DEFAULT false;