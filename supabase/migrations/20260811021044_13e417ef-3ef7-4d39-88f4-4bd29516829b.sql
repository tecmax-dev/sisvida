UPDATE public.whatsapp_meta_templates
SET status = 'SUBMISSION_UNCONFIRMED',
    meta_template_id = NULL,
    last_synced_at = now(),
    raw_payload = COALESCE(raw_payload, '{}'::jsonb) || jsonb_build_object(
      'audit_2026_08_11', jsonb_build_object(
        'waba_id','2063797207822998',
        'graph_read_http',200,
        'template_found_on_meta', false,
        'new_submission_executed', false,
        'auto_submit','DISABLED',
        'auto_retry','DISABLED'
      )
    )
WHERE name = 'carteirinha_atualizacao_link' AND language = 'pt_BR';