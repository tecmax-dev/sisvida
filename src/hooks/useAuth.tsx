import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTimeout } from "./useSessionTimeout";
import { SessionExpiryWarning } from "@/components/auth/SessionExpiryWarning";

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
  is_blocked?: boolean;
  blocked_reason?: string | null;
  is_maintenance?: boolean;
  maintenance_reason?: string | null;
}

interface UserRole {
  clinic_id: string;
  role: 'owner' | 'admin' | 'receptionist' | 'professional' | 'administrative';
  access_group_id: string | null;
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

  // Função de logout
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUserRoles([]);
    setCurrentClinic(null);
    setIsSuperAdmin(false);
    setRolesLoaded(false);
  };

  // Hook de timeout de sessão
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
    enabled: !!user
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
  };

  const fetchUserRoles = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select(`
        clinic_id,
        role,
        access_group_id,
        clinic:clinics (
          id,
          name,
          slug,
          address,
          phone,
          cnpj,
          logo_url,
          is_blocked,
          blocked_reason
        )
      `)
      .eq('user_id', userId);
    
    if (data && data.length > 0) {
      const roles = data.map(item => ({
        clinic_id: item.clinic_id,
        role: item.role as UserRole['role'],
        access_group_id: item.access_group_id as string | null,
        clinic: item.clinic as unknown as Clinic
      }));
      setUserRoles(roles);
      
      // Set first clinic as current if none selected
      if (!currentClinic && roles[0]?.clinic) {
        setCurrentClinic(roles[0].clinic);
      }
    } else {
      setUserRoles([]);
      setCurrentClinic(null);
    }
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
    const loadUserData = async (userId: string) => {
      try {
        await Promise.all([
          fetchProfile(userId),
          fetchUserRoles(userId),
          fetchSuperAdminStatus(userId),
        ]);
      } finally {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Salvar tempo de login quando faz login
          if (event === 'SIGNED_IN') {
            saveLoginTime();
          }
          
          setLoading(true);
          setRolesLoaded(false);
          // Defer data fetching to avoid deadlock
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        } else {
          // Limpar dados de sessão ao deslogar
          if (event === 'SIGNED_OUT') {
            clearSessionData();
          }
          
          setProfile(null);
          setUserRoles([]);
          setCurrentClinic(null);
          setIsSuperAdmin(false);
          setRolesLoaded(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [saveLoginTime, clearSessionData]);

  const signOut = async () => {
    clearSessionData();
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
