-- Fix RLS policies for public booking: change from RESTRICTIVE to PERMISSIVE

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can create patients" ON public.patients;
DROP POLICY IF EXISTS "Public can create anamnesis" ON public.anamnesis;

-- Recreate as PERMISSIVE policies (default behavior when AS clause is omitted)
CREATE POLICY "Public can create appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (status = 'scheduled'::appointment_status);

CREATE POLICY "Public can create patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can create anamnesis" 
ON public.anamnesis 
FOR INSERT 
WITH CHECK (true);