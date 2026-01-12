-- Allow null clinic_id for union entity admin roles
ALTER TABLE public.user_roles ALTER COLUMN clinic_id DROP NOT NULL;