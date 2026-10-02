# Lista de nomes de trabalhadores por empresa

## O que muda para quem usa
- Nova área **"Trabalhadores da empresa"** no Portal da Empresa, no Portal do Contador (por empresa vinculada) e no cadastro da empresa em /sindicato (aba Listas de Trabalhadores).
- Botão **"Importar das listas enviadas"**: o sistema lê os arquivos já validados (PDF/foto), extrai os nomes (e CPF, se aparecer) e mostra para conferência antes de salvar.
- Nomes repetidos são ignorados automaticamente (comparando nome normalizado e CPF).
- Ao abrir uma **nova competência**, a lista vem pré-preenchida com os nomes da competência anterior; a pessoa pode **incluir** ou **remover** nomes e confirmar.
- Histórico por competência: dá para ver quem entrou e quem saiu em cada mês.

## Sugestão sobre o uso (recomendado)
A lista montada na tela **vale como envio da competência e libera o campo VALOR**, desde que:
- tenha pelo menos 1 nome;
- seja confirmada pela empresa/contador (registro de quem confirmou e quando);
- siga as mesmas regras atuais (tipos 124/125/126, validade de 24h, uma liberação por lançamento).
Assim a empresa não precisa reenviar arquivo todo mês. Listas montadas pela equipe do sindicato continuam **não** liberando o VALOR nos portais (regra atual mantida).

## Detalhes técnicos
- Novas tabelas: `employer_workers` (cadastro único por empresa: nome, nome normalizado, CPF opcional, ativo) e `employer_worker_roster_items` (vínculo trabalhador ↔ competência/tipo, origem, quem incluiu/removeu). GRANTs + RLS: equipe via `has_clinic_access`; portais apenas via edge function.
- Edge function `validate-worker-list` ganha ações: `extract_names` (gpt-4o vision sobre o arquivo do bucket `worker-lists`), `roster_get`, `roster_save` (gera um registro em `contribution_worker_list_validations` com status `valid` e origem "lista montada" quando confirmado nos portais).
- `set-contribution-value` continua exigindo validação válida e não usada — sem mudança de regra.
- Componente compartilhado `WorkerRosterEditor` usado nas três telas; dedupe por CPF numérico ou nome sem acentos/maiúsculas.
