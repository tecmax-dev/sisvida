# ETAPA 6 — AUDITORIA DA INTEGRAÇÃO PROSINGE ↔ ZAPRESPONDE

## 1. ZAPRESPONDE / EVOLUTION API
- **URL Base:** `https://evo.tecmax.net` (identificada em `evolution_configs`)
- **Gateway Interno:** `send-whatsapp-zapresponder` e `zapresponder-bot-actions`
- **Configuração Canônica:** Tabela `zapster_configs` (is_active=true, instance_id identificado).
- **Account ID / Inbox:** O sistema utiliza `instance_name` (Ex: `73f527a6_1768840057737`) como isolador de tenant em vez de IDs nativos do Chatwoot no nível da API de envio.

## 2. FLUXO DE ENVIO DE TEMPLATES
- **Serviço:** `send-whatsapp-zapresponder`
- **Endpoint:** `POST /messages/send` na ZapResponder API.
- **Payload:**
  ```json
  {
    "phone": "55...",
    "message": "...",
    "departmentId": "instance_id",
    "template": {
      "name": "template_name",
      "language": "pt_BR",
      "components": []
    }
  }
  ```
- **Suporte a Templates:** SIM. A API aceita o objeto `template` diretamente.
- **Provider Message ID:** Retornado pela API após o envio (armazenado em `whatsapp_outbox.provider_message_id`).

## 3. CONTROLE DE JANELA E WEBHOOKS
- **Janela 24h:** O controle é realizado pela API externa (ZapResponder/Meta). O PROSINGE não recalcula a janela, ele tenta o envio e trata o erro retornado ou utiliza templates para iniciar conversas.
- **Webhook de Entrada:** A função `zapresponde-action` está preparada para receber interações via HMAC e autenticação por `api_key_id`.
- **Quick Reply:** Detectável via `zapresponde-action` através do parâmetro `action` no payload.

## 4. ARQUITETURA DE SEGURANÇA
- **Tokens Meta:** O PROSINGE **NÃO** armazena nem utiliza Tokens Meta diretamente para envio. Toda comunicação é mediada pela ZapResponder API.
- **Autenticação:** O mecanismo de HMAC implementado em `zapresponde-action` e `inbound-auth.ts` é o padrão ouro para esta integração, garantindo que apenas o ZAPRESPONDE autenticado possa disparar ações no PROSINGE.

## 5. CONCLUSÃO DA AUDITORIA
A infraestrutura para a Etapa 6 está 90% pronta, utilizando `zapresponde-action` como o "Sink" seguro para eventos vindos do WhatsApp.

### O QUE PRECISA SER CRIADO
1. **Endpoint de Consulta de Status de Template:** Uma função que consulte a ZapResponder API para validar se `carteirinha_atualizacao_necessaria` está disponível antes de tentar o envio.
2. **Normalização de Botões:** Mapear o payload do botão "Atualizar carteirinha" para chamar o endpoint `zapresponde-action` com os parâmetros corretos.
