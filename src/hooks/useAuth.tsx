import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * AUTH PANIC MODE v2
 * 
 * Zero listeners no boot - apenas getSession inicial.
 * Login é 100% imperativo nas páginas Auth/ProfessionalAuth.
 * Dados carregam sob demanda.
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
  
  const loadingSetRef = useRef(false);
  const dataLoadedRef = useRef(false);

  console.info("[AUTH-PANIC] AuthProvider mount - panic mode v2");

  const signOut = useCallback(async () => {
    console.info("[AUTH-PANIC] signOut called");
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('[AUTH-PANIC] signOut error:', e);
    }
    
    setProfile(null);
    setUserRoles([]);
    setCurrentClinic(null);
    setIsSuperAdmin(false);
    setRolesLoaded(false);
    dataLoadedRef.current = false;
    setSession(null);
    setUser(null);
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    
    console.info("[AUTH-PANIC] loadUserData start", { userId });
    
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData as Profile);
      }

      const { data: saData } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      setIsSuperAdmin(!!saData);

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
      console.info("[AUTH-PANIC] loadUserData complete");
    } catch (err) {
      console.error('[AUTH-PANIC] loadUserData error:', err);
      setRolesLoaded(true);
    }
  }, [currentClinic]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      dataLoadedRef.current = false;
      await loadUserData(user.id);
    }
  }, [user, loadUserData]);

  // PANIC MODE: Apenas getSession inicial - ZERO listeners no boot
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      console.info("[AUTH-PANIC] init start");
      
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (existingSession?.user) {
          console.info("[AUTH-PANIC] init found session", { userId: existingSession.user.id });
          setSession(existingSession);
          setUser(existingSession.user);
          // Carregar dados do usuário
          await loadUserData(existingSession.user.id);
        } else {
          console.info("[AUTH-PANIC] init no session");
        }
      } catch (err) {
        console.error("[AUTH-PANIC] init error:", err);
      }
      
      // Loading = false APENAS UMA VEZ
      if (!loadingSetRef.current) {
        loadingSetRef.current = true;
        setLoading(false);
        console.info("[AUTH-PANIC] loading = false");
      }
    };
    
    init();
    
    // PANIC MODE: Listener MÍNIMO - apenas para logout/token refresh
    // NÃO dispara queries, NÃO faz redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        console.info("[AUTH-PANIC] onAuthStateChange", { event, hasSession: !!newSession });
        
        // Apenas sincroniza estado - sem lógica adicional
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (!newSession) {
          setProfile(null);
          setUserRoles([]);
          setCurrentClinic(null);
          setIsSuperAdmin(false);
          setRolesLoaded(false);
          dataLoadedRef.current = false;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      console.info("[AUTH-PANIC] AuthProvider unmount");
    };
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
