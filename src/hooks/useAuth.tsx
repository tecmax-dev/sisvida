import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * AUTH MÍNIMO FUNCIONAL
 * 
 * Este hook gerencia APENAS a sessão do Supabase.
 * NÃO carrega perfil, roles, ou dados extras.
 * 
 * A lógica de redirecionamento pós-login está na página Auth.tsx.
 * Este provider apenas mantém o estado da sessão.
 */

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
  
  // Flag para evitar carregamento duplicado
  const [dataLoaded, setDataLoaded] = useState(false);

  // Logout simples e direto
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('[Auth] Erro no signOut:', e);
    }
    
    // Limpar estados
    setProfile(null);
    setUserRoles([]);
    setCurrentClinic(null);
    setIsSuperAdmin(false);
    setRolesLoaded(false);
    setDataLoaded(false);
    setSession(null);
    setUser(null);
  }, []);

  // Função para carregar dados do usuário (lazy - chamada sob demanda)
  const loadUserData = useCallback(async (userId: string) => {
    if (dataLoaded) return;
    
    try {
      // Carregar perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Verificar super admin
      const { data: saData } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      setIsSuperAdmin(!!saData);

      // Carregar roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select(`
          clinic_id,
          role,
          access_group_id,
          professional_id,
          clinic:clinics (
            id, name, slug, address, phone, cnpj, logo_url,
            whatsapp_header_image_url, is_blocked, blocked_reason,
            is_maintenance, maintenance_reason, entity_nomenclature
          )
        `)
        .eq('user_id', userId);

      if (rolesData && rolesData.length > 0) {
        const roles = rolesData
          .filter((item) => item.clinic)
          .map((item) => ({
            clinic_id: item.clinic_id,
            role: item.role as UserRole['role'],
            access_group_id: item.access_group_id as string | null,
            professional_id: item.professional_id as string | null,
            clinic: item.clinic as unknown as Clinic,
          }));

        setUserRoles(roles);
        if (!currentClinic && roles[0]?.clinic) {
          setCurrentClinic(roles[0].clinic);
        }
      } else if (saData) {
        // Super admin: carregar todas as clínicas
        const { data: clinics } = await supabase
          .from('clinics')
          .select('id, name, slug, address, phone, cnpj, logo_url, whatsapp_header_image_url, is_blocked, blocked_reason, is_maintenance, maintenance_reason, entity_nomenclature')
          .order('name');

        if (clinics) {
          const roles: UserRole[] = clinics.map((c) => ({
            clinic_id: c.id,
            role: 'admin' as const,
            access_group_id: null,
            professional_id: null,
            clinic: c as Clinic,
          }));

          setUserRoles(roles);
          if (!currentClinic && roles[0]?.clinic) {
            setCurrentClinic(roles[0].clinic);
          }
        }
      }

      setRolesLoaded(true);
      setDataLoaded(true);
    } catch (err) {
      console.error('[Auth] Erro ao carregar dados:', err);
      setRolesLoaded(true);
      setDataLoaded(true);
    }
  }, [currentClinic, dataLoaded]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      setDataLoaded(false);
      await loadUserData(user.id);
    }
  }, [user, loadUserData]);

  useEffect(() => {
    // Auth state listener - APENAS mantém sessão, NÃO redireciona
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[Auth] onAuthStateChange:', event);
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Carregar dados em background (não bloqueia)
          loadUserData(newSession.user.id);
        } else {
          // Limpar estados quando não há sessão
          setProfile(null);
          setUserRoles([]);
          setCurrentClinic(null);
          setIsSuperAdmin(false);
          setRolesLoaded(false);
          setDataLoaded(false);
        }
        
        // Loading false após determinar sessão
        setLoading(false);
      }
    );

    // Inicialização: verificar sessão existente
    const initSession = async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      
      if (existingSession?.user) {
        setSession(existingSession);
        setUser(existingSession.user);
        loadUserData(existingSession.user.id);
      }
      
      setLoading(false);
    };
    
    initSession();

    return () => subscription.unsubscribe();
  }, [loadUserData]);

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
