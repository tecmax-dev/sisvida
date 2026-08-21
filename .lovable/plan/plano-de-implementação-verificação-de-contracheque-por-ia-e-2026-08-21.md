# Plano de Implementação: Verificação de Contracheque por IA e Melhorias em Contribuições

Este plano visa restaurar o sistema de verificação automática de contracheques usando a API da OpenAI (GPT-4o Vision) e implementar restrições de edição de datas em contribuições nos portais de Empresas e Escritórios de Contabilidade.

## Mudanças Propostas

### 1. Verificação de Contracheque por IA (Edge Function)
- **Implementar a Edge Function `verify-payslip-document`**: Criar a função que recebe uma imagem ou PDF do associado, utiliza o modelo GPT-4o Vision para identificar se o documento é um contracheque válido e se contém os descontos sindicais obrigatórios (Mensalidade, Taxa Assistencial ou Negocial).
- **Integração com o Frontend**: Ajustar o componente `CardExpiryWithPayslipDialog.tsx` para tratar erros de forma mais detalhada, facilitando o diagnóstico de falhas na comunicação com o backend.

### 2. Restrições de Edição de Contribuições (Portais de Empresa e Escritório)
- **Bloqueio de Data em Contribuições a Vencer**: Impedir a alteração da data de vencimento em contribuições que ainda não venceram e possuem valor zerado.
- **Permissão para Contribuições Vencidas**: Permitir a alteração da data apenas para contribuições que já passaram do vencimento, independente de possuírem valor preenchido ou não.
- **Componentes Afetados**:
    - `EmployerContributionsTab.tsx` (Portal da Empresa e Painel Administrativo)
    - `MemberContributionsTab.tsx` (Portal de Sócios PF)
    - Diálogos de edição (`PFContributionDetailDialog.tsx` e similares).

## Detalhes Técnicos

### Backend (Edge Function)
- Arquivo: `supabase/functions/verify-payslip-document/index.ts`
- Dependência: `OPENAI_API_KEY` (utilizando a chave configurada no gateway de IA).
- Prompt: Especializado para reconhecimento de campos de folha de pagamento brasileira.

### Frontend
- **Validação de Data**:
    ```typescript
    const isOverdue = new Date(contribution.due_date) < new Date();
    const canEditDate = isOverdue; // Restrição solicitada
    ```
- **UI**: O ícone de edição (lápis) ou os campos de data nos diálogos ficarão desabilitados se a contribuição estiver "a vencer" e com valor zerado.

## Próximos Passos
1. Finalizar a criação da Edge Function.
2. Aplicar as travas de data nos componentes de lista e diálogo.
3. Testar o fluxo completo de upload e validação de contracheque.
