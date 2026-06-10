# Inscrição manual de campos do Webhook Meta

O endpoint central `meta-webhook` já está pronto para receber os campos abaixo,
mas eles **precisam ser assinados manualmente no painel da Meta**
(WhatsApp Manager → Configuração → Webhooks → WhatsApp Business Account).

| Campo | Finalidade | Impacto se não assinado |
|---|---|---|
| `messages` | Mensagens recebidas e status (sent/delivered/read/failed) | Sem janela de 24h tracking, sem confirmação de entrega |
| `message_template_status_update` | APPROVED / REJECTED / PAUSED / DISABLED em tempo real | Status só via `meta-sync-templates` manual; risco de bloqueio preventivo por cache defasado |
| `message_template_quality_update` | Atualiza `quality_score` | Sem visibilidade de degradação de qualidade |
| `template_category_update` | Recategorização Meta (UTILITY ↔ MARKETING) | Categoria divergente pode quebrar reputação do número |
| `account_update` | Mudanças no WABA (tier, restrições) | Sem alerta de throttling/restrição |
| `phone_number_quality_update` | Qualidade do número emissor | Sem alerta preventivo de queda de reputação |

## Enquanto não há cron `meta-sync-templates`
O sistema depende de:
1. Webhook Meta ativo com os campos acima;
2. Execução manual de `meta-sync-templates` quando necessário;
3. Auto-heal feito pelo `meta-send-template` (bloqueio + log quando status local diverge).

## Verificação rápida
- Endpoint: `https://czmnkrurkzuerrcjzbkp.supabase.co/functions/v1/meta-webhook`
- Verify Token: secret `META_WEBHOOK_VERIFY_TOKEN`
- Diagnóstico: `meta-debug-webhook` (lista `subscribed_apps` no WABA).