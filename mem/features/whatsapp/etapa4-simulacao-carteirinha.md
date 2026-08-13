---
name: ETAPA 4 — Simulação carteirinha WhatsApp
description: Simulação controlada do fluxo CARTEIRINHA_ATUALIZACAO_NECESSARIA — preview/dry-run, template único, sem envio real
type: feature
---
- Template ÚNICO do fluxo: `carteirinha_atualizacao_necessaria` (UTILITY, pt_BR, evento `CARTEIRINHA_ATUALIZACAO_NECESSARIA`). Proibido criar fallback/variação.
- "Precisa atualizar" = carteirinha ativa com expires_at vencida ou <=30 dias, SEM payslip_request pending/received. Regra única: `deriveCardState()` em `_shared/card-state.ts`.
- Motor: `_shared/carteirinha-simulation.ts`; endpoint `whatsapp-carteirinha-simulation` (admin/super admin); painel `/admin/whatsapp-simulation`.
- PREVIEW não grava nada; DRY_RUN grava whatsapp_events + whatsapp_outbox com dry_run=true/status BLOCKED. Nunca SENT.
- Pipeline: estado → E.164 → identidade (ambíguo bloqueia) → consentimento (UNKNOWN nunca vira opt-in) → gate real `wa_can_send` → aprovação Meta → dedup.
- Envio real só após template APPROVED + WHATSAPP_OUTBOX_DRY_RUN=false + worker da ETAPA 5.
- Telefones sempre mascarados na UI. Testes de garantia: `src/test/whatsappEtapa4.test.ts`.
