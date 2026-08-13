-- Ensure the edge functions are accessible
-- Although edge functions are usually called via URL, the service_role and authenticated users 
-- need proper permissions if invoked via supabase.functions.invoke or internal routing.
-- In Lovable Cloud, we ensure general access to functions by ensuring the schema privileges.

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
