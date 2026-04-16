-- Fix 5: Configure Realtime security with RLS policies
-- Enable RLS on realtime schema messages table
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Create policy to restrict channel subscriptions by clinic context
-- Users can only subscribe to channels that match their clinic_id in JWT claims
CREATE POLICY "Restrict realtime subscriptions by clinic" 
ON realtime.messages 
FOR SELECT 
TO authenticated
USING (
    -- Allow if the channel topic contains the user's clinic_id from JWT
    (realtime.topic() LIKE '%' || COALESCE(auth.jwt() ->> 'clinic_id', '') || '%')
    OR 
    -- Or if user is a super admin
    (auth.jwt() ->> 'role' = 'super_admin')
);

COMMENT ON POLICY "Restrict realtime subscriptions by clinic" 
ON realtime.messages 
IS 'Restricts realtime channel access to users matching their clinic_id from JWT claims';