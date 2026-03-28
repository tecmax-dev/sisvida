-- FIX: email_confirmations - Remove overly permissive policies that bypass email verification
DROP POLICY IF EXISTS "Allow public read by token" ON public.email_confirmations;
DROP POLICY IF EXISTS "Allow public update by token" ON public.email_confirmations;

-- FIX: mobile_app_tabs - Restrict to super admins only
DROP POLICY IF EXISTS "Authenticated users can update mobile_app_tabs" ON public.mobile_app_tabs;
DROP POLICY IF EXISTS "Authenticated users can update tabs" ON public.mobile_app_tabs;

CREATE POLICY "Super admins manage app tabs"
ON public.mobile_app_tabs
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- FIX: message_logs - Restrict INSERT to authenticated clinic members
DROP POLICY IF EXISTS "System can insert message logs" ON public.message_logs;

CREATE POLICY "Authenticated insert message logs for their clinic"
ON public.message_logs FOR INSERT
TO authenticated
WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));