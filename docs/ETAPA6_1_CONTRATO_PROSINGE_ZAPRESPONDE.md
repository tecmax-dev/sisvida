# ETAPA 6.1 — RELATÓRIO DE CONTRATO PROSINGE ↔ ZAPRESPONDE

## 1. MÓDULO ADAPTER
Foi implementado o adapter canônico em `supabase/functions/_shared/zapresponde-client.ts`. Este módulo é o único ponto de saída autorizado para o gateway ZapResponde.

## 2. CONFIGURAÇÃO DE SEGURANÇA
- **DRY_RUN:** ATIVO
- **ZAPRESPONDER_SEND_ENABLED:** FALSE (Kill switch de segurança)
- **GATEWAY:** https://api.zapresponder.com.br/api/whatsapp

## 3. CONTRATO DO TEMPLATE
O template `carteirinha_atualizacao_necessaria` foi mapeado com os seguintes campos:
- **Categoria:** UTILITY
- **Idioma:** pt_BR
- **Botão (Quick Reply):** "Atualizar carteirinha"

## 4. MAPEAMENTO DE PAYLOAD (OUTBOUND)
O payload enviado ao gateway segue o padrão:
```json
{
  "phone": "5573...",
  "departmentId": "instance_uuid",
  "template": {
    "name": "carteirinha_atualizacao_necessaria",
    "language": "pt_BR",
    "components": []
  },
  "metadata": {
    "request_id": "uuid",
    "idempotency_key": "string"
  }
}
```

## 5. MAPEAMENTO DE AÇÃO (INBOUND)
O sink `zapresponde-action` está preparado para receber:
- **Action:** `carteirinha_atualizar`
- **Segurança:** HMAC SHA-256 Validado.

## 6. STATUS ATUAL
- **Mensagens Reais Enviadas:** 0
- **Meta Graph API Acionada:** 0
- **Produção:** NÃO LIBERADA
