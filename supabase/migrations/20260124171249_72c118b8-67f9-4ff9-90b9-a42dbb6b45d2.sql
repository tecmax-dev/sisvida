-- Add is_pinned column to union_app_content for pinning posts
ALTER TABLE public.union_app_content 
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Create index for faster querying of pinned items
CREATE INDEX IF NOT EXISTS idx_union_app_content_pinned 
ON public.union_app_content (clinic_id, content_type, is_pinned DESC, order_index);

-- Add comment for documentation
COMMENT ON COLUMN public.union_app_content.is_pinned IS 'When true, the content will appear at the top of its category list';