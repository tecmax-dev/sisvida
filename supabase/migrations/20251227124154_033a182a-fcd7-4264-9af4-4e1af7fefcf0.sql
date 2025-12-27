-- Tabela de orçamentos
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id),
  quote_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  
  subtotal numeric NOT NULL DEFAULT 0,
  discount_type text DEFAULT 'percentage',
  discount_value numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  
  valid_until date,
  notes text,
  internal_notes text,
  
  sent_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  converted_at timestamptz,
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de itens do orçamento
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  
  item_type text NOT NULL,
  procedure_id uuid REFERENCES public.procedures(id),
  product_id uuid REFERENCES public.stock_products(id),
  
  name text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  discount numeric DEFAULT 0,
  total numeric NOT NULL,
  
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_quotes_clinic ON public.quotes(clinic_id);
CREATE INDEX idx_quotes_patient ON public.quotes(patient_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_number ON public.quotes(quote_number);
CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);

-- Habilitar RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para quotes
CREATE POLICY "Users can view quotes of their clinics"
ON public.quotes FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can insert quotes in their clinics"
ON public.quotes FOR INSERT
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can update quotes of their clinics"
ON public.quotes FOR UPDATE
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can delete quotes of their clinics"
ON public.quotes FOR DELETE
USING (has_clinic_access(auth.uid(), clinic_id));

-- Políticas RLS para quote_items
CREATE POLICY "Users can view quote items via quote"
ON public.quote_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.quotes q 
  WHERE q.id = quote_items.quote_id 
  AND has_clinic_access(auth.uid(), q.clinic_id)
));

CREATE POLICY "Users can insert quote items via quote"
ON public.quote_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quotes q 
  WHERE q.id = quote_items.quote_id 
  AND has_clinic_access(auth.uid(), q.clinic_id)
));

CREATE POLICY "Users can update quote items via quote"
ON public.quote_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.quotes q 
  WHERE q.id = quote_items.quote_id 
  AND has_clinic_access(auth.uid(), q.clinic_id)
));

CREATE POLICY "Users can delete quote items via quote"
ON public.quote_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.quotes q 
  WHERE q.id = quote_items.quote_id 
  AND has_clinic_access(auth.uid(), q.clinic_id)
));

-- Trigger para updated_at
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar número do orçamento
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_number integer;
  result text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 10) AS integer)), 0) + 1
  INTO next_number
  FROM quotes
  WHERE clinic_id = p_clinic_id
  AND quote_number LIKE 'ORC-' || current_year || '-%';
  
  result := 'ORC-' || current_year || '-' || LPAD(next_number::text, 4, '0');
  RETURN result;
END;
$$;

-- Adicionar coluna is_sellable aos produtos do estoque
ALTER TABLE public.stock_products ADD COLUMN IF NOT EXISTS is_sellable boolean DEFAULT false;
ALTER TABLE public.stock_products ADD COLUMN IF NOT EXISTS service_duration_minutes integer;