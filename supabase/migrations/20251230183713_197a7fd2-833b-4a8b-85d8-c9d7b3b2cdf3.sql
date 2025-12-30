-- Create table to store Mercado Pago payment records
CREATE TABLE public.mercado_pago_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  external_reference TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('pix', 'boleto')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled', 'expired', 'rejected', 'refunded')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  payer_email TEXT,
  payer_name TEXT,
  payer_cpf TEXT,
  
  -- Mercado Pago response data
  mp_payment_id TEXT,
  mp_status TEXT,
  mp_status_detail TEXT,
  
  -- PIX specific fields
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  pix_expiration_date TIMESTAMPTZ,
  
  -- Boleto specific fields
  boleto_url TEXT,
  boleto_barcode TEXT,
  boleto_due_date DATE,
  
  -- Relation to other entities (optional)
  financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  patient_package_id UUID REFERENCES public.patient_packages(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  -- Metadata
  source TEXT NOT NULL CHECK (source IN ('transaction', 'package', 'quote', 'booking')),
  webhook_received_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mercado_pago_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view payments from their clinics"
  ON public.mercado_pago_payments
  FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can create payments for their clinics"
  ON public.mercado_pago_payments
  FOR INSERT
  WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Users can update payments for their clinics"
  ON public.mercado_pago_payments
  FOR UPDATE
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- Policy for webhook updates (no auth required)
CREATE POLICY "Webhook can update payment status"
  ON public.mercado_pago_payments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_mp_payments_clinic ON public.mercado_pago_payments(clinic_id);
CREATE INDEX idx_mp_payments_external_ref ON public.mercado_pago_payments(external_reference);
CREATE INDEX idx_mp_payments_mp_id ON public.mercado_pago_payments(mp_payment_id);
CREATE INDEX idx_mp_payments_status ON public.mercado_pago_payments(status);
CREATE INDEX idx_mp_payments_transaction ON public.mercado_pago_payments(financial_transaction_id);
CREATE INDEX idx_mp_payments_package ON public.mercado_pago_payments(patient_package_id);
CREATE INDEX idx_mp_payments_quote ON public.mercado_pago_payments(quote_id);
CREATE INDEX idx_mp_payments_appointment ON public.mercado_pago_payments(appointment_id);

-- Trigger for updated_at
CREATE TRIGGER update_mp_payments_updated_at
  BEFORE UPDATE ON public.mercado_pago_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mercado_pago_payments;