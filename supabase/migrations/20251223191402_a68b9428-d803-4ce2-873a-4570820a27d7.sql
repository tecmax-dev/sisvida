-- Create table for ICD-10 codes
CREATE TABLE public.icd10_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for fast search
CREATE INDEX idx_icd10_code ON public.icd10_codes(code);
CREATE INDEX idx_icd10_description ON public.icd10_codes USING gin(to_tsvector('portuguese', description));

-- Enable RLS
ALTER TABLE public.icd10_codes ENABLE ROW LEVEL SECURITY;

-- Public read access (ICD codes are public data)
CREATE POLICY "Public can read ICD codes" ON public.icd10_codes FOR SELECT USING (true);

-- Insert common ICD-10 codes used in Brazilian clinics
INSERT INTO public.icd10_codes (code, description, category) VALUES
-- Respiratory diseases (most common)
('J00', 'Resfriado comum', 'Doenças do aparelho respiratório'),
('J01', 'Sinusite aguda', 'Doenças do aparelho respiratório'),
('J02', 'Faringite aguda', 'Doenças do aparelho respiratório'),
('J03', 'Amigdalite aguda', 'Doenças do aparelho respiratório'),
('J04', 'Laringite e traqueíte agudas', 'Doenças do aparelho respiratório'),
('J06', 'Infecções agudas das vias aéreas superiores', 'Doenças do aparelho respiratório'),
('J10', 'Gripe devida a vírus da influenza identificado', 'Doenças do aparelho respiratório'),
('J11', 'Gripe devida a vírus não identificado', 'Doenças do aparelho respiratório'),
('J18', 'Pneumonia por microrganismo não especificado', 'Doenças do aparelho respiratório'),
('J20', 'Bronquite aguda', 'Doenças do aparelho respiratório'),
('J30', 'Rinite alérgica e vasomotora', 'Doenças do aparelho respiratório'),
('J31', 'Rinite, rinofaringite e faringite crônicas', 'Doenças do aparelho respiratório'),
('J40', 'Bronquite não especificada como aguda ou crônica', 'Doenças do aparelho respiratório'),
('J45', 'Asma', 'Doenças do aparelho respiratório'),
('J98', 'Outros transtornos respiratórios', 'Doenças do aparelho respiratório'),

-- Infectious diseases
('A09', 'Diarreia e gastroenterite de origem infecciosa presumível', 'Doenças infecciosas'),
('B34', 'Infecção viral de localização não especificada', 'Doenças infecciosas'),
('B35', 'Dermatofitose (micose)', 'Doenças infecciosas'),
('B37', 'Candidíase', 'Doenças infecciosas'),

-- Musculoskeletal diseases
('M54', 'Dorsalgia (dor nas costas)', 'Doenças do sistema osteomuscular'),
('M54.5', 'Dor lombar baixa (lombalgia)', 'Doenças do sistema osteomuscular'),
('M54.2', 'Cervicalgia', 'Doenças do sistema osteomuscular'),
('M79', 'Outros transtornos de tecidos moles', 'Doenças do sistema osteomuscular'),
('M79.1', 'Mialgia', 'Doenças do sistema osteomuscular'),
('M25', 'Outros transtornos articulares', 'Doenças do sistema osteomuscular'),
('M75', 'Lesões do ombro', 'Doenças do sistema osteomuscular'),
('M77', 'Outras entesopatias', 'Doenças do sistema osteomuscular'),

-- Digestive diseases
('K29', 'Gastrite e duodenite', 'Doenças do aparelho digestivo'),
('K30', 'Dispepsia', 'Doenças do aparelho digestivo'),
('K59', 'Outros transtornos funcionais do intestino', 'Doenças do aparelho digestivo'),
('K21', 'Doença de refluxo gastroesofágico', 'Doenças do aparelho digestivo'),

-- Urinary diseases
('N30', 'Cistite (infecção urinária)', 'Doenças do aparelho geniturinário'),
('N39', 'Outros transtornos do aparelho urinário', 'Doenças do aparelho geniturinário'),

-- Mental health
('F32', 'Episódio depressivo', 'Transtornos mentais'),
('F41', 'Outros transtornos ansiosos', 'Transtornos mentais'),
('F41.0', 'Transtorno de pânico', 'Transtornos mentais'),
('F41.1', 'Ansiedade generalizada', 'Transtornos mentais'),
('F43', 'Reações ao estresse grave e transtornos de adaptação', 'Transtornos mentais'),
('F51', 'Transtornos não-orgânicos do sono', 'Transtornos mentais'),

