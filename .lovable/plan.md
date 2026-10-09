# Filiação aprovada → carteirinha, ficha na empresa e ciência obrigatória

## O que muda para cada pessoa
- **Sindicato:** basta aprovar a filiação, como hoje. O sistema faz o resto sozinho e mostra, no cadastro da empresa, a nova aba **Filiações e Documentos**. Ela traz status de ciência, histórico e envio manual de fichas antigas. Também haverá indicadores de empresas com pendências.
- **Associado:** recebe a carteirinha digital válida por 30 dias a partir da aprovação, sem precisar de contracheque. Depois disso, entra na renovação normal que já existe.
- **Empresa (Portal da Empresa):** vê o aviso **NOVA FILIAÇÃO SINDICAL RECEBIDA** e ganha o menu **Filiações Recebidas**. Para confirmar a ciência, precisa abrir a ficha e marcar a declaração. Enquanto houver ficha pendente, só a geração e o preenchimento de boletos ficam bloqueados.
- **Contador (Portal do Contador):** vê um indicador do tipo "3 empresas com novas filiações", com a lista direta dessas empresas. Pode confirmar várias de uma vez, mas só as fichas já abertas e marcadas uma a uma. O bloqueio vale apenas para cada CNPJ pendente.
- **Contribuições 124/125/126:** se o trabalhador estava na Taxa Negocial, aparece o aviso para revisar a classificação para Mensalidade e evitar cobrança dupla. Nenhum valor, desconto ou boleto muda automaticamente.

## Etapas
1. **Banco de dados (uma migration)**
   - Tabela `affiliation_company_documents`: associado, empresa, ficha (caminho privado), versão, origem (automática ou manual), data em que foi disponibilizada, status de ciência, data em que a ficha foi aberta e quem confirmou, com data e hora. Uma ficha automática por filiação, sem duplicar.
   - Tabela `affiliation_document_events`: histórico e auditoria (aprovação, carteirinha, disponibilização, abertura, ciência, falhas).
   - Tabela `affiliation_processing_jobs`: registra cada etapa e seus erros, para permitir reprocessar com segurança.
   - Regras de acesso: o sindicato vê as fichas da sua clínica; empresa e contador acessam pelas funções do portal, sempre filtrando pelo CNPJ.
2. **Função `process-affiliation-approval`** (chamada pela aprovação e reexecutável)
   - Valida a empresa pelo vínculo cadastrado e pelo CNPJ exato. Se não bater, abre uma pendência administrativa e não envia a ficha.
   - Gera a ficha assinada com o recurso que já existe e a guarda em área privada.
   - Cria a carteirinha (emissão hoje, validade de 30 dias, ativa) só se ainda não houver uma vigente.
   - Cria a pendência de ciência e as notificações internas. Tudo isso é idempotente.
   - A aprovação continua valendo mesmo se alguma etapa falhar; nesse caso, aparece o botão "Reprocessar".
3. **Ciência e bloqueio no servidor**
   - Função `affiliation-acknowledge`: confirma uma ou várias fichas, exigindo que cada uma já tenha sido aberta.
   - Funções `set-contribution-value` e de geração de boletos do portal: recusam a operação quando há ficha pendente para aquele CNPJ. Consultas, comprovantes e histórico continuam liberados.
4. **Telas**
   - Sindicato: aba no cadastro da empresa, indicadores e "Reprocessar".
   - Portal da Empresa: aviso em destaque, menu Filiações Recebidas, visualizador da ficha com a caixa de declaração e o aviso de bloqueio na área de boletos.
   - Portal do Contador: indicador consolidado, lista das empresas pendentes e confirmação em lote.
5. **Testes:** regras de bloqueio e idempotência; fluxo completo com um associado de teste, sem enviar WhatsApp ou e-mail externo e sem mexer no dependente protegido.

## Pontos a confirmar
- A notificação para empresa e contador será apenas dentro dos portais. Nenhum WhatsApp ou e-mail sai automaticamente sem a sua autorização.
- Fichas e filiações antigas não entram no fluxo automático. Só serão incluídas se forem enviadas manualmente.

## Detalhes técnicos
- Reaproveita `sindical_associados.employer_id`/`empresa_cnpj`, `patient_cards`, `resolve-filiacao-assets`/`filiacaoPdfAssets`, o vínculo `accounting_office_employers` e os portais existentes.
- O controle de ciência roda no servidor, sem confiar no bloqueio da tela, pelo mesmo princípio da validação da lista de trabalhadores.
- `FiliacaoApprovalDialog` passa a chamar a nova função logo depois de gravar a aprovação. O fluxo de WhatsApp de boas-vindas não muda.
