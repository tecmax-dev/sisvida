-- Remove duplicate thursday slot for Dr Jose Alcides (clinic 89e7585e)
-- Cause of incorrect time listings in WhatsApp flow.
UPDATE public.professionals
SET schedule = jsonb_set(
  schedule,
  '{thursday,slots}',
  '[{"end": "09:40", "start": "08:00"}]'::jsonb
)
WHERE id = '5d6815c1-d176-411d-9a58-d99b89202696'
  AND schedule->'thursday'->'slots' = '[{"end": "09:40", "start": "08:00"}, {"end": "09:40", "start": "08:00"}]'::jsonb;
