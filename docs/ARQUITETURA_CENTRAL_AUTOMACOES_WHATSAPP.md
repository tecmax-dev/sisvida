# Arquitetura — Central de Automações WhatsApp (Prosinge)

Documento de referência (somente arquitetura; nenhuma implementação alterada por este registro).

## Visão geral

```text
PROSINGE
Associados | Empresas | Financeiro | Saúde | Jurídico
Carteirinha | Homologação | Benefícios | Agenda
        │
        │ eventos / API / webhook
        ▼
┌─────────────────────────────────────┐
│ CENTRAL DE AUTOMAÇÕES WHATSAPP      │
│ 1. Identifica o evento              │
│ 2. Verifica consentimento           │
│ 3. Verifica janela de 24h           │
│ 4. Verifica finalidade              │
│ 5. Seleciona template aprovado      │
│ 6. Aplica limites/frequência        │
│ 7. Verifica opt-out/bloqueios       │
│ 8. Registra auditoria               │
└─────────────────────────────────────┘
        │
        ▼
ZAPRESPONDE / CHATWOOT
        │
        ▼
WhatsApp Business Platform / META
        │
        ▼
Associado / Empresa
```

## Camadas

### 1. Origem — módulos Prosinge
Associados, Empresas, Financeiro (contribuições/boletos), Saúde (agenda/consultas),
Jurídico, Carteirinha, Homologação e Benefícios emitem **eventos** (triggers de banco,
chamadas de API ou webhooks) sempre que ocorre um fato relevante para comunicação.

Nenhum módulo envia mensagem diretamente. Todo envio passa obrigatoriamente pela Central.

### 2. Central de Automações WhatsApp — os 8 passos

| # | Passo | Responsabilidade |
|---|-------|------------------|
| 1 | Identifica o evento | Normaliza payload, resolve clínica/entidade, contato e finalidade |
| 2 | Verifica consentimento | Opt-in registrado para a categoria da mensagem |
| 3 | Verifica janela de 24h | Última mensagem inbound do contato; fora da janela só template aprovado |
| 4 | Verifica finalidade | Categoria (UTILITY / AUTHENTICATION / MARKETING) compatível com o evento |
| 5 | Seleciona template aprovado | Somente templates do catálogo canônico aprovado pela Meta |
| 6 | Aplica limites/frequência | Teto por contato/período, cooldown e score de interação |
| 7 | Verifica opt-out/bloqueios | "PARAR", bloqueios manuais, números inválidos |
| 8 | Registra auditoria | Log de permitido/bloqueado, motivo, template, message_id e falhas |

Base já existente no código: `supabase/functions/_shared/send-gate.ts`
(`assertCanSend`, `recordSent`, `recordFailure`), `_shared/opt-out.ts`,
`_shared/template-catalog.ts` e a RPC `wa_can_send`.
Tabelas de apoio: `whatsapp_template_logs`, `contact_preferences`.

Regras invioláveis:
- **Fail-closed**: se o gate falhar, o envio é bloqueado.
- Template fora do catálogo é bloqueado (`blocked_deprecated_template`).
- Todo bloqueio gera log e evento de política.

### 3. Camada de saída — Zapresponde / Chatwoot
A Central **não** fala com a Graph API diretamente no desenho alvo: ela entrega a
mensagem já validada ao Zapresponde/Chatwoot, que mantém a conexão oficial com a
WhatsApp Business Platform, o histórico de conversas e o atendimento humano.

Implicações:
- Echoes de saída e inbound chegam pelo Zapresponde/Chatwoot — não duplicar mirror local.
- Atendimento humano e automação compartilham a mesma thread do contato.
- Janela de 24h continua sendo avaliada na Central antes do envio.

### 4. Meta / destinatário
WhatsApp Business Platform entrega ao Associado ou Empresa. Status de entrega e falha
retornam por webhook e devem alimentar a auditoria (passo 8) e o score de interação.

## Compliance
- Alinhado ao baseline `docs/RC1_META_COMPLIANCE_BASELINE.md`.
- Número oficial do sindicato: exclusivamente Meta Cloud API (Evolution proibida).
- Gestão (agendar, cancelar, 2ª via) permanece no app/PWA; WhatsApp é informativo.
