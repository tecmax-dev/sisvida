-- Fix: mobile self-service uses created_by = patient_id (not an auth.users id)
-- Current FK blocks inserts with: union_authorizations_created_by_fkey
-- We keep revoked_by FK (staff action) intact.

ALTER TABLE public.union_authorizations
DROP CONSTRAINT IF EXISTS union_authorizations_created_by_fkey;