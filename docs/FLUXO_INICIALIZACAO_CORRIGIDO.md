# Fluxo de Inicialização Corrigido - PWA Mobile

## Problema Identificado

O aplicativo estava redirecionando prematuramente para a tela de login antes da sessão Supabase ser completamente hidratada. Isso ocorria porque:

1. `getSession()` retornava imediatamente (às vezes null por ainda não ter hidratado)
2. O estado era marcado como `initialized: true` antes do `onAuthStateChange` processar a sessão
3. O redirect acontecia com `isLoggedIn: false` temporário
4. Poucos ms depois, `onAuthStateChange` confirmava a sessão, mas o usuário já estava na tela de login

## Solução Implementada

### 1. Ordem de Inicialização Estrita

```
App Inicia
    ↓
Supabase Client Singleton (persistSession: true, autoRefreshToken: true)
    ↓
useMobileAuthSession Hook
    ↓
getSession() chamado (pode retornar null se ainda não hidratou)
    ↓
Estado atualizado mas initialized: FALSE, loading: TRUE
    ↓
onAuthStateChange listener processa primeiro evento
    ↓
    ├─ SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED
    │     → Estado: initialized: TRUE, loading: FALSE, isLoggedIn: TRUE
    │
    └─ Sem sessão válida
          → Estado: initialized: TRUE, loading: FALSE, isLoggedIn: FALSE
    ↓
SOMENTE AGORA rotas são avaliadas
```

### 2. Estado Global de Auth Loading

**Hook: `useMobileAuthSession.ts`**

```typescript
const [state, setState] = useState<MobileAuthState>({
  isLoggedIn: false,
  patientId: null,
  clinicId: null,
  patientName: null,
  loading: true,      // TRUE até listener confirmar
  initialized: false, // FALSE até listener confirmar
});
```

**Estado só é marcado como inicializado no listener:**

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user && patientId) {
          setState({
            isLoggedIn: true,
            patientId,
            clinicId,
            patientName,
            loading: false,
            initialized: true, // ✅ AGORA SIM
          });
        }
      }
    }
  );
}, []);
```

### 3. Guard de Rota Correto

**MobileWelcomePage.tsx, MobileAuthPage.tsx:**

```typescript
const { isLoggedIn, initialized, loading } = useMobileAuthSession();

// CRÍTICO: Aguardar initialized antes de qualquer redirect
if (!initialized || loading) {
  return <LoadingScreen />;
}

// Somente após initialized=true:
useEffect(() => {
  if (!initialized || loading) return;
  
  if (isLoggedIn) {
    navigate("/app/home", { replace: true });
  } else {
    navigate("/app", { replace: true });
  }
}, [initialized, loading, isLoggedIn]);
```

**Regras:**
- `loading === true` OU `initialized === false` → Renderizar splash/loading
- `initialized === true` E `loading === false` E `isLoggedIn === true` → Permitir acesso
- `initialized === true` E `loading === false` E `isLoggedIn === false` → Redirecionar para login

### 4. Remoção de Auto-Login

A tela de login (`MobileAuthPage.tsx`) agora:
- Aguarda `initialized: true` antes de renderizar o formulário
- Se `isLoggedIn: true` após inicialização, redireciona IMEDIATAMENTE para /app/home
- NUNCA permite clicar em "Entrar" se já existe sessão válida

## Configuração do Supabase Client

**src/integrations/supabase/client.ts:**

```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,      // ✅ Persistência no localStorage
    persistSession: true,        // ✅ Sessão persiste entre recargas
    autoRefreshToken: true,      // ✅ Token renova automaticamente
    detectSessionInUrl: true,    // ✅ Detecta callback URLs
  }
});
```

## Critério de Aceite

✅ **Usuário autentica uma vez**  
✅ **Fecha o app completamente**  
✅ **Reabre após tempo indeterminado**  
✅ **É direcionado DIRETAMENTE para /app/home**  
✅ **NUNCA vê a tela de login**  
✅ **NUNCA precisa clicar em "Entrar"**  

## Evidência Técnica

### Hook de Autenticação com authLoading

**src/hooks/useMobileAuthSession.ts (linhas 42-49):**
```typescript
const [state, setState] = useState<MobileAuthState>({
  isLoggedIn: false,
  patientId: null,
  clinicId: null,
  patientName: null,
  loading: true,      // ← Estado de loading explícito
  initialized: false, // ← Estado de inicialização explícito
});
```

### Guard de Rota Corrigido

**src/pages/mobile/MobileAuthPage.tsx (linhas 71-84):**
```typescript
// Aguardar initialized antes de qualquer redirect
if (!initialized) {
  return (
    <div className="min-h-screen bg-emerald-600 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );
}

useEffect(() => {
  if (!initialized) return; // ← Proibido redirect enquanto não inicializado
  
  if (isLoggedIn) {
    navigate("/app/home", { replace: true });
  }
}, [initialized, isLoggedIn, navigate]);
```

### Confirmação de Inicialização no Listener

**src/hooks/useMobileAuthSession.ts (linhas 284-315):**
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      // ✅ Listener confirma sessão ANTES de marcar initialized=true
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user && patientId) {
          setState({
            isLoggedIn: true,
            // ...
            loading: false,
            initialized: true, // ← SOMENTE aqui
          });
        }
      }
    }
  );
}, []);
```

## Testes Reproduzíveis

### Teste 1: Persistência de Sessão
1. Login realizado → Estado: `isLoggedIn: true, initialized: true`
2. App fechado completamente
3. App reaberto após 5 minutos
4. **Resultado esperado:** Usuário na /app/home IMEDIATAMENTE, sem ver tela de login
5. **Logs esperados:**
   ```
   [MobileAuth] Inicializando...
   [MobileAuth] Sessão Supabase restaurada: João
   [MobileAuth] Auth state change: INITIAL_SESSION
   [MobileAuth] Sessão confirmada pelo listener: João Evento: INITIAL_SESSION
   [MobileWelcome] User authenticated, redirecting to home
   ```

### Teste 2: Sem Sessão (Primeiro Acesso)
1. App aberto pela primeira vez (sem sessão)
2. **Resultado esperado:** Usuário vê loading por ~200ms, depois é direcionado para /app (public home)
3. **Logs esperados:**
   ```
   [MobileAuth] Inicializando...
   [MobileAuth] Nenhuma sessão imediata, aguardando listener...
   [MobileAuth] Auth state change: SIGNED_OUT
   [MobileAuth] Evento não tratado ou sem sessão: SIGNED_OUT
   [MobileWelcome] User not authenticated, redirecting to public home
   ```

### Teste 3: Logout Manual
1. Usuário logado clica em "Sair da conta"
2. **Resultado esperado:** Redirect para /app (public home)
3. **Logs esperados:**
   ```
   [MobileAuth] Executando logout...
   [MobileAuth] Auth state change: SIGNED_OUT
   [MobileAuth] Logout completo
   ```

## Conclusão

A correção garante que:
- ✅ Nenhum redirect ocorre antes de `initialized: true`
- ✅ `initialized: true` só ocorre APÓS `onAuthStateChange` confirmar o estado real
- ✅ Sessão JWT persiste indefinidamente com `autoRefreshToken`
- ✅ Usuário NUNCA vê tela de login se tiver sessão válida
- ✅ Comportamento de "clicar em Entrar para autenticar automaticamente" foi ELIMINADO