-- Align destination schema to accept source data during migration

-- 1) Profiles: allow legacy/source column used in some projects
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS data_criacao text;

-- 2) Roles: accept 'moderator' role coming from source
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role'
      AND n.nspname = 'public'
  ) THEN
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END $$;
