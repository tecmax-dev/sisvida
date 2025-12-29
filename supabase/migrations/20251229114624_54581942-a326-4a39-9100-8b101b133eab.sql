-- Permitir que admins de clínica cadastrem feriados municipais
CREATE POLICY "Clinic admins can insert municipal holidays"
ON public.municipal_holidays
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- Permitir que admins de clínica cadastrem feriados estaduais
CREATE POLICY "Clinic admins can insert state holidays"
ON public.state_holidays
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- Permitir que admins de clínica cadastrem feriados nacionais
CREATE POLICY "Clinic admins can insert national holidays"
ON public.national_holidays
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);