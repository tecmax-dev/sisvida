ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS admission_date date NULL,
ADD COLUMN IF NOT EXISTS job_function text NULL;