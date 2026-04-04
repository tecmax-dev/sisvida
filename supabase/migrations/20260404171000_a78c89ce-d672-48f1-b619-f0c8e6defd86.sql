
DROP FUNCTION IF EXISTS public.get_whazing_tickets_for_clinic(uuid);

CREATE FUNCTION public.get_whazing_tickets_for_clinic(p_clinic_id uuid)
RETURNS TABLE(
  id uuid,
  ticket_id text,
  ticket_number integer,
  contact_number text,
  contact_name text,
  status text,
  queue_id text,
  user_id_whazing text,
  subject text,
  last_message text,
  opened_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz,
  holiday_notified boolean,
  holiday_notified_at timestamptz,
  bot_active boolean,
  assigned_queue_id uuid,
  profile_pic_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wt.id,
    wt.ticket_id,
    wt.ticket_number,
    wt.contact_number,
    wt.contact_name,
    wt.status,
    wt.queue_id,
    wt.user_id_whazing,
    wt.subject,
    wt.last_message,
    wt.opened_at,
    wt.updated_at,
    wt.closed_at,
    wt.holiday_notified,
    wt.holiday_notified_at,
    wt.bot_active,
    wt.assigned_queue_id,
    wt.profile_pic_url
  FROM whazing_tickets wt
  ORDER BY wt.updated_at DESC NULLS LAST;
$$;
