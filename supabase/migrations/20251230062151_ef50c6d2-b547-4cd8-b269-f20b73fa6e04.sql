-- Make clinic_id nullable to allow global medications
ALTER TABLE public.medications ALTER COLUMN clinic_id DROP NOT NULL;

-- Add RLS policy for viewing global medications (where clinic_id is null)
CREATE POLICY "Anyone can view global medications"
ON public.medications
FOR SELECT
USING (clinic_id IS NULL);

-- Insert common Brazilian medications
INSERT INTO public.medications (name, active_ingredient, dosage, form, instructions, is_controlled, clinic_id) VALUES
-- Analgésicos e Antitérmicos
('Dipirona', 'Dipirona Sódica', '500mg', 'Comprimido', 'Tomar 1 comprimido de 6 em 6 horas se dor ou febre', false, NULL),
('Dipirona Gotas', 'Dipirona Sódica', '500mg/ml', 'Solução Oral', '20 a 40 gotas de 6 em 6 horas se dor ou febre', false, NULL),
('Paracetamol', 'Paracetamol', '750mg', 'Comprimido', 'Tomar 1 comprimido de 6 em 6 horas se dor ou febre', false, NULL),
('Paracetamol Gotas', 'Paracetamol', '200mg/ml', 'Solução Oral', '1 gota/kg de 6 em 6 horas se febre', false, NULL),
('Tylenol', 'Paracetamol', '750mg', 'Comprimido', 'Tomar 1 comprimido de 6 em 6 horas', false, NULL),
('Novalgina', 'Dipirona Sódica', '1g', 'Comprimido', 'Tomar 1 comprimido de 6 em 6 horas', false, NULL),

-- Anti-inflamatórios
('Ibuprofeno', 'Ibuprofeno', '600mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas após refeições', false, NULL),
('Ibuprofeno', 'Ibuprofeno', '400mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas após refeições', false, NULL),
('Nimesulida', 'Nimesulida', '100mg', 'Comprimido', 'Tomar 1 comprimido de 12 em 12 horas após refeições', false, NULL),
('Diclofenaco', 'Diclofenaco Sódico', '50mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas após refeições', false, NULL),
('Cetoprofeno', 'Cetoprofeno', '100mg', 'Comprimido', 'Tomar 1 comprimido de 12 em 12 horas', false, NULL),
('Meloxicam', 'Meloxicam', '15mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Prednisolona', 'Prednisolona', '20mg', 'Comprimido', 'Conforme prescrição médica', false, NULL),
('Prednisona', 'Prednisona', '20mg', 'Comprimido', 'Conforme prescrição médica', false, NULL),
('Dexametasona', 'Dexametasona', '4mg', 'Comprimido', 'Conforme prescrição médica', false, NULL),

-- Antibióticos
('Amoxicilina', 'Amoxicilina', '500mg', 'Cápsula', 'Tomar 1 cápsula de 8 em 8 horas por 7 dias', false, NULL),
('Amoxicilina + Clavulanato', 'Amoxicilina + Ácido Clavulânico', '875mg + 125mg', 'Comprimido', 'Tomar 1 comprimido de 12 em 12 horas por 7 dias', false, NULL),
('Azitromicina', 'Azitromicina', '500mg', 'Comprimido', 'Tomar 1 comprimido ao dia por 3 dias', false, NULL),
('Cefalexina', 'Cefalexina', '500mg', 'Cápsula', 'Tomar 1 cápsula de 6 em 6 horas por 7 dias', false, NULL),
('Ciprofloxacino', 'Ciprofloxacino', '500mg', 'Comprimido', 'Tomar 1 comprimido de 12 em 12 horas por 7 dias', false, NULL),
('Levofloxacino', 'Levofloxacino', '500mg', 'Comprimido', 'Tomar 1 comprimido ao dia por 7 dias', false, NULL),
('Metronidazol', 'Metronidazol', '400mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas por 7 dias', false, NULL),
('Sulfametoxazol + Trimetoprima', 'Sulfametoxazol + Trimetoprima', '800mg + 160mg', 'Comprimido', 'Tomar 1 comprimido de 12 em 12 horas por 7 dias', false, NULL),

