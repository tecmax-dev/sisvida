---
name: Central de Automações WhatsApp
description: Arquitetura oficial de envio WhatsApp — módulos Prosinge, gate de 8 passos, saída via Zapresponde/Chatwoot até a Meta
type: feature
---
Arquitetura oficial (ver docs/ARQUITETURA_CENTRAL_AUTOMACOES_WHATSAPP.md):

Módulos Prosinge (Associados, Empresas, Financeiro, Saúde, Jurídico, Carteirinha,
Homologação, Benefícios, Agenda) emitem eventos/API/webhook → **Central de Automações
WhatsApp** → **Zapresponde/Chatwoot** → WhatsApp Business Platform (Meta) → Associado/Empresa.

Nenhum módulo envia mensagem direto: todo envio passa pela Central, que executa 8 passos:
1) identifica evento, 2) consentimento, 3) janela de 24h, 4) finalidade,
5) template aprovado, 6) limites/frequência, 7) opt-out/bloqueios, 8) auditoria.

Base existente: `_shared/send-gate.ts` (assertCanSend/recordSent/recordFailure),
`_shared/opt-out.ts`, `_shared/template-catalog.ts`, RPC `wa_can_send`,
tabelas `whatsapp_template_logs` e `contact_preferences`.

Regras: fail-closed; template fora do catálogo bloqueado; todo bloqueio logado.
Camada de saída oficial = Zapresponde/Chatwoot (não duplicar mirror local de mensagens).
