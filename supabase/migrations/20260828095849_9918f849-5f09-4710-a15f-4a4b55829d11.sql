-- 1) clinics: remove full-row anon exposure of owner PII via column-level grants
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'clinics'
    AND column_name NOT IN (
      'owner_cpf','owner_name','email',
      'blocked_by','blocked_reason','blocked_at',
      'maintenance_by','maintenance_reason','maintenance_at',
      'app_unavailable_by'
    );

  EXECUTE 'REVOKE SELECT ON public.clinics FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.clinics TO anon', cols);
END $$;

-- 2) global_config: stop exposing evolution API credentials publicly
DROP POLICY IF EXISTS "Public can read trial signup flag" ON public.global_config;
REVOKE SELECT ON public.global_config FROM anon;

CREATE OR REPLACE FUNCTION public.get_trial_signup_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT trial_signup_enabled FROM public.global_config LIMIT 1), true);
$$;

GRANT EXECUTE ON FUNCTION public.get_trial_signup_enabled() TO anon, authenticated;

-- 3) portal logs / reissue requests: validate referenced entity exists on insert
DROP POLICY IF EXISTS "Anyone can insert portal logs" ON public.accounting_office_portal_logs;
CREATE POLICY "Portal logs insert for existing office"
ON public.accounting_office_portal_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  accounting_office_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.accounting_offices ao WHERE ao.id = accounting_office_id)
);

DROP POLICY IF EXISTS "Allow public insert on employer_portal_logs" ON public.employer_portal_logs;
CREATE POLICY "Employer portal logs insert for existing employer"
ON public.employer_portal_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  employer_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.employers e WHERE e.id = employer_id)
);

DROP POLICY IF EXISTS "Allow public insert on reissue_requests" ON public.contribution_reissue_requests;
CREATE POLICY "Reissue requests insert for existing employer"
ON public.contribution_reissue_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  employer_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.employers e WHERE e.id = employer_id)
);