-- Antialérgicos
('Loratadina', 'Loratadina', '10mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Desloratadina', 'Desloratadina', '5mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Fexofenadina', 'Cloridrato de Fexofenadina', '180mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Hidroxizina', 'Dicloridrato de Hidroxizina', '25mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas', false, NULL),
('Dexclorfeniramina', 'Maleato de Dexclorfeniramina', '2mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas', false, NULL),

-- Gastrintestinais
('Omeprazol', 'Omeprazol', '20mg', 'Cápsula', 'Tomar 1 cápsula em jejum', false, NULL),
('Pantoprazol', 'Pantoprazol', '40mg', 'Comprimido', 'Tomar 1 comprimido em jejum', false, NULL),
('Esomeprazol', 'Esomeprazol', '40mg', 'Comprimido', 'Tomar 1 comprimido em jejum', false, NULL),
('Domperidona', 'Domperidona', '10mg', 'Comprimido', 'Tomar 1 comprimido 30 min antes das refeições', false, NULL),
('Metoclopramida', 'Cloridrato de Metoclopramida', '10mg', 'Comprimido', 'Tomar 1 comprimido 30 min antes das refeições', false, NULL),
('Ondansetrona', 'Ondansetrona', '8mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas se náusea', false, NULL),
('Simeticona', 'Simeticona', '125mg', 'Cápsula', 'Tomar 1 cápsula após as refeições', false, NULL),
('Loperamida', 'Cloridrato de Loperamida', '2mg', 'Comprimido', 'Tomar 2 comprimidos iniciais, depois 1 após cada evacuação', false, NULL),
('Lactulose', 'Lactulose', '667mg/ml', 'Xarope', 'Tomar 15 a 30ml ao dia', false, NULL),

