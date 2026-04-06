-- Fix: Remove anonymous cancel vulnerability on homologacao_appointments
DROP POLICY IF EXISTS "update_homologacao_appointments_unified" ON homologacao_appointments;

-- Staff-only update policy (authenticated with homologacao access)
CREATE POLICY "update_homologacao_appointments_staff"
  ON homologacao_appointments FOR UPDATE TO authenticated
  USING (has_union_homologacao_access(auth.uid(), clinic_id))
  WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- Public cancellation only via confirmation_token
CREATE POLICY "update_homologacao_cancel_via_token"
  ON homologacao_appointments FOR UPDATE TO anon, authenticated
  USING (confirmation_token IS NOT NULL AND confirmation_token = (current_setting('request.headers', true)::json->>'x-confirmation-token')::uuid)
  WITH CHECK (status = 'cancelled');