# ETAPA 5 — REGULARIZAÇÃO PRÉ-PRODUÇÃO

A Etapa 4.1 foi concluída com os seguintes resultados reais (POPULAÇÃO HISTÓRICA):

**Pacientes analisados:** 5.902
**UPDATE_REQUIRED (LEGADO):** 5.392

---

## RECALCULO DE POPULAÇÃO (REGRA 2026+)
Conforme diretriz de 09/08/2026, a população foi recalculada para considerar apenas o ciclo iniciado em **01/01/2026**.

### 1. MÉTRICAS DE FILTRAGEM
- **TOTAL DE PACIENTES NA CLÍNICA:** 6.024
- **USUÁRIOS INATIVOS EXCLUÍDOS:** 122
- **NÃO ASSOCIADOS (NON-MEMBER) EXCLUÍDOS:** 314
- **CARTEIRINHAS ANTERIORES A 01/01/2026 (HISTÓRICO):** 5.439
- **POPULAÇÃO REAL ELEGÍVEL (2026+):** 78

### 2. RESULTADO DO PREVIEW (POPULAÇÃO ELEGÍVEL)
Dentro da população de 78 associados com carteirinhas emitidas a partir de 2026:

- **VALID:** 9
- **EXPIRING:** 6 (com solicitação pendente)
- **EXPIRED:** 0
- **UPDATE_REQUIRED:** 63
- **NO_CARD:** 0 (Não elegível para atualização automática)

### 3. ANÁLISE DO PÚBLICO ALVO (63 registros UPDATE_REQUIRED)
- **COM TELEFONE:** 63
- **SEM TELEFONE:** 0
- **TELEFONE NORMALIZÁVEL:** 57
- **INVALID_PHONE:** 6
- **IDENTIDADE RESOLVED:** 57 (estimado via normalização)
- **IDENTIDADE AMBIGUOUS:** 0
- **IDENTIDADE NOT_FOUND:** 0
- **CONSENTIMENTO UNKNOWN:** 63 (Fail-closed ativo)
- **COMPLIANCE ALLOWED:** 0
- **COMPLIANCE BLOCKED:** 63 (Motivo: `consent_unknown` + `template_not_approved`)

### 4. COMPARAÇÃO
- **UPDATE_REQUIRED ANTES DA CORREÇÃO:** 5.392
- **UPDATE_REQUIRED DEPOIS DA REGRA 2026+:** 63
- **REDUÇÃO:** 5.329 registros (98.8% de redução)

---

## OBJETIVO DA ETAPA 5
Resolver e auditar os impedimentos encontrados ANTES de qualquer autorização para produção.

**Esta etapa continua: SEM ENVIO REAL.**
- Não ativar worker de envio.
- Não alterar DRY_RUN global.
- Não criar opt-in artificial.
- Não alterar UNKNOWN para OPT_IN em massa.
- Não enviar template.
- Não acionar provider.

### PARTE A — AUDITAR UPDATE_REQUIRED
A simulação classificou **63 pacientes** como `UPDATE_REQUIRED`.
Auditar detalhadamente `getPatientCardWhatsappState()` e derivar reason codes (ex: CARD_EXPIRED, PAYSLIP_REQUIRED) da lógica real.
`UPDATE_REQUIRED` significa que o associado precisa atualizar sua carteirinha e não apenas falta de informação.

### PARTE B — AUDITAR O UNIVERSO CORRETO
Confirmado que a população oficial considera apenas o ciclo 2026+.

### PARTE C — CONSENTIMENTO
Auditar fontes de evidência sem fabricar consentimento retroativo. Status `UNKNOWN` permanece bloqueado.

### PARTE G — TEMPLATE META
Sincronizar o status real via API Meta. Somente `APPROVED` permitirá envios futuros.

### PARTE I — TELEFONES
Relatório operacional para os 63 registros (57 normalizáveis, 6 inválidos).

### PARTE M — MATRIZ DE CONSENTIMENTO
Documentar finalidades em `docs/MATRIZ_CONSENTIMENTO_WHATSAPP_META.md`.

---

**DRY_RUN: ATIVO**
**MENSAGENS REAIS ENVIADAS: 0**
**PROVIDERS DE ENVIO ACIONADOS: 0**
**PRODUÇÃO LIBERADA: NÃO**
