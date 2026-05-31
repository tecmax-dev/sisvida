---
name: Meta WhatsApp Templates
description: Lista oficial de templates Meta Cloud API do sindicato com nomes, status e botões interativos
type: feature
---
# Templates Meta Cloud API — Sindicato

Conta WABA: 1471541957159237. Locale: pt_BR. Versão Graph: configurada via META_GRAPH_VERSION.

## Templates ativos (PENDING/aprovados)

| Nome | Categoria | Botões | Variáveis | Uso |
|---|---|---|---|---|
| `boleto_mensalidade` | UTILITY | nenhum | 5: nome, ref, valor, venc, link | send-whatsapp / boleto a vencer |
| `boleto_vencido` | UTILITY | nenhum | 5: nome, ref, valor, venc, link | boleto vencido (2ª via) |
| `confirmacao_agendamento` | UTILITY | nenhum | 6: nome, prof, esp, data, hora, local | pós-agendamento |
| `lembrete_consulta_v2` | UTILITY | QUICK_REPLY: Confirmar, Cancelar | 6: nome, prof, esp, data, hora, local | send-appointment-reminders (24h antes) |
| `carteira_vencendo` | MARKETING | nenhum | 2: nome, data | aviso pré-vencimento |
| `carteira_vencida` | MARKETING | nenhum | 2: nome, data | aviso pós-vencimento |
| `autorizacao_pronta` | UTILITY | nenhum | 4: nome, tipo, prof, validade | autorização emitida |
| `filiacao_aprovada` | UTILITY | nenhum | 3: nome, matrícula, plano | nova filiação aprovada |
| `carteirinha_atualizada` | UTILITY | nenhum | 2: nome, validade | aprovação contracheque + renovação carteirinha |
| `contracheque_aprovado` | UTILITY | nenhum | 1: nome | aprovação de contracheque sem renovação |
| `carteirinha_recusada` | UTILITY | nenhum | 2: nome, motivo | rejeição de contracheque/renovação carteirinha |
| `homologacao_lembrete` | UTILITY | nenhum | 7: serviço, destinatário, funcionário, empresa, data, hora, profissional | lembrete homologação/jurídico (titular/empresa) |
| `homologacao_lembrete_profissional` | UTILITY | nenhum | 6: serviço, profissional, funcionário, empresa, data, hora | lembrete homologação/jurídico (profissional) |
| `homologacao_confirmacao` | UTILITY | nenhum | 6: serviço, funcionário, empresa, data, hora, profissional | confirmação pós-agendamento |
| `homologacao_protocolo` | UTILITY | nenhum | 5: serviço, funcionário, empresa, data, protocolo | conclusão/protocolo emitido |
| `homologacao_lembrete_v2` | UTILITY | QUICK_REPLY: Confirmar, Cancelar; URL: Reagendar (slug profissional via {{1}}) | 7 body + 1 URL var | lembrete empresa com botões interativos |
| `homologacao_lembrete_profissional_v2` | UTILITY | QUICK_REPLY: Confirmar, Cancelar | 6: serviço, profissional, funcionário, empresa, data, hora | lembrete profissional com botões |
| `homologacao_lembrete_v3` | UTILITY | QUICK_REPLY: Confirmar, Cancelar; URL: Reagendar (slug via {{1}}) | 6 body + 1 URL var | v3 corrigido: texto fixo no início, sem variável repetida, slug real (`andrea-matos`) no exemplo |
| `homologacao_lembrete_profissional_v3` | UTILITY | QUICK_REPLY: Confirmar, Cancelar | 5: profissional, funcionário, empresa, data, hora | v3 corrigido para profissional |
| `vaga_medica_<slug>` (8 templates) | UTILITY* | URL: Acessar Aplicativo (https://prosindweb.com.br/) | 3: nome, data, hora | Notificação de vaga social disponível por profissional ativo do sindicato. Um template por profissional: daniela_sales, eliney_silva, jorge_avelar, jose_alcides, juliane_leite, marcelo_aguiar, pedro_roberto, uiara_tiuba. Edge function `meta-create-vaga-templates` registra todos. *jorge_avelar foi reclassificado como MARKETING pela Meta na revisão — recriar com texto mais utilitário se rejeitado. |
| `cancelamento_consulta_profissional` | UTILITY | nenhum | 6: nome, profissional, especialidade, data, hora, motivo | Notifica associado quando o profissional/clínica cancela a consulta. Registrado via edge function `meta-create-cancelamento-template`. |
| `atendimento_encerrado_inatividade` | UTILITY | nenhum | 1: nome | Encerramento automático de atendimento (Chatgoo/Whazing) por inatividade do contato. Registrado via edge function `meta-create-encerramento-inatividade-template`. |

## Templates pendentes de criação manual no painel Meta

`codigo_acesso` e `recuperacao_senha` — são categoria AUTHENTICATION (OTP). Conta WABA precisa de permissão extra que não tem hoje. Cadastrar via Business Manager > Modelos de mensagem > Categoria Autenticação > One-time password.

## Regras importantes

- **lembrete_consulta antigo (sem botões) foi DELETADO**. Nome bloqueado pela Meta por ~30 dias. Por isso usamos `lembrete_consulta_v2`.
- Os 3 botões iniciais do atendimento (Sou Associado / Sou Empresa / Sou Contabilidade) NÃO precisam de template — disparam dentro da janela 24h após mensagem do cliente.
- Fluxo do boleto (escolher mês/ano/tipo) também roda na janela 24h após resposta do cliente — não precisa de botão no template.
- Edge function de gestão: `meta-register-templates` com actions `list`, `delete?name=X`, `register-with-buttons?name=X[&as=Y]`.
- **Homologação v2 — botões:**
  - `homologacao_lembrete_v2`: 2 Quick Reply (Confirmar/Cancelar) + 1 URL dinâmica (Reagendar) que abre `https://prosindweb.com.br/agendamento/profissional/{{slug}}` — slug do profissional do agendamento.
  - `homologacao_lembrete_profissional_v2`: 2 Quick Reply (Confirmar/Cancelar). Profissional não recebe botão de reagendar (apenas empresas reagendam).
  - Webhook `whatsapp-webhook` intercepta as respostas "Confirmar" e "Cancelar": busca `homologacao_appointments` por `company_phone`/`employee_phone` em janela de 48h, atualiza status (`confirmed`/`cancelled`) e responde via `sendMetaText` (Meta Cloud, dentro da janela 24h).
  - Quando ativar v2 em `homologacaoUtils.ts`/`send-homologacao-reminders`, passar o slug do profissional como variável da URL (segundo array de parameters do componente button).

- **Homologação v3 — correções aplicadas para acelerar aprovação Meta:**
  - Texto fixo no início do body (não começa mais com `{{1}}` logo após emoji).
  - Variável de "tipo de serviço" removida (homologação fixa no texto) — assessoria jurídica precisará de template separado se for o caso.
  - Sem variáveis repetidas no mesmo body.
  - URL `Reagendar` usa slug real do banco (`andrea-matos`) como example, garantindo que a Meta consiga validar a URL.
  - Body vars empresa: `{{1}}` destinatário, `{{2}}` funcionário, `{{3}}` empresa, `{{4}}` data, `{{5}}` hora, `{{6}}` profissional.
  - Body vars profissional: `{{1}}` profissional, `{{2}}` funcionário, `{{3}}` empresa, `{{4}}` data, `{{5}}` hora.
  - Quando v3 aprovar, atualizar `homologacaoUtils.ts`/`send-homologacao-reminders` para usar v3 (e parar de gerar variável de "tipo serviço"). v2 fica como fallback até deprecação.

## Quando atualizar

Ao alterar texto ou variáveis de qualquer template, sempre incrementar versão (`_v3`, `_v4`) — Meta bloqueia o nome por dias após delete.
