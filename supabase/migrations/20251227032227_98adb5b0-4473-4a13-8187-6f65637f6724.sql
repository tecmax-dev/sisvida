-- Create chat_sectors table
CREATE TABLE public.chat_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'HelpCircle',
  color text DEFAULT '#3B82F6',
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_sectors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sectors
CREATE POLICY "Super admins can manage sectors"
ON public.chat_sectors FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view active sectors"
ON public.chat_sectors FOR SELECT
USING (is_active = true);

-- Indexes
CREATE INDEX idx_chat_sectors_active ON public.chat_sectors(is_active);
CREATE INDEX idx_chat_sectors_order ON public.chat_sectors(order_index);

-- Add sector columns to chat_conversations
ALTER TABLE public.chat_conversations 
ADD COLUMN sector_id uuid REFERENCES public.chat_sectors(id),
ADD COLUMN sector_name text;

-- Add attachment columns to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN attachment_url text,
ADD COLUMN attachment_name text,
ADD COLUMN attachment_type text,
ADD COLUMN attachment_size integer;

-- Create chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments', 
  'chat-attachments', 
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Storage policies for chat-attachments
CREATE POLICY "Users can upload to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view their conversation attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Super admins can access all chat attachments"
ON storage.objects FOR ALL
USING (
  bucket_id = 'chat-attachments' AND
  is_super_admin(auth.uid())
);

-- Trigger for updated_at on chat_sectors
CREATE TRIGGER update_chat_sectors_updated_at
BEFORE UPDATE ON public.chat_sectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();