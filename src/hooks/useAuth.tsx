import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTimeout } from "./useSessionTimeout";
import { SessionExpiryWarning } from "@/components/auth/SessionExpiryWarning";

// Fail-safe: evita deadlock infinito de loading caso alguma request fique pendurada.
const AUTH_BOOT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`[Auth] Timeout em ${label} após ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timeoutId);
        reject(err);
      });
  });
}

interface Profile {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  cnpj: string | null;
  logo_url: string | null;
  whatsapp_header_image_url?: string | null;
  created_at: string;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  is_maintenance?: boolean;
  maintenance_reason?: string | null;
  entity_nomenclature?: string | null;
}

interface UserRole {
  clinic_id: string;
  role: 'owner' | 'admin' | 'receptionist' | 'professional' | 'administrative';
  access_group_id: string | null;
  professional_id: string | null;
  clinic: Clinic;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  currentClinic: Clinic | null;
  userRoles: UserRole[];
  isSuperAdmin: boolean;
  loading: boolean;
  rolesLoaded: boolean;
  signOut: () => Promise<void>;
  setCurrentClinic: (clinic: Clinic | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * SISTEMA DE PERSISTÊNCIA DE SESSÃO
   * 
   * Este sistema foi projetado para manter a sessão ativa indefinidamente
   * até que o usuário faça logout manual ou o backend revogue a sessão.
   * 
   * Características:
   * - Supabase autoRefreshToken gerencia renovação automática de tokens
   * - Sem timeout de sessão ou inatividade
   * - Sessão persiste entre fechamentos/recargas do app
   * - Validação de sessão confia no sistema de refresh do Supabase
   * 
   * IMPORTANTE: Não adicione validações agressivas que possam limpar
   * a sessão automaticamente. A única forma de logout deve ser explícita.
   */

  // Função de logout robusta - local-first para garantir deslog mesmo offline
  const handleSignOut = async () => {
    // 1. Marcar lock de deslogado ANTES de tudo (proteção contra race conditions)
    localStorage.setItem('eclini_force_signed_out', '1');
    
    // 2. Limpar estados React imediatamente
    setProfile(null);
    setUserRoles([]);
    setCurrentClinic(null);
    setIsSuperAdmin(false);
    setRolesLoaded(false);
    setSession(null);
    setUser(null);
    
    // 3. Logout LOCAL primeiro (funciona offline, remove tokens do localStorage)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('[Auth] Erro ao fazer signOut local:', e);
    }
    
    // 4. Tentar logout global (best-effort, pode falhar se offline)
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('[Auth] Erro ao fazer signOut global (best-effort):', e);
    }
    
    // 5. Remover lock após confirmar que não há sessão
    const { data: { session: checkSession } } = await supabase.auth.getSession();
    if (!checkSession) {
      localStorage.removeItem('eclini_force_signed_out');
    }
  };

  // Detectar se é PWA instalado (mais robusto)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');
  
  // Verifica se está no app mobile - desabilita timeout para manter sessão persistente
  const isMobileApp = location.pathname.startsWith('/app') || location.pathname.startsWith('/m') || isPWA;

  // Hook de timeout de sessão (DESABILITADO COMPLETAMENTE - sessão só expira por logout manual)
  const {
    saveLoginTime,
    clearSessionData,
    renewSession: baseRenewSession,
    showWarning,
    timeRemaining,
  } = useSessionTimeout({
    maxSessionDuration: 480, // 8 horas
    inactivityTimeout: 30,   // 30 minutos
    warningTime: 5,          // 5 minutos de aviso
    onExpire: handleSignOut,
    enabled: false // DESABILITADO PERMANENTEMENTE - sessão persiste até logout manual
  });

  // Função de renovar sessão com redirecionamento para o dashboard
  const handleRenewSession = useCallback(() => {
    baseRenewSession();
    
    // Se o usuário não está no dashboard, redireciona para lá
    const isOnDashboard = location.pathname.startsWith('/dashboard');
    const isOnAdmin = location.pathname.startsWith('/admin');
    const isOnProfessional = location.pathname.startsWith('/profissional');
    
    if (!isOnDashboard && !isOnAdmin && !isOnProfessional) {
      if (isSuperAdmin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [baseRenewSession, location.pathname, isSuperAdmin, navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) {
      setProfile(data as Profile);
    }
  };

  const fetchSuperAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    setIsSuperAdmin(!!data);
    return !!data;
  };

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        clinic_id,
        role,
        access_group_id,
        professional_id,
        clinic:clinics (
          id,
          name,
          slug,
          address,
          phone,
          cnpj,
          logo_url,
          whatsapp_header_image_url,
          is_blocked,
          blocked_reason,
          is_maintenance,
          maintenance_reason,
          entity_nomenclature
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('[Auth] Error fetching user roles:', error);
    }

    // Caso padrão: usuário com roles em clínicas
    if (data && data.length > 0) {
      // Check for entidade_sindical_admin role (no clinic_id)
      const unionAdminRole = data.find(
        (item) => item.role === 'entidade_sindical_admin' && !item.clinic_id
      );

      if (unionAdminRole) {
        // Fetch union entity to get linked clinic
        const { data: entityData } = await supabase
          .from('union_entities')
          .select(`
            id,
            razao_social,
            nome_fantasia,
            clinic_id,
            clinic:clinics (
              id,
              name,
              slug,
              address,
              phone,
              cnpj,
              logo_url,
              whatsapp_header_image_url,
              is_blocked,
              blocked_reason,
              is_maintenance,
              maintenance_reason,
              entity_nomenclature
            )
          `)
          .eq('user_id', userId)
          .maybeSingle();

        if (entityData?.clinic) {
          const entityClinic = entityData.clinic as unknown as Clinic;
          const roles: UserRole[] = [{
            clinic_id: entityClinic.id,
            role: 'admin', // Treat as admin for permissions
            access_group_id: null,
            professional_id: null,
            clinic: entityClinic,
          }];

          setUserRoles(roles);
          setCurrentClinic(entityClinic);
          setRolesLoaded(true);
          return;
        }
      }

      // Regular clinic roles
      const roles = data
        .filter((item) => item.clinic) // Only include roles with valid clinics
        .map((item) => ({
          clinic_id: item.clinic_id,
          role: item.role as UserRole['role'],
          access_group_id: item.access_group_id as string | null,
          professional_id: item.professional_id as string | null,
          clinic: item.clinic as unknown as Clinic,
        }));

      setUserRoles(roles);

      // Set first clinic as current if none selected
      if (!currentClinic && roles[0]?.clinic) {
        setCurrentClinic(roles[0].clinic);
      }

      setRolesLoaded(true);
      return;
    }

    // Super admin: precisa de um "contexto" de clínica para telas do dashboard
    const isSa = await fetchSuperAdminStatus(userId);
    if (isSa) {
      const { data: clinics, error: clinicsError } = await supabase
        .from('clinics')
        .select('id, name, slug, address, phone, cnpj, logo_url, whatsapp_header_image_url, is_blocked, blocked_reason, is_maintenance, maintenance_reason, entity_nomenclature')
        .order('name');

      if (clinicsError) {
        console.error('[Auth] Error fetching clinics for super admin:', clinicsError);
        setUserRoles([]);
        setCurrentClinic(null);
        setRolesLoaded(true);
        return;
      }

      const roles: UserRole[] = (clinics || []).map((c) => ({
        clinic_id: c.id,
        role: 'admin',
        access_group_id: null,
        professional_id: null,
        clinic: c as Clinic,
      }));

      setUserRoles(roles);

      if (!currentClinic && roles[0]?.clinic) {
        setCurrentClinic(roles[0].clinic);
      }

      setRolesLoaded(true);
      return;
    }

    // Check if user is a union entity admin without clinic linked
    const { data: entityWithoutClinic } = await supabase
      .from('union_entities')
      .select('id, razao_social, nome_fantasia')
      .eq('user_id', userId)
      .maybeSingle();

    if (entityWithoutClinic) {
      console.warn('[Auth] Union entity user without linked clinic:', entityWithoutClinic.razao_social);
      // Allow access but no clinic context
      setUserRoles([]);
      setCurrentClinic(null);
      setRolesLoaded(true);
      return;
    }

    // Sem roles e não super admin
    setUserRoles([]);
    setCurrentClinic(null);
    setRolesLoaded(true);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchUserRoles(user.id);
      await fetchSuperAdminStatus(user.id);
    }
  };

  useEffect(() => {
    // Refs fora do closure para manter estado entre execuções do listener
    let isLoadingUserData = false;
    let lastLoadedUserId: string | null = null;

    const loadUserData = async (userId: string) => {
      // Guard: evitar múltiplas execuções simultâneas
      if (isLoadingUserData) {
        console.log('[Auth] loadUserData já em execução, ignorando');
        return;
      }
      
      isLoadingUserData = true;
      
      try {
        // Carregar dados em background - não bloquear o UI
        await Promise.all([
          withTimeout(fetchProfile(userId), AUTH_BOOT_TIMEOUT_MS, "fetchProfile").catch(e => {
            console.warn("[Auth] Falha ao carregar profile:", e.message);
          }),
          withTimeout(fetchUserRoles(userId), AUTH_BOOT_TIMEOUT_MS, "fetchUserRoles").catch(e => {
            console.warn("[Auth] Falha ao carregar roles:", e.message);
          }),
          withTimeout(fetchSuperAdminStatus(userId), AUTH_BOOT_TIMEOUT_MS, "fetchSuperAdminStatus").catch(e => {
            console.warn("[Auth] Falha ao verificar super admin:", e.message);
          }),
        ]);
        lastLoadedUserId = userId;
      } catch (e) {
        console.error("[Auth] Falha ao carregar dados do usuário:", e);
      } finally {
        isLoadingUserData = false;
        setRolesLoaded(true);
      }
    };

    // LISTENER PASSIVO: Apenas atualiza sessão/user, carrega dados em background
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] onAuthStateChange:', event, session?.user?.id?.slice(0, 8));
        
        // Atualizar estado de sessão/user SEMPRE
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // CRÍTICO: Não recarregar se já temos dados do mesmo user
          if (lastLoadedUserId === session.user.id) {
            console.log('[Auth] Dados já carregados para', session.user.id.slice(0, 8));
            return;
          }
          
          // Carregar dados em background (não bloqueia loading)
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        } else {
          // Logout: limpar estado
          lastLoadedUserId = null;
          setProfile(null);
          setUserRoles([]);
          setCurrentClinic(null);
          setIsSuperAdmin(false);
          setRolesLoaded(false);
        }
      }
    );

    // Inicialização única - RÁPIDA
    const initSession = async () => {
      // Verificar lock de logout forçado
      const forceSignedOut = localStorage.getItem('eclini_force_signed_out');
      if (forceSignedOut) {
        console.warn('[Auth] Lock de logout detectado, forçando signOut local');
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (e) {
          console.warn('[Auth] Falha ao forçar signOut local:', e);
        }
        localStorage.removeItem('eclini_force_signed_out');
        setLoading(false);
        setRolesLoaded(true);
        return;
      }
      
      let session: Session | null = null;
      try {
        const res = await withTimeout(
          supabase.auth.getSession(),
          AUTH_BOOT_TIMEOUT_MS,
          "supabase.auth.getSession"
        );
        session = res.data.session;
        if (res.error) {
          console.error('[Auth] Erro ao obter sessão:', res.error);
        }
      } catch (e) {
        console.error('[Auth] Timeout ao obter sessão:', e);
      }

      // CRÍTICO: Liberar loading IMEDIATAMENTE após determinar sessão
      // O carregamento de dados acontece em background
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // <-- Libera UI imediatamente
      
      if (session?.user) {
        // Carregar dados em background
        loadUserData(session.user.id);
      } else {
        setRolesLoaded(true);
      }
    };
    
    initSession();

    return () => subscription.unsubscribe();
  }, [saveLoginTime, clearSessionData]);

  const signOut = async () => {
    await handleSignOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      currentClinic, 
      userRoles, 
      isSuperAdmin,
      loading,
      rolesLoaded,
      signOut,
      setCurrentClinic,
      refreshProfile
    }}>
      {children}
      <SessionExpiryWarning
        open={showWarning}
        timeRemaining={timeRemaining}
        onRenew={handleRenewSession}
        onLogout={signOut}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
