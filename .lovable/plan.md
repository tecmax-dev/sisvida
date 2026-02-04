
# Plano: Criar Pasta "Contra cheques" para Todos os Sócios

## Resumo

Criar automaticamente a pasta **"Contra cheques"** na aba de anexos para todos os 5.586 sócios do sindicato que ainda não a possuem.

## Situação Atual

| Status | Quantidade |
|--------|-----------|
| Total de sócios ativos | 5.589 |
| Já possuem a pasta | 3 |
| Precisam da pasta | 5.586 |

## Abordagem

Existem duas estratégias possíveis:

### Opção A: Criação Automática no Frontend (Recomendada)
Quando o usuário acessar a aba "Anexos" de um sócio, verificar se a pasta "Contra cheques" já existe. Se não existir, criar automaticamente.

**Vantagens:**
- Não sobrecarrega o banco de dados criando milhares de pastas de uma vez
- As pastas são criadas sob demanda
- Código simples e fácil de manter

**Desvantagens:**
- A pasta só aparece quando alguém acessar a aba de anexos

### Opção B: Script SQL em Massa
Executar um script SQL que cria a pasta para todos os sócios que não a possuem.

**Vantagens:**
- Criação imediata para todos

**Desvantagens:**
- Insere ~5.586 registros de uma vez
- Precisa de um `created_by` (usuário) válido

---

## Plano de Implementação (Opção A - Recomendada)

### Etapa 1: Modificar `UnionMemberAttachmentsTab.tsx`

Adicionar lógica para garantir que a pasta "Contra cheques" exista quando a aba for carregada:

```text
1. Após fetchFolders() completar
2. Verificar se existe pasta com nome "Contra cheques"  
3. Se não existir, chamar createFolder("Contra cheques")
4. Atualizar a lista de pastas
```

### Etapa 2: Testes

- Acessar um sócio que não tenha a pasta
- Verificar se a pasta é criada automaticamente
- Confirmar que não duplica caso já exista

---

## Detalhes Técnicos

### Arquivo a ser modificado
- `src/components/union/members/UnionMemberAttachmentsTab.tsx`

### Lógica de criação automática

```typescript
useEffect(() => {
  const ensureContraChequesFolder = async () => {
    if (!folders.length) return;
    
    const hasFolder = folders.some(
      f => f.name.toLowerCase().includes('contra') && 
           f.name.toLowerCase().includes('cheque')
    );
    
    if (!hasFolder) {
      await createFolder("Contra cheques");
    }
  };
  
  ensureContraChequesFolder();
}, [folders]);
```

### Considerações
- A verificação usa `includes` para cobrir variações como "Contracheques" e "Contra cheques"
- Um flag evita múltiplas tentativas de criação
- A pasta é criada silenciosamente (sem toast de sucesso para não confundir o usuário)
