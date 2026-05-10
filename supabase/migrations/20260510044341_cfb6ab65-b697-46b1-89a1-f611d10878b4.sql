CREATE TABLE public.whatsapp_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    content TEXT,
    message_type TEXT,
    button_id TEXT,
    session_state TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (apenas para leitura via dashboard ou admin)
CREATE POLICY "Audit logs are viewable by authenticated users" 
ON public.whatsapp_audit_logs 
FOR SELECT 
USING (true);

-- Indexação para performance
CREATE INDEX idx_whatsapp_audit_phone ON public.whatsapp_audit_logs(phone);
CREATE INDEX idx_whatsapp_audit_created_at ON public.whatsapp_audit_logs(created_at DESC);
