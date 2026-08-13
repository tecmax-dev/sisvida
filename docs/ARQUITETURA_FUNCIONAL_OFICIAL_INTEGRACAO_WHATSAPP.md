# Arquitetura Funcional Oficial da Integração WhatsApp (Prosinge)

Documento normativo. Toda implementação atual e futura deve respeitar esta separação
de responsabilidades. Nenhum código é alterado por este registro.

## Cadeia oficial

```text
PROSINGE
  Associados | Empresas | Financeiro | Saúde | Jurídico
  Carteirinha | Homologação | Benefícios | Agenda
        ↓
CAMADA CENTRAL DE INTEGRAÇÃO E COMPLIANCE WHATSAPP
        ↓
ZAPRESPONDE / CHATWOOT
        ↓
WhatsApp Business Platform / META
        ↓
Associado / Empresa
```

## Fluxo de saída (obrigatório)

```text
PROSINGE → evento do módulo → camada de integração e compliance →
validação de regras → fila de envio → ZAPRESPONDE / CHATWOOT →
WhatsApp Business Platform / META → Associado / Empresa
```

- Nenhum módulo do PROSINGE pode chamar diretamente WhatsApp, Meta ou Zapresponde.
- Todos os envios passam pela camada central de compliance.

## Fluxo de entrada

```text
Associado / Empresa → WhatsApp Business Platform / META →
ZAPRESPONDE / CHATWOOT → camada de integração → PROSINGE
```

O PROSINGE identifica o contato e executa **somente ações autorizadas**.

## Consultas e ações previstas (roadmap da integração)

| Domínio | Ações |
|---|---|
| Associados | consultar cadastro; consultar situação; atualizar dados; enviar documentos; solicitar atendimento |
| Carteirinha | consultar situação; iniciar atualização; enviar contracheque; acompanhar análise; informar conclusão |
| Agenda / Saúde | consultar profissionais; consultar horários; agendar; consultar agendamentos; cancelar |
| Jurídico | solicitar atendimento; consultar solicitação; encaminhar ao setor jurídico |
| Financeiro | consultar pendências permitidas; solicitar 2ª via; consultar boletos quando autorizado; confirmar recebimento |
| Homologação | consultar agendamento; confirmar homologação; cancelar ou solicitar alteração quando permitido |
| Benefícios | consultar benefícios disponíveis; consultar regras de utilização |
| Empresas | localizar cadastro; consultar solicitações; iniciar atendimento; consultar homologações; acessar serviços liberados |

## Regra de identificação

1. Primeira tentativa: telefone do WhatsApp **normalizado** (ex.: `5573999999999`).
2. Se existir **exatamente um** cadastro compatível **dentro do tenant correto**, usar esse cadastro.
3. Não assumir identidade automaticamente quando houver:
   - nenhum cadastro;
   - múltiplos cadastros;
   - divergência de dados;
   - qualquer situação que exija confirmação adicional.
4. Nesses casos, encaminhar para fluxo seguro de identificação ou atendimento humano.

## Papel de cada sistema

**PROSINGE** — fonte oficial dos dados e das regras de negócio. Decide: situação do
associado, situação da empresa, carteirinha, agenda, homologações, financeiro,
documentos, benefícios, permissões e o resultado das ações.

**ZAPRESPONDE / CHATWOOT** — camada de atendimento e comunicação: recebe mensagens,
exibe conversas, operadores, equipes e filas, atendimento humano, recebe cliques em
botões, encaminha ações ao PROSINGE e entrega mensagens aprovadas à Meta.

**META / WHATSAPP** — somente o canal oficial. Nunca é fonte de regra de negócio.

## Camada de compliance — verificações obrigatórias

Antes de qualquer comunicação iniciada pelo PROSINGE, verificar:
tenant; telefone; evento; finalidade da mensagem; consentimento aplicável; opt-out;
janela de atendimento; template necessário; categoria do template; status do template;
duplicidade; frequência; rate limit; circuit breaker; status da integração.

**Fail-closed:** se qualquer requisito obrigatório estiver inválido ou não puder ser
confirmado → **NÃO ENVIAR** e registrar o motivo.

## Regra de segurança

- O Zapresponde **nunca** recebe acesso direto irrestrito ao banco do PROSINGE.
  A integração ocorre por API/Edge Function específica.
- Componentes React do PROSINGE **não** acessam tokens privados do Zapresponde ou da Meta.
  Tokens vivem apenas em ambiente servidor (Edge Functions / secrets).

## Objetivo final

| Camada | Responsabilidade |
|---|---|
| PROSINGE | gestão e regras de negócio |
| Camada de integração e compliance | controle, segurança e governança |
| Zapresponde / Chatwoot | atendimento conversacional |
| Meta / WhatsApp | canal |
| Associado / Empresa | usuário final |

Referências: `docs/ARQUITETURA_CENTRAL_AUTOMACOES_WHATSAPP.md`,
`docs/RC1_META_COMPLIANCE_BASELINE.md`,
`supabase/functions/_shared/send-gate.ts`, `_shared/opt-out.ts`, `_shared/template-catalog.ts`.