-- Tabela de notificações do sistema
CREATE TABLE public.system_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('maintenance', 'billing', 'feature', 'alert', 'info')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  target_type TEXT NOT NULL DEFAULT 'all_clinics' CHECK (target_type IN ('all_clinics', 'specific_clinics', 'specific_plans')),
  target_ids UUID[] DEFAULT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de leitura de notificações por clínica/usuário
CREATE TABLE public.clinic_notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.system_notifications(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_id, clinic_id, user_id)
);

-- Índices para performance
CREATE INDEX idx_system_notifications_active ON public.system_notifications(is_active, scheduled_at);
CREATE INDEX idx_system_notifications_expires ON public.system_notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_clinic_notification_reads_notification ON public.clinic_notification_reads(notification_id);
CREATE INDEX idx_clinic_notification_reads_clinic_user ON public.clinic_notification_reads(clinic_id, user_id);

-- Enable RLS
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_notification_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies para system_notifications
CREATE POLICY "Super admins can manage all notifications"
ON public.system_notifications
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Clinics can view active notifications for them"
ON public.system_notifications
FOR SELECT
USING (
  is_active = true
  AND (scheduled_at IS NULL OR scheduled_at <= now())
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    target_type = 'all_clinics'
    OR (
      target_type = 'specific_clinics' 
      AND target_ids && ARRAY(SELECT get_user_clinic_ids(auth.uid()))
    )
    OR (
      target_type = 'specific_plans'
      AND EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.clinic_id IN (SELECT get_user_clinic_ids(auth.uid()))
        AND s.plan_id = ANY(target_ids)
      )
    )
  )
);

-- RLS Policies para clinic_notification_reads
CREATE POLICY "Users can view their own reads"
ON public.clinic_notification_reads
FOR SELECT
USING (user_id = auth.uid() OR has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can mark notifications as read"
ON public.clinic_notification_reads
FOR INSERT
WITH CHECK (user_id = auth.uid() AND has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Super admins can view all reads"
ON public.clinic_notification_reads
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_system_notifications_updated_at
BEFORE UPDATE ON public.system_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;