
CREATE SEQUENCE IF NOT EXISTS whazing_ticket_number_seq START WITH 1;

ALTER TABLE public.whazing_tickets 
ADD COLUMN IF NOT EXISTS ticket_number INTEGER UNIQUE DEFAULT nextval('whazing_ticket_number_seq');

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY opened_at ASC NULLS LAST, id) AS rn
  FROM public.whazing_tickets
  WHERE ticket_number IS NULL
)
UPDATE public.whazing_tickets t
SET ticket_number = n.rn
FROM numbered n
WHERE t.id = n.id;

SELECT setval('whazing_ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM public.whazing_tickets), 0) + 1, false);
