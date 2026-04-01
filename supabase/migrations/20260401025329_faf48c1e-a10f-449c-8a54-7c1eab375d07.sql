-- Create a security definer function to check if the current auth user IS the patient
CREATE OR REPLACE FUNCTION public.is_current_patient(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'patient_id')::uuid = p_patient_id,
    false
  )
$$;

-- PATIENTS: Allow patients to read their own record
CREATE POLICY "Patients can view own record"
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (public.is_current_patient(id));

-- PATIENTS: Allow patients to update their own record
CREATE POLICY "Patients can update own record"
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (public.is_current_patient(id))
  WITH CHECK (public.is_current_patient(id));

-- PATIENT_DEPENDENTS: Allow patients to view their own dependents
CREATE POLICY "Patients can view own dependents"
  ON public.patient_dependents
  FOR SELECT
  TO authenticated
  USING (public.is_current_patient(patient_id));

-- PATIENT_CARDS: Allow patients to view their own cards
CREATE POLICY "Patients can view own cards"
  ON public.patient_cards
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_patient(patient_id)
    OR patient_id IN (
      SELECT pd.id FROM public.patient_dependents pd WHERE public.is_current_patient(pd.patient_id)
    )
  );

-- APPOINTMENTS: Allow patients to view their own appointments
CREATE POLICY "Patients can view own appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.is_current_patient(patient_id));

-- APPOINTMENTS: Allow patients to update their own appointments
CREATE POLICY "Patients can update own appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (public.is_current_patient(patient_id))
  WITH CHECK (public.is_current_patient(patient_id));

-- UNION_AUTHORIZATIONS: Allow patients to view their own authorizations
CREATE POLICY "Patients can view own authorizations"
  ON public.union_authorizations
  FOR SELECT
  TO authenticated
  USING (public.is_current_patient(patient_id));

-- SINDICAL_ASSOCIADOS: Allow patients to view their own filiacao by CPF
CREATE POLICY "Patients can view own sindical associado"
  ON public.sindical_associados
  FOR SELECT
  TO authenticated
  USING (
    cpf IN (
      SELECT p.cpf FROM public.patients p WHERE public.is_current_patient(p.id) AND p.cpf IS NOT NULL
    )
  );