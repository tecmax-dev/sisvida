# Focus API — Casa das Antenas

## Tenant atendido

- Tenant: `9d98a593-4a03-428a-b7a3-f7c7c653158a`
- Diagnóstico: `focus-api-health`
- Emissão: `focus-nfe-emit`
- A chamada é permitida somente para usuários autenticados da equipe.

## Configuração obrigatória

Defina no ambiente da Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOCUS_NFE_BASE_URL`
- `FOCUS_NFE_EMIT_PATH` (caminho de emissão confirmado no contrato Focus; não usar valor inventado)

A credencial Focus deve estar na configuração fiscal ativa do tenant, com `active_provider = focus_nfe` e token preenchido.

## Autenticação

O servidor monta a autenticação Basic usando o token Focus como usuário e senha vazia. O token nunca é enviado pelo navegador nem incluído nas respostas.

## Status retornados

- `success`: resposta HTTP entre 200 e 299.
- `http_error`: a Focus respondeu com outro código HTTP.
- `timeout`: a chamada excedeu oito segundos.
- `network_error`: não foi possível alcançar a API.
- `misconfigured`: URL ou credencial não configurada.
- `unauthorized` / `forbidden`: sessão ausente, inválida ou sem papel de equipe.

Toda resposta inclui `correlation_id` e, quando aplicável, latência. Falhas na atualização do status local são registradas no servidor sem substituir o resultado original.

## Emissão protegida

A função `focus-nfe-emit` recebe o payload fiscal validado pelo sistema, lê a configuração de produção apenas no servidor e envia `POST` para `FOCUS_NFE_BASE_URL` + `FOCUS_NFE_EMIT_PATH`. A referência da nota é enviada como chave de idempotência. O timeout é de 15 segundos e tokens nunca retornam ao cliente.

Campos mínimos para homologação: `reference`, `items` não vazio e `customer` com os dados fiscais exigidos pelo contrato Focus. O painel usa um payload explícito de teste e não emite produção pelo diagnóstico.

## Checklist de validação

1. Confirmar as três variáveis no ambiente do servidor.
2. Confirmar a configuração fiscal ativa da Casa das Antenas.
3. Acessar a Configuração Global com usuário da equipe.
4. Executar um teste por vez no painel.
5. Conferir status, latência e `correlation_id`.
6. Verificar logs do servidor usando o `correlation_id`, sem expor o token.
