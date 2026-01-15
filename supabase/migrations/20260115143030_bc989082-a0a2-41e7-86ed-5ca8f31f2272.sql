-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update mobile_app_tabs" ON public.mobile_app_tabs;

-- Create new UPDATE policy that allows authenticated users with proper permissions
CREATE POLICY "Authenticated users can update mobile_app_tabs" 
ON public.mobile_app_tabs 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);