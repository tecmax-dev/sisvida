---
name: Arquitetura Funcional Oficial da Integração WhatsApp
description: Cadeia obrigatória Prosinge -> camada de compliance -> Zapresponde/Chatwoot -> Meta; regras de identificação, papéis e segurança
type: feature
---
Arquitetura oficial (docs/ARQUITETURA_FUNCIONAL_OFICIAL_INTEGRACAO_WHATSAPP.md):

- Saída: módulo Prosinge -> evento -> camada central de integração/compliance -> validação -> fila de envio -> Zapresponde/Chatwoot -> Meta -> associado/empresa. Nenhum módulo chama Meta/Zapresponde diretamente.
- Entrada: associado/empresa -> Meta -> Zapresponde/Chatwoot -> camada de integração -> Prosinge, que executa somente ações autorizadas.
- Identificação: telefone normalizado (5573999999999) dentro do tenant correto. Zero, múltiplos ou divergentes = nunca assumir identidade; encaminhar a fluxo seguro ou humano.
- Papéis: Prosinge = fonte de dados/regras; Zapresponde/Chatwoot = atendimento conversacional; Meta = apenas canal (nunca regra de negócio).
- Compliance obrigatório antes de enviar: tenant, telefone, evento, finalidade, consentimento, opt-out, janela, template + categoria + status, duplicidade, frequência, rate limit, circuit breaker, status da integração. Fail-closed: dúvida = não enviar e registrar motivo.
- Segurança: Zapresponde nunca acessa o banco direto (só API/Edge Function dedicada); React nunca acessa tokens de Zapresponde/Meta.
