-- Quick Responses for Chat Support
CREATE TABLE public.chat_quick_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  shortcut text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chat_quick_responses_active ON public.chat_quick_responses(is_active);
CREATE INDEX idx_chat_quick_responses_category ON public.chat_quick_responses(category);

-- Enable RLS
ALTER TABLE public.chat_quick_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can manage quick responses" ON public.chat_quick_responses
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view quick responses" ON public.chat_quick_responses
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_chat_quick_responses_updated_at
  BEFORE UPDATE ON public.chat_quick_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();