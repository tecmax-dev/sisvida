# Focus API — Casa das Antenas

## Tenant atendido

- Tenant: `9d98a593-4a03-428a-b7a3-f7c7c653158a`
- Diagnóstico: `focus-api-health`
- A chamada é permitida somente para usuários autenticados da equipe.

## Configuração obrigatória

Defina no ambiente da Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOCUS_NFE_BASE_URL`

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

## Checklist de validação

1. Confirmar as três variáveis no ambiente do servidor.
2. Confirmar a configuração fiscal ativa da Casa das Antenas.
3. Acessar a Configuração Global com usuário da equipe.
4. Executar um teste por vez no painel.
5. Conferir status, latência e `correlation_id`.
6. Verificar logs do servidor usando o `correlation_id`, sem expor o token.
