-- Fix whazing_messages: remove the public ALL policy that grants everyone access
DROP POLICY IF EXISTS "Service role can manage whazing messages" ON public.whazing_messages;

-- Fix professional_schedule_exceptions: remove overly permissive authenticated policy
DROP POLICY IF EXISTS "Authenticated can view schedule exceptions" ON public.professional_schedule_exceptions;