-- Anti-hipertensivos
('Losartana', 'Losartana Potássica', '50mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Enalapril', 'Maleato de Enalapril', '10mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Captopril', 'Captopril', '25mg', 'Comprimido', 'Tomar conforme prescrição médica', false, NULL),
('Hidroclorotiazida', 'Hidroclorotiazida', '25mg', 'Comprimido', 'Tomar 1 comprimido pela manhã', false, NULL),
('Anlodipino', 'Besilato de Anlodipino', '5mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Atenolol', 'Atenolol', '50mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Propranolol', 'Cloridrato de Propranolol', '40mg', 'Comprimido', 'Tomar conforme prescrição médica', false, NULL),
('Furosemida', 'Furosemida', '40mg', 'Comprimido', 'Tomar 1 comprimido pela manhã', false, NULL),
('Espironolactona', 'Espironolactona', '25mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),

-- Antidiabéticos
('Metformina', 'Cloridrato de Metformina', '850mg', 'Comprimido', 'Tomar 1 comprimido após refeições', false, NULL),
('Glibenclamida', 'Glibenclamida', '5mg', 'Comprimido', 'Tomar conforme prescrição médica', false, NULL),
('Gliclazida', 'Gliclazida', '60mg', 'Comprimido', 'Tomar 1 comprimido antes do café', false, NULL),

-- Hipolipemiantes
('Sinvastatina', 'Sinvastatina', '20mg', 'Comprimido', 'Tomar 1 comprimido à noite', false, NULL),
('Atorvastatina', 'Atorvastatina Cálcica', '20mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Rosuvastatina', 'Rosuvastatina Cálcica', '10mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),

-- Antidepressivos e Ansiolíticos
('Fluoxetina', 'Cloridrato de Fluoxetina', '20mg', 'Cápsula', 'Tomar 1 cápsula pela manhã', true, NULL),
('Sertralina', 'Cloridrato de Sertralina', '50mg', 'Comprimido', 'Tomar 1 comprimido ao dia', true, NULL),
('Escitalopram', 'Oxalato de Escitalopram', '10mg', 'Comprimido', 'Tomar 1 comprimido ao dia', true, NULL),
('Amitriptilina', 'Cloridrato de Amitriptilina', '25mg', 'Comprimido', 'Tomar 1 comprimido à noite', true, NULL),
('Clonazepam', 'Clonazepam', '2mg', 'Comprimido', 'Tomar conforme prescrição médica', true, NULL),
('Alprazolam', 'Alprazolam', '0,5mg', 'Comprimido', 'Tomar conforme prescrição médica', true, NULL),
('Diazepam', 'Diazepam', '10mg', 'Comprimido', 'Tomar conforme prescrição médica', true, NULL),

-- Relaxantes Musculares
('Ciclobenzaprina', 'Cloridrato de Ciclobenzaprina', '10mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas', false, NULL),
('Carisoprodol + Diclofenaco', 'Carisoprodol + Diclofenaco', '125mg + 50mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas', false, NULL),
('Orfenadrina', 'Citrato de Orfenadrina', '35mg', 'Comprimido', 'Tomar 1 comprimido de 8 em 8 horas', false, NULL),

-- Respiratórios
('Salbutamol', 'Sulfato de Salbutamol', '100mcg', 'Aerossol', '2 jatos de 6 em 6 horas ou SOS', false, NULL),
('Budesonida', 'Budesonida', '200mcg', 'Aerossol', '2 jatos de 12 em 12 horas', false, NULL),
('Acebrofilina', 'Acebrofilina', '50mg/5ml', 'Xarope', 'Tomar 10ml de 8 em 8 horas', false, NULL),
('Acetilcisteína', 'Acetilcisteína', '600mg', 'Granulado', 'Dissolver 1 envelope em água 1x ao dia', false, NULL),
('Ambroxol', 'Cloridrato de Ambroxol', '30mg/5ml', 'Xarope', 'Tomar 10ml de 8 em 8 horas', false, NULL),
('Codeína + Paracetamol', 'Fosfato de Codeína + Paracetamol', '30mg + 500mg', 'Comprimido', 'Tomar 1 comprimido de 6 em 6 horas', true, NULL),

-- Oftalmológicos
('Tobramicina Colírio', 'Tobramicina', '3mg/ml', 'Colírio', 'Aplicar 1 gota de 4 em 4 horas', false, NULL),
('Dexametasona Colírio', 'Dexametasona', '1mg/ml', 'Colírio', 'Aplicar 1 gota de 6 em 6 horas', false, NULL),
('Lágrima Artificial', 'Carmelose Sódica', '5mg/ml', 'Colírio', 'Aplicar 1 gota várias vezes ao dia', false, NULL),

-- Dermatológicos
('Cetoconazol Creme', 'Cetoconazol', '20mg/g', 'Creme', 'Aplicar na área afetada 2x ao dia', false, NULL),
('Dexametasona Creme', 'Dexametasona', '1mg/g', 'Creme', 'Aplicar na área afetada 2x ao dia', false, NULL),
('Mupirocina Pomada', 'Mupirocina', '20mg/g', 'Pomada', 'Aplicar na área afetada 3x ao dia', false, NULL),
('Neomicina + Bacitracina', 'Neomicina + Bacitracina', '5mg + 250UI/g', 'Pomada', 'Aplicar na área afetada 2 a 3x ao dia', false, NULL),

-- Suplementos e Vitaminas
('Vitamina D3', 'Colecalciferol', '2000UI', 'Cápsula', 'Tomar 1 cápsula ao dia', false, NULL),
('Vitamina C', 'Ácido Ascórbico', '1g', 'Comprimido Efervescente', 'Dissolver 1 comprimido em água 1x ao dia', false, NULL),
('Complexo B', 'Vitaminas do Complexo B', '-', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Sulfato Ferroso', 'Sulfato Ferroso', '40mg', 'Comprimido', 'Tomar 1 comprimido ao dia em jejum', false, NULL),
('Ácido Fólico', 'Ácido Fólico', '5mg', 'Comprimido', 'Tomar 1 comprimido ao dia', false, NULL),
('Cálcio + Vitamina D', 'Carbonato de Cálcio + Colecalciferol', '500mg + 400UI', 'Comprimido', 'Tomar 1 comprimido 2x ao dia', false, NULL);