-- Fix: patients logged-in (authenticated) could not read union_entities, so the mobile /sindicato app couldn't load president_signature_url.
-- NOTE: This does not widen exposure vs current setup because anon already has access to active entities.

CREATE POLICY "Authenticated can view active union entities for affiliation"
ON public.union_entities
FOR SELECT
TO authenticated
USING (status = 'ativa'::union_entity_status);
