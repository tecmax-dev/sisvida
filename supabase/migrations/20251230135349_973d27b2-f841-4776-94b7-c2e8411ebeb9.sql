-- Create exams table with common Brazilian medical exams
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  code TEXT, -- TUSS code if applicable
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view global exams and their clinic exams"
ON public.exams FOR SELECT
USING (is_global = true OR clinic_id IN (
  SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Clinic users can create exams for their clinic"
ON public.exams FOR INSERT
WITH CHECK (clinic_id IN (
  SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Clinic users can update their clinic exams"
ON public.exams FOR UPDATE
USING (clinic_id IN (
  SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Super admins can manage all exams"
ON public.exams FOR ALL
USING (is_super_admin(auth.uid()));

-- Create index for faster search
CREATE INDEX idx_exams_name ON public.exams USING gin(to_tsvector('portuguese', name));
CREATE INDEX idx_exams_category ON public.exams(category);
CREATE INDEX idx_exams_clinic_id ON public.exams(clinic_id);

-- Insert common Brazilian medical exams
INSERT INTO public.exams (name, category, description, is_global) VALUES
-- Hemograma e Coagulação
('Hemograma Completo', 'Hematologia', 'Análise completa das células sanguíneas', true),
('Hemoglobina Glicada (HbA1c)', 'Hematologia', 'Controle glicêmico dos últimos 3 meses', true),
('Coagulograma', 'Hematologia', 'Tempo de protrombina e TTPA', true),
('Tempo de Protrombina (TP)', 'Hematologia', 'Avaliação da coagulação', true),
('Tempo de Tromboplastina Parcial (TTPA)', 'Hematologia', 'Avaliação da via intrínseca', true),
('Contagem de Plaquetas', 'Hematologia', 'Contagem de trombócitos', true),
('Reticulócitos', 'Hematologia', 'Avaliação da produção de hemácias', true),
('VHS (Velocidade de Hemossedimentação)', 'Hematologia', 'Marcador inflamatório', true),

-- Bioquímica
('Glicemia de Jejum', 'Bioquímica', 'Dosagem de glicose em jejum', true),
('Glicemia Pós-Prandial', 'Bioquímica', 'Glicose após refeição', true),
('Curva Glicêmica (TOTG)', 'Bioquímica', 'Teste oral de tolerância à glicose', true),
('Ureia', 'Bioquímica', 'Avaliação da função renal', true),
('Creatinina', 'Bioquímica', 'Avaliação da função renal', true),
('Ácido Úrico', 'Bioquímica', 'Dosagem de ácido úrico sérico', true),
('TGO (AST)', 'Bioquímica', 'Enzima hepática', true),
('TGP (ALT)', 'Bioquímica', 'Enzima hepática', true),
('Gama GT', 'Bioquímica', 'Enzima hepática e biliar', true),
('Fosfatase Alcalina', 'Bioquímica', 'Enzima óssea e hepática', true),
('Bilirrubinas Totais e Frações', 'Bioquímica', 'Avaliação hepática', true),
('Proteínas Totais e Frações', 'Bioquímica', 'Albumina e globulinas', true),
('Albumina', 'Bioquímica', 'Proteína sérica', true),

-- Perfil Lipídico
('Colesterol Total', 'Lipídios', 'Dosagem de colesterol', true),
('HDL Colesterol', 'Lipídios', 'Colesterol bom', true),
('LDL Colesterol', 'Lipídios', 'Colesterol ruim', true),
('VLDL Colesterol', 'Lipídios', 'Lipoproteína de muito baixa densidade', true),
('Triglicerídeos', 'Lipídios', 'Gorduras sanguíneas', true),
('Perfil Lipídico Completo', 'Lipídios', 'CT, HDL, LDL, VLDL e Triglicerídeos', true),

-- Eletrólitos
('Sódio', 'Eletrólitos', 'Dosagem de sódio sérico', true),
('Potássio', 'Eletrólitos', 'Dosagem de potássio sérico', true),
('Cálcio', 'Eletrólitos', 'Dosagem de cálcio sérico', true),
('Cálcio Iônico', 'Eletrólitos', 'Fração ionizada do cálcio', true),
('Magnésio', 'Eletrólitos', 'Dosagem de magnésio sérico', true),
('Fósforo', 'Eletrólitos', 'Dosagem de fósforo sérico', true),
('Cloreto', 'Eletrólitos', 'Dosagem de cloreto sérico', true),

-- Tireoide
('TSH', 'Tireoide', 'Hormônio estimulante da tireoide', true),
('T4 Livre', 'Tireoide', 'Tiroxina livre', true),
('T4 Total', 'Tireoide', 'Tiroxina total', true),
('T3 Livre', 'Tireoide', 'Triiodotironina livre', true),
('T3 Total', 'Tireoide', 'Triiodotironina total', true),
('Anti-TPO', 'Tireoide', 'Anticorpo anti-peroxidase', true),
('Anti-Tireoglobulina', 'Tireoide', 'Anticorpo anti-tireoglobulina', true),

-- Hormônios
('FSH', 'Hormônios', 'Hormônio folículo-estimulante', true),
('LH', 'Hormônios', 'Hormônio luteinizante', true),
('Estradiol', 'Hormônios', 'Hormônio feminino', true),
('Progesterona', 'Hormônios', 'Hormônio feminino', true),
('Testosterona Total', 'Hormônios', 'Hormônio masculino', true),
('Testosterona Livre', 'Hormônios', 'Fração livre da testosterona', true),
('Prolactina', 'Hormônios', 'Hormônio hipofisário', true),
('Cortisol', 'Hormônios', 'Hormônio do estresse', true),
('DHEA-S', 'Hormônios', 'Sulfato de dehidroepiandrosterona', true),
('Insulina', 'Hormônios', 'Hormônio pancreático', true),
('GH (Hormônio do Crescimento)', 'Hormônios', 'Somatotropina', true),
('IGF-1', 'Hormônios', 'Fator de crescimento', true),

-- Vitaminas e Minerais
('Vitamina D (25-OH)', 'Vitaminas', 'Dosagem de vitamina D', true),
('Vitamina B12', 'Vitaminas', 'Cobalamina', true),
('Ácido Fólico', 'Vitaminas', 'Vitamina B9', true),
('Ferro Sérico', 'Vitaminas', 'Dosagem de ferro', true),
('Ferritina', 'Vitaminas', 'Estoque de ferro', true),
('Transferrina', 'Vitaminas', 'Proteína de transporte do ferro', true),
('Capacidade de Ligação do Ferro (TIBC)', 'Vitaminas', 'Capacidade total de ligação', true),
('Zinco', 'Vitaminas', 'Dosagem de zinco sérico', true),

-- Marcadores Inflamatórios
('PCR (Proteína C Reativa)', 'Inflamação', 'Marcador inflamatório', true),
('PCR Ultrassensível', 'Inflamação', 'Risco cardiovascular', true),
('Fibrinogênio', 'Inflamação', 'Proteína de fase aguda', true),
('Alfa-1-Glicoproteína Ácida', 'Inflamação', 'Proteína de fase aguda', true),

-- Marcadores Tumorais
('PSA Total', 'Marcadores Tumorais', 'Antígeno prostático específico', true),
('PSA Livre', 'Marcadores Tumorais', 'Fração livre do PSA', true),
('CEA', 'Marcadores Tumorais', 'Antígeno carcinoembrionário', true),
('CA 125', 'Marcadores Tumorais', 'Marcador de câncer ovariano', true),
('CA 19-9', 'Marcadores Tumorais', 'Marcador pancreático', true),
('CA 15-3', 'Marcadores Tumorais', 'Marcador de câncer de mama', true),
('AFP (Alfa-Fetoproteína)', 'Marcadores Tumorais', 'Marcador hepático', true),
('Beta-HCG', 'Marcadores Tumorais', 'Hormônio gonadotrofina coriônica', true),

-- Urinálise
('Urina Tipo I (EAS)', 'Urinálise', 'Exame de urina rotina', true),
('Urocultura', 'Urinálise', 'Cultura de urina', true),
('Microalbuminúria', 'Urinálise', 'Albumina na urina', true),
('Proteinúria de 24h', 'Urinálise', 'Proteína em urina de 24 horas', true),
('Clearance de Creatinina', 'Urinálise', 'Taxa de filtração glomerular', true),
('Relação Albumina/Creatinina', 'Urinálise', 'Avaliação renal', true),

-- Fezes
('Parasitológico de Fezes', 'Fezes', 'Pesquisa de parasitas', true),
('Coprocultura', 'Fezes', 'Cultura de fezes', true),
('Sangue Oculto nas Fezes', 'Fezes', 'Pesquisa de sangue', true),

-- Sorologias
('HIV 1 e 2', 'Sorologia', 'Pesquisa de anticorpos anti-HIV', true),
('VDRL', 'Sorologia', 'Pesquisa de sífilis', true),
('FTA-ABS', 'Sorologia', 'Confirmação de sífilis', true),
('Hepatite A (Anti-HAV)', 'Sorologia', 'Anticorpos hepatite A', true),
('Hepatite B (HBsAg)', 'Sorologia', 'Antígeno de superfície', true),
('Hepatite B (Anti-HBs)', 'Sorologia', 'Anticorpo anti-HBs', true),
('Hepatite B (Anti-HBc)', 'Sorologia', 'Anticorpo anti-core', true),
('Hepatite C (Anti-HCV)', 'Sorologia', 'Anticorpos hepatite C', true),
('Toxoplasmose IgG e IgM', 'Sorologia', 'Anticorpos toxoplasma', true),
('Rubéola IgG e IgM', 'Sorologia', 'Anticorpos rubéola', true),
('Citomegalovírus IgG e IgM', 'Sorologia', 'Anticorpos CMV', true),
('Dengue IgG e IgM', 'Sorologia', 'Anticorpos dengue', true),

-- Imunologia
('FAN (Fator Antinuclear)', 'Imunologia', 'Pesquisa de autoanticorpos', true),
('Fator Reumatoide', 'Imunologia', 'Marcador de artrite reumatoide', true),
('Anti-CCP', 'Imunologia', 'Anticorpo anti-peptídeo citrulinado', true),
('Complemento C3', 'Imunologia', 'Componente do complemento', true),
('Complemento C4', 'Imunologia', 'Componente do complemento', true),
('IgA, IgG, IgM', 'Imunologia', 'Imunoglobulinas', true),
('IgE Total', 'Imunologia', 'Imunoglobulina E', true),

-- Cardiologia
('CPK (Creatinoquinase)', 'Cardiologia', 'Enzima muscular', true),
('CK-MB', 'Cardiologia', 'Fração cardíaca da CPK', true),
('Troponina I', 'Cardiologia', 'Marcador de infarto', true),
('Troponina T', 'Cardiologia', 'Marcador de infarto', true),
('BNP', 'Cardiologia', 'Peptídeo natriurético', true),
('NT-proBNP', 'Cardiologia', 'Marcador de insuficiência cardíaca', true),
('Homocisteína', 'Cardiologia', 'Fator de risco cardiovascular', true),
('Lipoproteína(a)', 'Cardiologia', 'Fator de risco cardiovascular', true),

-- Imagem
('Raio-X de Tórax PA e Perfil', 'Imagem', 'Radiografia torácica', true),
('Raio-X de Coluna Lombar', 'Imagem', 'Radiografia da coluna', true),
('Raio-X de Coluna Cervical', 'Imagem', 'Radiografia da coluna cervical', true),
('Ultrassonografia de Abdome Total', 'Imagem', 'USG abdominal completo', true),
('Ultrassonografia Pélvica', 'Imagem', 'USG de pelve', true),
('Ultrassonografia Transvaginal', 'Imagem', 'USG endovaginal', true),
('Ultrassonografia de Tireoide', 'Imagem', 'USG cervical', true),
('Ultrassonografia de Mama', 'Imagem', 'USG mamária bilateral', true),
('Ultrassonografia de Próstata', 'Imagem', 'USG prostático', true),
('Ultrassonografia Obstétrica', 'Imagem', 'USG gestacional', true),
('Ultrassonografia com Doppler', 'Imagem', 'USG vascular', true),
('Ecocardiograma', 'Imagem', 'Ultrassom do coração', true),
('Mamografia Bilateral', 'Imagem', 'Rastreamento de câncer de mama', true),
('Tomografia de Crânio', 'Imagem', 'TC de cabeça', true),
('Tomografia de Tórax', 'Imagem', 'TC torácica', true),
('Tomografia de Abdome', 'Imagem', 'TC abdominal', true),
('Ressonância Magnética de Crânio', 'Imagem', 'RM cerebral', true),
('Ressonância Magnética de Coluna', 'Imagem', 'RM da coluna vertebral', true),
('Densitometria Óssea', 'Imagem', 'Avaliação de massa óssea', true),

-- Cardiológicos
('Eletrocardiograma (ECG)', 'Cardiológico', 'Registro elétrico do coração', true),
('Teste Ergométrico', 'Cardiológico', 'Teste de esforço', true),
('Holter 24 horas', 'Cardiológico', 'Monitorização cardíaca', true),
('MAPA 24 horas', 'Cardiológico', 'Monitorização da pressão arterial', true),

-- Endoscopia
('Endoscopia Digestiva Alta', 'Endoscopia', 'EDA', true),
('Colonoscopia', 'Endoscopia', 'Exame do cólon', true),
('Retossigmoidoscopia', 'Endoscopia', 'Exame do reto e sigmoide', true),

-- Oftalmologia
('Acuidade Visual', 'Oftalmologia', 'Teste de visão', true),
('Fundoscopia', 'Oftalmologia', 'Exame de fundo de olho', true),
('Tonometria', 'Oftalmologia', 'Pressão intraocular', true),
('Campo Visual', 'Oftalmologia', 'Campimetria', true),

-- Outros
('Espermograma', 'Outros', 'Análise do sêmen', true),
('Papanicolau', 'Outros', 'Citologia oncótica cervical', true),
('Audiometria', 'Outros', 'Teste de audição', true),
('Espirometria', 'Outros', 'Prova de função pulmonar', true),
('Polissonografia', 'Outros', 'Estudo do sono', true),
('Eletroencefalograma (EEG)', 'Outros', 'Atividade elétrica cerebral', true),
('Eletromiografia', 'Outros', 'Atividade elétrica muscular', true),
('Biópsia', 'Outros', 'Análise histopatológica', true);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.exams;