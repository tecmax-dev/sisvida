-- Add professional_id column to user_roles to link users to specific professionals
ALTER TABLE public.user_roles 
ADD COLUMN professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_user_roles_professional_id ON public.user_roles(professional_id);

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.user_roles.professional_id IS 'When set, this user can only view the schedule of the linked professional';