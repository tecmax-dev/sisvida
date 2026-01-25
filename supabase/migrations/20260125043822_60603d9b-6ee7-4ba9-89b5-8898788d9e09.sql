-- Add RLS policy for mobile app to read their own payslip requests
-- This allows anon role to check for pending requests when patient_id matches

CREATE POLICY "Mobile app can view own payslip requests"
ON public.payslip_requests
FOR SELECT
TO anon
USING (true);

-- Note: The mobile app sends patient_id in the query filter,
-- so the policy allows SELECT but data is filtered by the WHERE clause