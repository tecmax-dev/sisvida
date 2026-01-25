 # Sistema de Persistência de Sessão - Documentação Técnica
 
 ## Visão Geral
 
 O sistema de autenticação foi projetado para manter a sessão do usuário ativa indefinidamente, sem timeouts automáticos. A sessão só é encerrada por ação explícita do usuário (logout manual) ou revogação no backend por motivos de segurança.
 
 ## Arquitetura
 
 ### 1. Camadas de Persistência (Mobile App)
 
 O PWA mobile utiliza três camadas redundantes para garantir persistência máxima:
 
 ```typescript
 // Implementado em src/hooks/useMobileSession.ts
 
 1. localStorage primário
    - Chaves: mobile_patient_id, mobile_clinic_id, mobile_patient_name
    - Acesso rápido, mas pode ser limpo pelo OS
 
 2. localStorage backup
    - Chaves: pwa_session_patient_id, pwa_session_clinic_id, pwa_session_name
    - Segunda camada de fallback
 
 3. IndexedDB
    - Database: "MobileAuthDB"
    - Store: "session"
    - Persistência máxima, resistente a limpezas do OS
 ```
 
 ### 2. Supabase Auto-Refresh
 
 ```typescript
 // src/integrations/supabase/client.ts
 export const supabase = createClient(URL, KEY, {
   auth: {
     storage: localStorage,
     persistSession: true,      // Manter sessão no localStorage
     autoRefreshToken: true,    // Renovar token automaticamente
     detectSessionInUrl: true   // Detectar sessão em callbacks
   }
 });
 ```
 
 O Supabase SDK gerencia automaticamente:
 - Renovação de tokens antes da expiração
 - Persistência de sessão no localStorage
 - Recuperação de sessão após reload
 
 ### 3. Sistema de Autenticação Principal
 
 ```typescript
 // src/hooks/useAuth.tsx
 
 - Timeout de sessão: DESABILITADO (enabled: false)
 - Validação agressiva: REMOVIDA
 - Confiança no autoRefreshToken do Supabase
 - Logout apenas via função handleSignOut()
 ```
 
 ## Fluxo de Autenticação
 
 ### Login
 
 1. Usuário faz login (credentials + CPF)
 2. Dados salvos nas 3 camadas (mobile) ou Supabase (web)
 3. Token armazenado com autoRefresh habilitado
 4. Navegação para tela principal
 
 ### Reabertura do App
 
 1. `initSession()` busca sessão no localStorage
 2. Se existe, confia no Supabase para validar/renovar
 3. Carrega dados do usuário (roles, perfil, clínica)
 4. Redireciona para tela principal
 5. **Nunca** força logout por timeout ou inatividade
 
 ### Renovação Automática
 
 - Supabase detecta token próximo da expiração
 - Renova automaticamente em background
 - Usuário nunca percebe a renovação
 - Sem interrupção da experiência
 
 ### Logout Manual
 
 ```typescript
 // Função centralizada em useAuth.tsx
 const handleSignOut = async () => {
   // 1. Lock local para prevenir race conditions
   localStorage.setItem('eclini_force_signed_out', '1');
   
   // 2. Limpar estados React
   setProfile(null);
   setUserRoles([]);
   // ... outros estados
   
   // 3. Logout local (funciona offline)
   await supabase.auth.signOut({ scope: 'local' });
   
   // 4. Logout global (best-effort)
   await supabase.auth.signOut({ scope: 'global' });
   
   // 5. Remover lock
   localStorage.removeItem('eclini_force_signed_out');
 };
 ```
 
 ## Garantias de Segurança
 
 ### O que NÃO causa logout:
 
 - ❌ Fechar o app
 - ❌ Minimizar o app
 - ❌ Recarregar a página
 - ❌ Perder conexão temporariamente
 - ❌ Erro de API
 - ❌ Timeout configurado (desabilitado)
 - ❌ Inatividade do usuário
 
 ### O que PODE causar logout:
 
 - ✅ Usuário clica em "Sair" no app
 - ✅ Token revogado manualmente no backend
 - ✅ Conta bloqueada/desativada no backend
 - ✅ Falha crítica na renovação do token (senha alterada, etc.)
 
 ## Tratamento de Erros
 
 ### Erro de Rede
 
 ```typescript
 // Operação offline-first - não força logout
 try {
   await supabase.auth.signOut({ scope: 'local' });
 } catch (e) {
   console.warn('Erro ao fazer signOut local:', e);
   // Continua execução, não trava o logout
 }
 ```
 
 ### Token Expirado (sem renovação possível)
 
 O Supabase automaticamente:
 1. Detecta falha na renovação
 2. Dispara evento `SIGNED_OUT`
 3. Hook `useAuth` reage limpando estados
 4. Usuário redirecionado para login
 
 ## Auditoria e Prevenção de Regressões
 
 ### Checklist de Validação
 
 Antes de modificar código de autenticação, verificar:
 
 - [ ] `useSessionTimeout` está com `enabled: false`?
 - [ ] Não há validação agressiva de sessão em `initSession()`?
 - [ ] `autoRefreshToken: true` no client Supabase?
 - [ ] `persistSession: true` no client Supabase?
 - [ ] Logout só ocorre via `handleSignOut()` ou evento `SIGNED_OUT`?
 - [ ] Não há `clearSessionData()` em outros lugares?
 - [ ] Guards de rota não forçam logout?
 - [ ] Interceptors de API não limpam sessão?
 
 ### Testes Manuais Obrigatórios
 
 1. **Teste de Reabertura**
    - Login no app
    - Fechar completamente
    - Aguardar 5 minutos
    - Reabrir app
    - ✅ Deve entrar direto na tela principal
 
 2. **Teste de Inatividade**
    - Login no app
    - Deixar aberto sem interagir por 30+ minutos
    - ✅ Deve permanecer logado
 
 3. **Teste de Rede**
    - Login no app
    - Desabilitar conexão
    - Navegar no app offline
    - Reabilitar conexão
    - ✅ Deve continuar logado
 
 4. **Teste de Logout**
    - Login no app
    - Clicar em "Sair"
    - ✅ Deve limpar sessão completamente
    - Reabrir app
    - ✅ Deve mostrar tela de login
 
 ## Troubleshooting
 
 ### Usuário sendo deslogado automaticamente
 
 1. Verificar se `useSessionTimeout` está com `enabled: false`
 2. Buscar por chamadas não autorizadas a `signOut()` ou `clearSessionData()`
 3. Verificar logs do Supabase para erros de renovação de token
 4. Confirmar que `autoRefreshToken` está habilitado
 
 ### Sessão não persiste após fechar app
 
 1. Verificar se localStorage está sendo limpo por outra parte do código
 2. Confirmar que `persistSession: true` no client
 3. Para mobile: verificar se as 3 camadas estão sendo escritas em `useMobileSession.ts`
 
 ### Token não está sendo renovado
 
 1. Verificar configuração do Supabase (JWT expiry time)
 2. Confirmar que não há erro de rede bloqueando renovação
 3. Verificar se o token não foi revogado manualmente
 
 ## Referências Técnicas
 
 - [Supabase Auth Persistence](https://supabase.com/docs/guides/auth/sessions)
 - [Supabase Auto Refresh](https://supabase.com/docs/guides/auth/sessions#automatic-session-refresh)
 - [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)