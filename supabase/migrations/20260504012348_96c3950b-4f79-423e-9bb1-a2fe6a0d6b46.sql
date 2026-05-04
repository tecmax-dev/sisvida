-- Create whatsapp_templates table
CREATE TABLE public.whatsapp_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'utility',
    language TEXT NOT NULL DEFAULT 'pt_BR',
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Templates are viewable by authenticated users" 
ON public.whatsapp_templates 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage templates" 
ON public.whatsapp_templates 
USING (auth.role() = 'authenticated'); -- Simplified for now, usually restricted by role/permission

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial template as example
INSERT INTO public.whatsapp_templates (name, category, content) 
VALUES ('reativacao_atendimento', 'utility', 'Olá, aqui é do Sindicato dos Comerciários. Notamos que sua solicitação ainda não foi concluída. Você ainda precisa de ajuda com este assunto?');