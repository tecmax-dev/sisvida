-- 1. Remove the dangerous public SELECT policy on members table
DROP POLICY IF EXISTS "Allow public select for portal access" ON public.members;

-- 2. Fix lytex_webhook_logs: require authentication even when clinic_id is NULL
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.lytex_webhook_logs;
CREATE POLICY "Admins can view webhook logs"
  ON public.lytex_webhook_logs
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_clinic_admin(auth.uid(), clinic_id)
  );