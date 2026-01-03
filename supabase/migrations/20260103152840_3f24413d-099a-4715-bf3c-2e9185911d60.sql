-- Create table to store user settings widget preferences
CREATE TABLE public.user_settings_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  widget_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden_widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, clinic_id)
);

-- Enable RLS
ALTER TABLE public.user_settings_widgets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own widget settings"
ON public.user_settings_widgets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget settings"
ON public.user_settings_widgets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget settings"
ON public.user_settings_widgets
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_settings_widgets_updated_at
BEFORE UPDATE ON public.user_settings_widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();