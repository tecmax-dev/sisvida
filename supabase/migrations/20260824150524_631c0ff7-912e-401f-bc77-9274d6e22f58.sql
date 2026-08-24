
-- Ensure confirmation columns exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmed_at') THEN
        ALTER TABLE public.appointments ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'cancelled_at') THEN
        ALTER TABLE public.appointments ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE public.appointments ADD COLUMN cancellation_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmation_token') THEN
        ALTER TABLE public.appointments ADD COLUMN confirmation_token UUID DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Fix interaction lock in appointment UI by ensuring RLS is correct
GRANT ALL ON public.appointments TO service_role;
GRANT SELECT, UPDATE ON public.appointments TO authenticated;

-- Ensure RLS doesn't block updates from authenticated users for their own appointments
CREATE POLICY "Users can update their own appointments_v2"
ON public.appointments
FOR UPDATE
TO authenticated
USING (auth.uid() = patient_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professional') OR public.has_role(auth.uid(), 'receptionist'))
WITH CHECK (auth.uid() = patient_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professional') OR public.has_role(auth.uid(), 'receptionist'));
