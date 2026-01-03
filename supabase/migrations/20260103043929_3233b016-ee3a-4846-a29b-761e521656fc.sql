
-- WhatsApp Multi-attendance Module Tables

-- Sectors table
CREATE TABLE IF NOT EXISTS public.whatsapp_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Operators table
CREATE TABLE IF NOT EXISTS public.whatsapp_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'operator' CHECK (role IN ('operator', 'supervisor', 'admin')),
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  max_concurrent_tickets INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Operator sectors junction table
CREATE TABLE IF NOT EXISTS public.whatsapp_operator_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.whatsapp_operators(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.whatsapp_sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(operator_id, sector_id)
);

-- Contacts table
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  profile_pic_url TEXT,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, phone)
);

-- Tickets table
CREATE TABLE IF NOT EXISTS public.whatsapp_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES public.whatsapp_sectors(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES public.whatsapp_operators(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'waiting', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.whatsapp_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.whatsapp_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'operator', 'system', 'bot')),
  sender_id UUID,
  sender_name TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quick replies table
CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES public.whatsapp_sectors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Module settings table
CREATE TABLE IF NOT EXISTS public.whatsapp_module_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
  welcome_message TEXT DEFAULT 'Olá! Seja bem-vindo ao nosso atendimento.',
  away_message TEXT DEFAULT 'No momento não há operadores disponíveis.',
  closed_message TEXT DEFAULT 'Nosso atendimento está encerrado.',
  auto_assign BOOLEAN DEFAULT true,
  max_idle_time_minutes INTEGER DEFAULT 30,
  working_hours JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_operator_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_module_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_sectors
CREATE POLICY "Clinic members can view sectors" ON public.whatsapp_sectors
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage sectors" ON public.whatsapp_sectors
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for whatsapp_operators
CREATE POLICY "Clinic members can view operators" ON public.whatsapp_operators
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage operators" ON public.whatsapp_operators
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Operators can update own status" ON public.whatsapp_operators
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for whatsapp_operator_sectors
CREATE POLICY "Clinic members can view operator sectors" ON public.whatsapp_operator_sectors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.whatsapp_operators o WHERE o.id = operator_id AND has_clinic_access(auth.uid(), o.clinic_id))
  );

CREATE POLICY "Clinic admins can manage operator sectors" ON public.whatsapp_operator_sectors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.whatsapp_operators o WHERE o.id = operator_id AND is_clinic_admin(auth.uid(), o.clinic_id))
  );

-- RLS Policies for whatsapp_contacts
CREATE POLICY "Clinic members can view contacts" ON public.whatsapp_contacts
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can manage contacts" ON public.whatsapp_contacts
  FOR ALL USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS Policies for whatsapp_tickets
CREATE POLICY "Clinic members can view tickets" ON public.whatsapp_tickets
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can manage tickets" ON public.whatsapp_tickets
  FOR ALL USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS Policies for whatsapp_ticket_messages
CREATE POLICY "Clinic members can view messages" ON public.whatsapp_ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.whatsapp_tickets t WHERE t.id = ticket_id AND has_clinic_access(auth.uid(), t.clinic_id))
  );

CREATE POLICY "Clinic members can insert messages" ON public.whatsapp_ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.whatsapp_tickets t WHERE t.id = ticket_id AND has_clinic_access(auth.uid(), t.clinic_id))
  );

-- RLS Policies for whatsapp_quick_replies
CREATE POLICY "Clinic members can view quick replies" ON public.whatsapp_quick_replies
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage quick replies" ON public.whatsapp_quick_replies
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for whatsapp_module_settings
CREATE POLICY "Clinic members can view settings" ON public.whatsapp_module_settings
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage settings" ON public.whatsapp_module_settings
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_tickets;

-- Function to check module access
CREATE OR REPLACE FUNCTION public.check_whatsapp_multiattendance_access(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clinic_addons ca
    JOIN public.subscription_addons sa ON sa.id = ca.addon_id
    WHERE ca.clinic_id = p_clinic_id 
    AND ca.status = 'active'
    AND sa.slug = 'whatsapp-multiattendance'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
