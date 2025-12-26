-- Categorias de estoque
CREATE TABLE public.stock_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Fornecedores
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  contact_name text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Produtos de estoque
CREATE TABLE public.stock_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.stock_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  description text,
  unit text DEFAULT 'un',
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric DEFAULT 0,
  max_stock numeric,
  cost_price numeric DEFAULT 0,
  sale_price numeric DEFAULT 0,
  location text,
  expiry_date date,
  batch_number text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Movimentações de estoque
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entry', 'exit', 'adjustment', 'transfer')),
  quantity numeric NOT NULL,
  previous_stock numeric NOT NULL,
  new_stock numeric NOT NULL,
  unit_cost numeric,
  total_cost numeric,
  reason text,
  reference_id uuid,
  reference_type text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Alertas de estoque
CREATE TABLE public.stock_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock', 'expiring', 'expired', 'overstock')),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_categories
CREATE POLICY "Users can view stock categories of their clinics"
  ON public.stock_categories FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage stock categories"
  ON public.stock_categories FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers of their clinics"
  ON public.suppliers FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage suppliers"
  ON public.suppliers FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for stock_products
CREATE POLICY "Users can view stock products of their clinics"
  ON public.stock_products FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage stock products"
  ON public.stock_products FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for stock_movements
CREATE POLICY "Users can view stock movements of their clinics"
  ON public.stock_movements FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can insert stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage stock movements"
  ON public.stock_movements FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for stock_alerts
CREATE POLICY "Users can view stock alerts of their clinics"
  ON public.stock_alerts FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "System can insert stock alerts"
  ON public.stock_alerts FOR INSERT
  WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage stock alerts"
  ON public.stock_alerts FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- Indexes
CREATE INDEX idx_stock_products_clinic ON public.stock_products(clinic_id);
CREATE INDEX idx_stock_products_category ON public.stock_products(category_id);
CREATE INDEX idx_stock_products_supplier ON public.stock_products(supplier_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_clinic ON public.stock_movements(clinic_id);
CREATE INDEX idx_stock_alerts_product ON public.stock_alerts(product_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_stock_categories_updated_at
  BEFORE UPDATE ON public.stock_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_products_updated_at
  BEFORE UPDATE ON public.stock_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();