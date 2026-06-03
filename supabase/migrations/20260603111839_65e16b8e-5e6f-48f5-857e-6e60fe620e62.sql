DROP POLICY IF EXISTS "Public can create anamnesis" ON public.anamnesis;

DROP POLICY IF EXISTS "Public can view appointment slot blocks" ON public.appointment_slot_blocks;

CREATE POLICY "Clinic members can view appointment slot blocks"
ON public.appointment_slot_blocks
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_clinic_access(auth.uid(), clinic_id)
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = appointment_slot_blocks.clinic_id
      AND ur.role = 'professional'::app_role
  )
);

CREATE OR REPLACE FUNCTION public.has_union_homologacao_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    is_super_admin(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND clinic_id = _clinic_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.professionals
      WHERE user_id = _user_id AND clinic_id = _clinic_id AND is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.union_entities
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND status = 'ativa'::union_entity_status
    )
$function$;

DROP POLICY IF EXISTS "Service can insert booking sessions" ON public.whatsapp_booking_sessions;
DROP POLICY IF EXISTS "Service can update booking sessions" ON public.whatsapp_booking_sessions;

CREATE POLICY "Service role can insert booking sessions"
ON public.whatsapp_booking_sessions
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update booking sessions"
ON public.whatsapp_booking_sessions
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);