UPDATE public.whatsapp_meta_templates 
SET status = 'approved', last_synced_at = now() 
WHERE name = 'carteirinha_atualizacao_necessaria';