-- Nervous system
('G43', 'Enxaqueca', 'Doenças do sistema nervoso'),
('G44', 'Outras síndromes de cefaleia', 'Doenças do sistema nervoso'),
('G47', 'Distúrbios do sono', 'Doenças do sistema nervoso'),

-- Circulatory system
('I10', 'Hipertensão essencial (primária)', 'Doenças do aparelho circulatório'),
('I20', 'Angina pectoris', 'Doenças do aparelho circulatório'),
('I25', 'Doença isquêmica crônica do coração', 'Doenças do aparelho circulatório'),

-- Endocrine diseases
('E10', 'Diabetes mellitus tipo 1', 'Doenças endócrinas'),
('E11', 'Diabetes mellitus tipo 2', 'Doenças endócrinas'),
('E66', 'Obesidade', 'Doenças endócrinas'),
('E78', 'Distúrbios do metabolismo de lipoproteínas', 'Doenças endócrinas'),

-- Skin diseases
('L20', 'Dermatite atópica', 'Doenças da pele'),
('L23', 'Dermatite alérgica de contato', 'Doenças da pele'),
('L50', 'Urticária', 'Doenças da pele'),
('L60', 'Transtornos das unhas', 'Doenças da pele'),

-- Eye diseases
('H10', 'Conjuntivite', 'Doenças do olho'),
('H52', 'Transtornos de refração e da acomodação', 'Doenças do olho'),

-- Ear diseases
('H65', 'Otite média não-supurativa', 'Doenças do ouvido'),
('H66', 'Otite média supurativa e as não especificadas', 'Doenças do ouvido'),

-- Injuries
('S00', 'Traumatismo superficial da cabeça', 'Lesões e traumatismos'),
('S60', 'Traumatismo superficial do punho e da mão', 'Lesões e traumatismos'),
('S90', 'Traumatismo superficial do tornozelo e do pé', 'Lesões e traumatismos'),
('T14', 'Traumatismo de região não especificada do corpo', 'Lesões e traumatismos'),

-- Health factors
('Z00', 'Exame geral e investigação de pessoas sem queixas', 'Fatores que influenciam a saúde'),
('Z01', 'Outros exames e investigações especiais', 'Fatores que influenciam a saúde'),
('Z02', 'Exame e observação por outras razões', 'Fatores que influenciam a saúde'),
('Z73', 'Problemas relacionados com a organização do modo de vida', 'Fatores que influenciam a saúde'),
('Z76', 'Pessoas em contato com serviços de saúde em outras circunstâncias', 'Fatores que influenciam a saúde'),

-- Pregnancy related
('O80', 'Parto único espontâneo', 'Gravidez, parto e puerpério'),
('Z32', 'Exame ou teste de gravidez', 'Fatores que influenciam a saúde'),
('Z34', 'Supervisão de gravidez normal', 'Fatores que influenciam a saúde'),

-- Additional common codes
('R10', 'Dor abdominal e pélvica', 'Sintomas e sinais'),
('R50', 'Febre de origem desconhecida', 'Sintomas e sinais'),
('R51', 'Cefaleia', 'Sintomas e sinais'),
('R05', 'Tosse', 'Sintomas e sinais'),
('R06', 'Anormalidades da respiração', 'Sintomas e sinais'),
('R11', 'Náusea e vômitos', 'Sintomas e sinais'),
('R53', 'Mal-estar, fadiga', 'Sintomas e sinais'),
('R42', 'Tontura e instabilidade', 'Sintomas e sinais'),

-- Dental codes (for dental clinics)
('K00', 'Distúrbios do desenvolvimento e da erupção dos dentes', 'Doenças do aparelho digestivo'),
('K01', 'Dentes inclusos e impactados', 'Doenças do aparelho digestivo'),
('K02', 'Cárie dentária', 'Doenças do aparelho digestivo'),
('K03', 'Outras doenças dos tecidos duros dos dentes', 'Doenças do aparelho digestivo'),
('K04', 'Doenças da polpa e dos tecidos periapicais', 'Doenças do aparelho digestivo'),
('K05', 'Gengivite e doenças periodontais', 'Doenças do aparelho digestivo'),
('K06', 'Outros transtornos da gengiva e do rebordo alveolar', 'Doenças do aparelho digestivo'),
('K08', 'Outros transtornos dos dentes e estruturas de suporte', 'Doenças do aparelho digestivo'),
('K12', 'Estomatite e lesões afins', 'Doenças do aparelho digestivo'),
('K13', 'Outras doenças do lábio e da mucosa oral', 'Doenças do aparelho digestivo');