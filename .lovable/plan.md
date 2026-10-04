# Gerar boleto pelo WhatsApp: só competência a vencer, em página exclusiva

## Ideia
O botão "Gerar boleto" do WhatsApp deixa de abrir o Portal da Empresa inteiro. Ele passa a abrir uma **página web exclusiva**, presa a **uma única competência a vencer** (ex.: 09/2026, vencimento 13/10/2026). Nessa página a empresa faz só duas coisas: envia a lista de trabalhadores e gera o boleto.

Competências vencidas **não** passam pelo WhatsApp. A mensagem orienta a empresa a usar o Portal da Empresa (login por CNPJ), sem link automático.

## Fluxo no WhatsApp ("Sou empresa" > "Gerar boleto")
1. Identifica a empresa pelo CNPJ, como hoje.
2. Procura a competência a vencer mais próxima: tipo 124/125/126, situação "aguardando valor" ou "a vencer", vencimento a partir de hoje e sem boleto já gerado.
3. Se encontrar, envia uma mensagem curta com um único botão:
   "Competência 09/2026 – Taxa Negocial, vencimento 13/10/2026. Toque para enviar a lista e gerar o boleto."
4. Se não houver competência a vencer, envia: "Não há competência a vencer. Para competências vencidas, acesse o Portal da Empresa." Vai com o endereço do portal, sem acesso automático.
5. Se houver várias a vencer (tipos diferentes no mesmo mês), envia a de vencimento mais próximo. Depois que ela é concluída, a empresa pode pedir de novo e recebe a próxima. Assim a mensagem nunca traz uma lista.

Regras da Meta mantidas: só como resposta dentro das 24h, uma mensagem curta, um botão, sem lista de dados.

## Página exclusiva (/gerar-boleto?t=...)
- O link é pessoal, abre uma vez só, vale 2 horas e fica preso à empresa e à competência. Depois de aberto, o endereço some da barra do navegador.
- A página mostra o nome da empresa, a competência, o tipo e o vencimento, sem trocar de competência e sem acesso ao restante do portal.
- Passo 1: enviar a lista de trabalhadores (mesma validação por IA e mesmas regras por tipo de contribuição de hoje).
- Passo 2: informar o valor e gerar o boleto. Só libera com a lista validada, e o sistema também confere isso por trás.
- Ao final, mostra o link, o código de barras e o PDF do boleto.
- Se a competência vencer enquanto a página estiver aberta, a geração é bloqueada com o aviso de usar o Portal da Empresa.

## Detalhes técnicos
- `employer_portal_link_tokens`: adicionar `contribution_id` (FK). Usar o purpose `generate_boleto_due` para esse fluxo.
- `chatgoo-webhook` (EMP_GERAR): selecionar a contribuição a vencer e gravar o token com `contribution_id`. A URL do botão passa a ser `https://prosindweb.com.br/gerar-boleto?t=<token>`.
- Nova edge function `due-boleto-session`: resgata o token de forma atômica e devolve uma sessão curta, com token de sessão assinado e guardado com hash, presa a `employer_id` e `contribution_id`. Também atende as ações `upload_list`, que delega para a lógica do validate-worker-list, e `set_value`, que delega para a lógica do set-contribution-value. Cada ação revalida a sessão, a contribuição (precisa ser a mesma), o status e o vencimento (>= hoje).
- Nova rota/página `src/pages/public/DueBoletoPage.tsx`, que reaproveita `WorkerListValidationStep` no modo competência fixa.
- O Portal da Empresa não muda (continua aceitando vencidas pelo login por CNPJ). O botão antigo `?t=` do portal deixa de ser emitido pelo WhatsApp.
- Teste unitário da regra "a vencer" (vencimento hoje = a vencer; ontem = vencida; status pago/cancelado = fora).
- Regra registrada no AGENTS.md.
