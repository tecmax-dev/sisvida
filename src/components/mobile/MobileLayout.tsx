import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, CalendarDays, IdCard, Newspaper, Menu } from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useDynamicPWA } from "@/hooks/useDynamicPWA";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import { MobileNotificationBell } from "./MobileNotificationBell";
import { MobilePopupNotice } from "./MobilePopupNotice";
import { useActivePopupNotices } from "@/hooks/usePopupNotices";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

interface MobileLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
}

interface PatientData {
  name: string;
  email: string | null;
  photo_url: string | null;
}

interface ClinicData {
  name: string;
  logo_url: string | null;
  entity_nomenclature: string | null;
}

export function MobileLayout({ children, showBottomNav = true }: MobileLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [clinic, setClinic] = useState<ClinicData | null>(null);

  // Usar hook de autenticação com sessão JWT persistente
  const { patientId, clinicId, isLoggedIn, initialized } = useMobileAuth();

  // Initialize push notifications - use fallback for anonymous users in sindicato app
  usePushNotifications({ 
    patientId, 
    clinicId, 
    fallbackClinicId: SINDICATO_CLINIC_ID 
  });

  // Update PWA branding (favicon, manifest, meta tags) to clinic data
  useDynamicPWA();

  // Fetch active popup notices for the clinic
  const effectiveClinicId = clinicId || SINDICATO_CLINIC_ID;
  const { data: popupNotices } = useActivePopupNotices(effectiveClinicId);

  useEffect(() => {
    if (patientId) {
      loadPatientData(patientId);
    }
  }, [patientId]);

  useEffect(() => {
    if (clinicId) {
      loadClinicData(clinicId);
    }
  }, [clinicId]);

  const loadPatientData = async (id: string) => {
    const { data } = await supabase
      .from("patients")
      .select("name, email, photo_url")
      .eq("id", id)
      .single();

    if (data) {
      setPatient(data);
    }
  };

  const loadClinicData = async (id: string) => {
    const { data } = await supabase
      .from("clinics")
      .select("name, logo_url, entity_nomenclature")
      .eq("id", id)
      .single();

    if (data) {
      setClinic(data);
    }
  };

  const navItems = [
    { path: "/app", icon: Home, label: "Início" },
    { path: "/app/agendamentos", icon: CalendarDays, label: "Agendar" },
    { path: "/app/carteirinha", icon: IdCard, label: "Carteirinha" },
    { path: "/app/comunicacao/jornais", icon: Newspaper, label: "Notícias" },
    { path: "#menu", icon: Menu, label: "Menu" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Drawer */}
      <MobileDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen}
        patient={patient}
      />

      {/* Header - Clean green design */}
      <header className="bg-mobile text-mobile-foreground px-3 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md safe-area-top">
        <button 
          className="inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-mobile-foreground/10 active:bg-mobile-foreground/15" 
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center overflow-hidden ring-2 ring-mobile-foreground/20">
            {(() => {
              const isSindicato = (clinicId || SINDICATO_CLINIC_ID) === SINDICATO_CLINIC_ID;
              const remote = clinic?.logo_url || "";
              const stale =
                remote.includes("eahhszmbyxapxzilfdlo") ||
                remote.toLowerCase().includes("secmi");
              const src = isSindicato || stale || !remote
                ? "/sindicato/logo.png?v=20260428"
                : remote;
              return (
                <img
                  src={src}
                  alt={clinic?.name || "Logo"}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = "/sindicato/logo.png?v=20260428"; }}
                />
              );
            })()}
          </div>
          <div>
            <h1 className="font-display font-semibold text-base sm:text-lg leading-tight line-clamp-1">{clinic?.name || "Sindicato"}</h1>
          </div>
        </div>
        
        <MobileNotificationBell />
      </header>

      {/* Main Content */}
      <main className={`flex-1 w-full ${showBottomNav ? 'pb-24' : ''}`}>{children}</main>

      {/* Bottom Navigation - Simple clean design */}
      {showBottomNav && (
        <nav aria-label="Navegação do aplicativo" className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border px-2 gap-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 flex justify-around z-50 shadow-[0_-8px_24px_hsl(var(--foreground)/0.06)]">
          {navItems.map((item) => {
            const isMenu = item.path === "#menu";
            const isActive = isMenu ? drawerOpen : (location.pathname === item.path ||
              (item.path === "/app" && location.pathname === "/app/home") ||
              (item.path === "/app/agendamentos" && location.pathname === "/app/agendar"));
            return (
              <button
                key={item.path}
                onClick={() => (isMenu ? setDrawerOpen(true) : navigate(item.path))}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1.5 px-1 transition-colors duration-200 ${
                  isActive 
                    ? "bg-mobile-soft text-mobile font-semibold" 
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10.5px] font-medium truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Popup Notices */}
      {popupNotices && popupNotices.length > 0 && (
        <MobilePopupNotice notices={popupNotices} />
      )}
    </div>
  );
}
