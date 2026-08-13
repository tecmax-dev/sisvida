# ETAPA 4 — Simulação controlada do fluxo de atualização de carteirinha

**Status:** implantada em modo simulação. **Nenhuma mensagem WhatsApp é enviada.**

## 1. Template oficial (único)

| Campo | Valor |
|---|---|
| Nome | `carteirinha_atualizacao_necessaria` |
| Evento | `CARTEIRINHA_ATUALIZACAO_NECESSARIA` |
| Categoria | UTILITY |
| Propósito | carteirinha |
| Idioma | pt_BR |
| Interação | Quick Reply “Atualizar carteirinha” (tratado por `zapresponde-action`) |
| Status Meta | `UNKNOWN` → envio real bloqueado (`template_not_approved`) |

Não existe fallback nem variação: o catálogo (`_shared/template-catalog.ts`) contém apenas esse nome para o fluxo, e há teste garantindo isso.

## 2. Definição de “precisa atualizar”

Regra única em `_shared/card-state.ts` → `deriveCardState()` (usada tanto no fluxo unitário quanto no lote):

`UPDATE_REQUIRED` = carteirinha ativa **com** `expires_at`, vencida (`days < 0`) **ou** dentro da janela (`days <= 30`), **e** sem `payslip_requests` em `pending`/`received`.
Demais estados: `VALID`, `EXPIRING`, `EXPIRED`, `NO_CARD` — nunca entram no fluxo.

## 3. Modos

- **PREVIEW** — só calcula. Não cria `whatsapp_events` nem `whatsapp_outbox`.
- **DRY_RUN** — ação administrativa explícita. Cria evento + item de outbox com `dry_run=true` e status `BLOCKED`. Nunca `SENT`.

Motor: `_shared/carteirinha-simulation.ts`. Endpoint: `whatsapp-carteirinha-simulation` (POST, exige super admin ou admin da clínica). Painel: `/admin/whatsapp-simulation`.

## 4. Pipeline por candidato

1. Estado da carteirinha (lote, escopado por `clinic_id`).
2. Normalização E.164 (`phone-br.ts`) — inválido ⇒ bloqueio.
3. Identidade (`identity.ts`) — `RESOLVED` / `AMBIGUOUS` / `NOT_FOUND`; ambíguo nunca segue.
4. Consentimento (`consent.ts`) — `UNKNOWN` permanece achado diagnóstico, não vira opt-in.
5. Gate real de produção (`send-gate.ts` → RPC `wa_can_send`): opt-out, score, frequência, categoria, relacionamento. Erro do gate ⇒ `gate_error` (fail-closed).
6. Aprovação do template na Meta.
7. Deduplicação (`dedup.ts`): `clinic|CARTEIRINHA_ATUALIZACAO_NECESSARIA|patient|patient_card|card|expires_at`.

## 5. Idempotência

Segunda execução com o mesmo estado ⇒ `DUPLICATE` (nenhum evento novo).
Mudança legítima de `expires_at` ⇒ nova ocorrência.

## 6. Inbound (Quick Reply)

`zapresponde-action` autentica por HMAC + nonce (anti-replay), resolve identidade por telefone dentro do tenant e responde de forma segura:
`RESOLVED` → abre/reaproveita solicitação de contracheque; `AMBIGUOUS`/`NOT_FOUND` → encaminhamento humano, sem vazar dados.

## 7. Relatório da simulação

População (analisados, válida, a vencer, vencida, precisa atualizar, sem carteirinha, sem telefone, telefone inválido, duplicados), identidade, consentimento, compliance permitido/bloqueado com motivos agregados, e lista por associado com **telefone mascarado**.

## 8. Garantias verificadas por teste (`src/test/whatsappEtapa4.test.ts`)

- Template único, UTILITY, sem variantes.
- Dedup estável e sensível a `expires_at`, clínica e paciente.
- Telefone inválido bloqueia.
- Nenhum módulo do fluxo referencia Meta/ZAPRESPONDE diretamente.
- Simulação usa o gate real; outbox nunca marca `SENT`.
- Endpoint fail-closed sem `clinic_id` e sem admin; gate fail-closed em erro; inbound bloqueia assinatura inválida e replay.

## 9. Critério de saída da ETAPA 4

Liberar envio real exige, em conjunto: template `APPROVED` na Meta, `WHATSAPP_OUTBOX_DRY_RUN=false` e worker de envio (ETAPA 5). Nada disso está ativo hoje.
