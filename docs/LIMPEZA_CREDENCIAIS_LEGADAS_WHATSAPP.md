# LIMPEZA DE CREDENCIAIS LEGADAS DO WHATSAPP

## 1. AUDITORIA DE CREDENCIAIS

### 1.1 Meta Direta (WhatsApp Cloud API)
- **Status:** LEGADO / DESABILITADO
- **Credenciais Encontradas:**
  - `META_WHATSAPP_TOKEN` (Supabase Secret)
  - `META_PHONE_NUMBER_ID` (Supabase Secret)
  - `META_WABA_ID` (Supabase Secret)
  - `META_APP_SECRET` (Supabase Secret)
- **Impacto:** Utilizado por diversas funções `meta-*`, `whatsapp-clean-flow`, `whatsapp-carteirinha-flow`, `send-whatsapp`.
- **Ação:** Desativação do fluxo operacional. Remoção de referências diretas a `graph.facebook.com` em funções ativas.

### 1.2 Evolution API
- **Status:** LEGADO / DESABILITADO
- **Credenciais Encontradas:**
  - `EVOLUTION_API_URL` (Supabase Secret / `global_config` table)
  - `EVOLUTION_API_KEY` (Supabase Secret / `global_config` table)
  - `EVOLUTION_INSTANCE` (Supabase Secret / `global_config` table)
- **Tabelas Relacionadas:** `evolution_configs`
- **Impacto:** Funções `check-evolution-status`, `evolution-api`, `evolution-contacts`, `whazing-actions`.
- **Ação:** Desativação do fluxo operacional. Bloqueio de interface em `GlobalConfigPage`.

### 1.3 ZapResponde / Chatwoot (Arquitetura Atual)
- **Status:** ATIVO / PRODUÇÃO
- **Credenciais:** `ZAPSTER_API_TOKEN` / `instance_id`
- **Ação:** **PRESERVADO INTEGRALMENTE.** Nenhuma alteração realizada.

---

## 2. RELATÓRIO FINAL DE EXECUÇÃO

### META DIRETA
- **Credenciais encontradas:** 4 principais (TOKEN, PHONE_ID, WABA_ID, APP_SECRET).
- **Credenciais removidas/desativadas:** SIM (bloqueadas no código e desabilitadas operacionalmente).
- **Funções dependentes:** ~25 funções `meta-*`.
- **Provider Meta direto:** **DESABILITADO**

### EVOLUTION
- **Credenciais encontradas:** 3 principais (URL, KEY, INSTANCE).
- **Credenciais removidas/desativadas:** SIM (removidas da interface e desativadas no backend).
- **Funções dependentes:** 5 funções específicas.
- **Provider Evolution:** **DESABILITADO**

### ZAPRESPONDE
- **Credenciais atuais alteradas:** NÃO
- **Configuração Chatwoot alterada:** NÃO
- **Conexão Meta do ZAPRESPONDE alterada:** NÃO

### ESTADO FINAL
- **PROSINGE → META DIRETA:** DESABILITADO
- **PROSINGE → EVOLUTION:** DESABILITADO
- **PROSINGE → ZAPRESPONDE:** NÃO CONFIGURADO (Infraestrutura pronta, aguardando dados reais)
- **DRY_RUN:** ATIVO (Obrigatório)
- **MENSAGENS ENVIADAS:** 0
- **PRODUÇÃO:** NÃO LIBERADA

**PARE.** Limpeza concluída. Não criar novas credenciais.
