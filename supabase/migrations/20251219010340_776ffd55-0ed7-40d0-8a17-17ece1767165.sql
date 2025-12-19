-- Criar enum para categoria de especialidade
CREATE TYPE specialty_category AS ENUM (
  'medical',
  'dental',
  'aesthetic',
  'therapy',
  'massage'
);

-- Tabela de especialidades
CREATE TABLE specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category specialty_category NOT NULL,
  registration_prefix text,
  is_dental boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Tabela de relacionamento N:N entre profissionais e especialidades
CREATE TABLE professional_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  specialty_id uuid REFERENCES specialties(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(professional_id, specialty_id)
);

-- Habilitar RLS
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_specialties ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para specialties
CREATE POLICY "Public can view active specialties" ON specialties 
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage specialties" ON specialties 
  FOR ALL USING (is_super_admin(auth.uid()));

-- Políticas RLS para professional_specialties
CREATE POLICY "Users can view professional specialties of their clinics" 
  ON professional_specialties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM professionals p 
    WHERE p.id = professional_id 
    AND has_clinic_access(auth.uid(), p.clinic_id)
  ));

CREATE POLICY "Admins can manage professional specialties" 
  ON professional_specialties FOR ALL
  USING (EXISTS (
    SELECT 1 FROM professionals p 
    WHERE p.id = professional_id 
    AND is_clinic_admin(auth.uid(), p.clinic_id)
  ));

CREATE POLICY "Public can view active professional specialties"
  ON professional_specialties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM professionals p 
    WHERE p.id = professional_id 
    AND p.is_active = true
  ));

-- Inserir especialidades iniciais
INSERT INTO specialties (name, category, registration_prefix, is_dental) VALUES
-- Médico
('Clínica Geral', 'medical', 'CRM', false),
('Cardiologia', 'medical', 'CRM', false),
('Dermatologia', 'medical', 'CRM', false),
('Endocrinologia', 'medical', 'CRM', false),
('Gastroenterologia', 'medical', 'CRM', false),
('Ginecologia', 'medical', 'CRM', false),
('Neurologia', 'medical', 'CRM', false),
('Oftalmologia', 'medical', 'CRM', false),
('Ortopedia', 'medical', 'CRM', false),
('Otorrinolaringologia', 'medical', 'CRM', false),
('Pediatria', 'medical', 'CRM', false),
('Psiquiatria', 'medical', 'CRM', false),
('Urologia', 'medical', 'CRM', false),
('Geriatria', 'medical', 'CRM', false),
('Medicina do Trabalho', 'medical', 'CRM', false),

-- Odontológico (is_dental = true)
('Clínica Geral Odontológica', 'dental', 'CRO', true),
('Ortodontia', 'dental', 'CRO', true),
('Endodontia', 'dental', 'CRO', true),
('Periodontia', 'dental', 'CRO', true),
('Implantodontia', 'dental', 'CRO', true),
('Prótese Dentária', 'dental', 'CRO', true),
('Odontopediatria', 'dental', 'CRO', true),
('Cirurgia Bucomaxilofacial', 'dental', 'CRO', true),
('Estética Dental', 'dental', 'CRO', true),
('Harmonização Orofacial', 'dental', 'CRO', true),

-- Estética
('Estética Facial', 'aesthetic', 'CRBM', false),
('Estética Corporal', 'aesthetic', 'CRBM', false),
('Micropigmentação', 'aesthetic', null, false),
('Design de Sobrancelhas', 'aesthetic', null, false),
('Podologia', 'aesthetic', null, false),

-- Terapias
('Fisioterapia', 'therapy', 'CREFITO', false),
('Fonoaudiologia', 'therapy', 'CRFa', false),
('Terapia Ocupacional', 'therapy', 'CREFITO', false),
('Psicologia', 'therapy', 'CRP', false),
('Nutrição', 'therapy', 'CRN', false),
('Acupuntura', 'therapy', null, false),
('Quiropraxia', 'therapy', null, false),

-- Massoterapia
('Massagem Relaxante', 'massage', null, false),
('Massagem Terapêutica', 'massage', null, false),
('Drenagem Linfática', 'massage', null, false),
('Reflexologia', 'massage', null, false),
('Shiatsu', 'massage', null, false),
('Quick Massage', 'massage', null, false);