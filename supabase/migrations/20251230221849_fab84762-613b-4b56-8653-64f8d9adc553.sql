-- Add insurance_plan_id column to patient_dependents table
ALTER TABLE public.patient_dependents
ADD COLUMN insurance_plan_id uuid REFERENCES public.insurance_plans(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.patient_dependents.insurance_plan_id IS 'Insurance plan associated with this dependent';