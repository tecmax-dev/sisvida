---
name: ETAPA 5.1 — CONSENTIMENTO WHATSAPP E POPULAÇÃO 2026+
description: Documentação detalhada sobre a correção da população elegível e a estratégia rigorosa de consentimento WhatsApp.
type: feature
---
# ETAPA 5.1 — CONSENTIMENTO WHATSAPP E POPULAÇÃO 2026+

A população oficial da automação de carteirinha foi corrigida para refletir apenas o ciclo 2026+.

## 1. RESULTADOS ATUAIS (RECALCULADOS)
- **TOTAL PACIENTES ANALISADOS:** 6.024
- **CARTEIRINHAS ANTERIORES A 01/01/2026:** 5.439 (Excluídas)
- **CARTEIRINHAS 2026+:** 151
- **ASSOCIADOS ATIVOS ELEGÍVEIS 2026+:** 78
- **UPDATE_REQUIRED:** 63
- **Com telefone:** 63
- **Normalizáveis:** 57
- **Invalid phone:** 6
- **Identidade resolvida estimada:** 57
- **Consentimento:**
  - OPT_IN: 0
  - OPT_OUT: 0
  - UNKNOWN: 63

**STATUS OPERACIONAL: NÃO LIBERAR ENVIO.**

## 2. ESTRATÉGIA DE CONSENTIMENTO (FAIL-CLOSED)

### Regra de Ouro
O status `UNKNOWN` **NÃO** pode ser convertido automaticamente para `OPT_IN`.
- Ser associado ativo **NÃO** equivale a opt-in.
- Possuir telefone cadastrado **NÃO** equivale a opt-in.
- Ter carteirinha **NÃO** equivale a opt-in.

### Classificação de Evidências
Para os 63 registros identificados, a auditoria deve classificar entre:
- `VERIFIED_OPT_IN`
- `VERIFIED_OPT_OUT`
- `NO_EVIDENCE`
- `INSUFFICIENT_EVIDENCE`

## 3. MECANISMO DE REGISTRO DE PROVA
Um opt-in válido deve conter:
- `clinic_id`, `patient_id`, `telefone`
- `status`, `purpose` (SERVICE_OPERATIONAL vs MARKETING)
- `source` (FILIACAO, PORTAL, APP, PRESENCIAL, WHATSAPP_INBOUND)
- `consented_at`, `text_version`, `proof` (URL/UUID), `metadata`

## 4. NOVOS CADASTROS
Checkbox de consentimento obrigatório (não marcado por padrão) em:
- Ficha de filiação
- Atualização cadastral
- Portais e App

**Texto Sugerido:**
"Autorizo o Sindicato a utilizar meu número de WhatsApp para comunicações relacionadas ao meu cadastro, carteirinha, atendimentos, agendamentos e serviços solicitados, conforme a Política de Privacidade."

## 5. CONTROLE DE PRODUÇÃO
Somente a interseção total de:
1. Carteirinha >= 01/01/2026
2. Associado Ativo/Elegível
3. `UPDATE_REQUIRED`
4. Telefone Válido E Identidade Resolvida
5. **Consentimento Válido (VERIFIED_OPT_IN)**
6. Template Aprovado pela Meta
7. Gate de Compliance Aprovado

Poderá chegar à outbox de produção.

## 6. STATUS TÉCNICO FINAL
- **DRY_RUN:** ATIVO
- **MENSAGENS REAIS ENVIADAS:** 0
- **PROVIDERS ACIONADOS:** 0
- **PRODUÇÃO LIBERADA:** NÃO

---
*Aguardando autorização para prosseguir após implementação dos mecanismos de coleta de consentimento.*
