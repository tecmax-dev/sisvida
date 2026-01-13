-- Remover tabela se já foi criada parcialmente
DROP TABLE IF EXISTS public.union_payment_history;

-- Tabela para histórico de pagamentos a fornecedores (somente consulta)
CREATE TABLE public.union_payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES public.union_entities(id),
  supplier_id UUID REFERENCES public.union_suppliers(id),
  supplier_name TEXT NOT NULL,
  description TEXT,
  chart_of_accounts TEXT,
  operational_unit TEXT,
  bank_account TEXT,
  due_date DATE,
  status TEXT DEFAULT 'paid',
  gross_value NUMERIC(15,2) DEFAULT 0,
  net_value NUMERIC(15,2) DEFAULT 0,
  paid_at DATE,
  check_number TEXT,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para otimizar buscas
CREATE INDEX idx_union_payment_history_entity ON public.union_payment_history(entity_id);
CREATE INDEX idx_union_payment_history_supplier ON public.union_payment_history(supplier_id);
CREATE INDEX idx_union_payment_history_due_date ON public.union_payment_history(due_date);
CREATE INDEX idx_union_payment_history_paid_at ON public.union_payment_history(paid_at);
CREATE INDEX idx_union_payment_history_check ON public.union_payment_history(check_number);
CREATE INDEX idx_union_payment_history_supplier_name ON public.union_payment_history(supplier_name);

-- RLS
ALTER TABLE public.union_payment_history ENABLE ROW LEVEL SECURITY;

-- Política para entidades sindicais
CREATE POLICY "Union entity users can view payment history"
  ON public.union_payment_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.union_entities ue
      WHERE ue.id = entity_id
      AND (
        ue.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.clinic_id = ue.clinic_id
        )
        OR public.is_super_admin(auth.uid())
      )
    )
  );

CREATE POLICY "Union entity admins can insert payment history"
  ON public.union_payment_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.union_entities ue
      WHERE ue.id = entity_id
      AND (
        ue.user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
      )
    )
  );

CREATE POLICY "Union entity admins can delete payment history"
  ON public.union_payment_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.union_entities ue
      WHERE ue.id = entity_id
      AND (
        ue.user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
      )
    )
  );