---
name: Fundação Integração WhatsApp Etapa 3
description: Pipeline obrigatório evento -> compliance -> outbox dry-run para toda saída WhatsApp; entrada única zapresponde-action com HMAC
type: feature
---
# Etapa 3 — Fundação segura PROSINGE + ZAPRESPONDE

- Nenhum módulo envia WhatsApp direto: emite evento via `_shared/event-bus.ts` (`whatsapp_events`, idempotente por `deduplication_key`).
- Saída passa por `_shared/outbox.ts` -> consent.ts -> send-gate.ts/wa_can_send -> `whatsapp_outbox`.
- `WHATSAPP_OUTBOX_DRY_RUN` default "true": nada é enviado, nenhuma linha vira SENT.
- Entrada única: edge function `zapresponde-action` (ações `health_check`, `carteirinha_atualizar`).
- Auth inbound: `x-prosinge-key-id/api-key/timestamp/nonce/signature`, HMAC SHA-256 sobre `keyId.timestamp.nonce.rawBody`, tolerância 300s, nonce anti-replay, rate limit por minuto.
- `clinic_id` NUNCA vem do payload — sempre derivado de `whatsapp_integration_credentials` / instance_id / phone_number_id.
- Identidade sempre escopada por clínica; múltiplos candidatos = AMBIGUOUS = handoff humano.
- Estado da carteirinha é VIRTUAL (derivado de `patient_cards.expires_at` + `payslip_requests`); não criar coluna de status.
- Consentimento: OPT_OUT bloqueia sempre; MARKETING exige opt-in; UTILITY liberado com vínculo comprovado; AUTH/critical NOT_REQUIRED.
- Doc: `docs/IMPLEMENTACAO_ETAPA3_FUNDACAO_WHATSAPP.md`.
