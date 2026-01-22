-- Drop existing foreign key constraint and recreate with ON DELETE CASCADE
ALTER TABLE public.union_budget_audit_logs 
DROP CONSTRAINT IF EXISTS union_budget_audit_logs_budget_exercise_id_fkey;

ALTER TABLE public.union_budget_audit_logs 
ADD CONSTRAINT union_budget_audit_logs_budget_exercise_id_fkey 
FOREIGN KEY (budget_exercise_id) 
REFERENCES public.union_budget_exercises(id) 
ON DELETE CASCADE;

-- Fix union_budget_versions
ALTER TABLE public.union_budget_versions 
DROP CONSTRAINT IF EXISTS union_budget_versions_budget_exercise_id_fkey;

ALTER TABLE public.union_budget_versions 
ADD CONSTRAINT union_budget_versions_budget_exercise_id_fkey 
FOREIGN KEY (budget_exercise_id) 
REFERENCES public.union_budget_exercises(id) 
ON DELETE CASCADE;

-- Fix union_budget_approvers
ALTER TABLE public.union_budget_approvers 
DROP CONSTRAINT IF EXISTS union_budget_approvers_budget_exercise_id_fkey;

ALTER TABLE public.union_budget_approvers 
ADD CONSTRAINT union_budget_approvers_budget_exercise_id_fkey 
FOREIGN KEY (budget_exercise_id) 
REFERENCES public.union_budget_exercises(id) 
ON DELETE CASCADE;

-- Fix union_budget_revenues (references versions)
ALTER TABLE public.union_budget_revenues 
DROP CONSTRAINT IF EXISTS union_budget_revenues_budget_version_id_fkey;

ALTER TABLE public.union_budget_revenues 
ADD CONSTRAINT union_budget_revenues_budget_version_id_fkey 
FOREIGN KEY (budget_version_id) 
REFERENCES public.union_budget_versions(id) 
ON DELETE CASCADE;

-- Fix union_budget_expenses (references versions)
ALTER TABLE public.union_budget_expenses 
DROP CONSTRAINT IF EXISTS union_budget_expenses_budget_version_id_fkey;

ALTER TABLE public.union_budget_expenses 
ADD CONSTRAINT union_budget_expenses_budget_version_id_fkey 
FOREIGN KEY (budget_version_id) 
REFERENCES public.union_budget_versions(id) 
ON DELETE CASCADE;