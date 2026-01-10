-- Create expense_liquidation_history table for check liquidation tracking
CREATE TABLE IF NOT EXISTS public.expense_liquidation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  check_number TEXT NOT NULL,
  liquidation_date DATE NOT NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id),
  liquidated_by UUID NOT NULL,
  transaction_ids UUID[] NOT NULL,
  total_value NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on expense_liquidation_history
ALTER TABLE public.expense_liquidation_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for expense_liquidation_history
CREATE POLICY "Users can view expense liquidation history for their clinic"
ON public.expense_liquidation_history
FOR SELECT
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Clinic admins can manage expense liquidation history"
ON public.expense_liquidation_history
FOR ALL
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'administrative')
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'administrative')
  )
  OR public.is_super_admin(auth.uid())
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expense_liquidation_history_clinic_id ON public.expense_liquidation_history(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expense_liquidation_history_check_number ON public.expense_liquidation_history(check_number);

-- Enable realtime for expense_liquidation_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_liquidation_history;