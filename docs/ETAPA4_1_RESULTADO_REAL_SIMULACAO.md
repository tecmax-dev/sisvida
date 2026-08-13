# RESULTADO REAL DA SIMULAÇÃO (ETAPA 4.1)

### RESULTADO GERAL
- **Pacientes analisados:** 5.902
- **Precisam atualizar:** 5.392
- **Identidade resolvida:** 1.156
- **Consentimento permitido:** 0
- **Passariam pelo gate antes do template:** 0
- **Bloqueados:** 5.902
- **Principal motivo:** `template_not_approved` / `consent_unknown`
- **Dry-run executado:** SIM
- **Duplicidade bloqueada:** SIM
- **Inbound validado:** SIM
- **Mensagens reais enviadas:** ZERO

---

## 1. MÉTRICAS DETALHADAS (CLÍNICA PILOTO)
**Clinic ID:** 89e7585e-7bce-4e58-91fa-c37080d1170d

### CARTEIRINHA
- **VALID:** 98 (1.6%)
- **EXPIRING:** 0 (0%)
- **EXPIRED:** 19 (0.3%)
- **UPDATE_REQUIRED:** 5.392 (91.3%)
- **NO_CARD:** 392 (6.6%)

### TELEFONE
- **Total com telefone:** 1.446 (24.5%)
- **Total sem telefone:** 4.456 (75.5%)
- **Normalizável:** 1.373 (memória)
- **Inválido:** 72
- **Ambíguo:** 151 (colisão na clínica)

### IDENTIDADE
- **RESOLVED:** 1.156
- **NOT_FOUND:** 144
- **AMBIGUOUS:** 151
- **INVALID_PHONE:** 72

### CONSENTIMENTO
- **OPT_IN:** 0
- **OPT_OUT:** 0
- **UNKNOWN:** 5.902
- **NOT_REQUIRED:** 0

### COMPLIANCE
- **ALLOWED:** 0
- **BLOCKED:** 5.902

---

## 2. BLOQUEIOS POR MOTIVO
1. `template_not_approved`: 5.902 (Template Meta em status `UNKNOWN`)
2. `consent_unknown`: 5.902 (Nenhum registro de consentimento explícito no novo modelo)
3. `invalid_phone`: 72
4. `ambiguous_identity`: 151

## 3. PRINCIPAL GARGALO
O maior impeditivo atual é a **ausência de registros de consentimento (UNKNOWN)** e o **status do template Meta (UNKNOWN)**. 
Mesmo resolvendo a identidade, o sistema opera em modo **fail-closed**, exigindo consentimento explícito para mensagens de utilidade/marketing ou uma janela de 24h aberta (que não existe para novos envios).

Além disso, **75% da base não possui telefone cadastrado**, o que limita drasticamente o alcance da automação nesta clínica específica.

## 4. ANÁLISE DE CONSENTIMENTO UNKNOWN
- **Motivo:** Não existe registro nas tabelas `whatsapp_consents` ou `contact_preferences`.
- **Diagnóstico:** A migração do modelo legado (ou a falta de um) resultou em uma base sem flag de permissão. O sistema não assume consentimento automático por ser associado ativo, seguindo a diretriz de conformidade.

## 5. TESTES DE OPERAÇÃO
- **Dry-run:** Executado para 5 registros. Eventos e Outbox criados com `dry_run = true` e status `BLOCKED` (motivo: `template_not_approved`).
- **Duplicidade:** Segunda execução para os mesmos registros resultou em `DUPLICATE_EVENT`.
- **Inbound:** Validado o fluxo de assinatura HMAC e bloqueio de replay (`409 Conflict` em nonces repetidos).

