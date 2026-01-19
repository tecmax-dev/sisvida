import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, User, Bell, Menu } from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useDynamicPWA } from "@/hooks/useDynamicPWA";

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

  // Get session data for push notifications
  const patientId = localStorage.getItem('mobile_patient_id');
  const clinicId = localStorage.getItem('mobile_clinic_id');

  // Initialize push notifications
  usePushNotifications({ patientId, clinicId });

  // Update PWA branding (favicon, manifest, meta tags) to clinic data
  useDynamicPWA();

  useEffect(() => {
    loadPatientData();
    loadClinicData();
  }, []);

  const loadPatientData = async () => {
    const patientId = localStorage.getItem('mobile_patient_id');
    if (!patientId) return;

    const { data } = await supabase
      .from("patients")
      .select("name, email, photo_url")
      .eq("id", patientId)
      .single();

    if (data) {
      setPatient(data);
    }
  };

  const loadClinicData = async () => {
    const clinicId = localStorage.getItem('mobile_clinic_id');
    if (!clinicId) return;

    const { data } = await supabase
      .from("clinics")
      .select("name, logo_url, entity_nomenclature")
      .eq("id", clinicId)
      .single();

    if (data) {
      setClinic(data);
    }
  };

  const navItems = [
    { path: "/app", icon: Home, label: "Início" },
    { path: "/app/agendamentos", icon: Calendar, label: "Consultas" },
    { path: "/app/perfil", icon: User, label: "Perfil" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Drawer */}
      <MobileDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen}
        patient={patient}
      />

      {/* Header - Clean green design */}
      <header className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button 
          className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 active:scale-95" 
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden">
            {clinic?.logo_url ? (
              <img 
                src={clinic.logo_url} 
                alt={clinic.name} 
                className="w-full h-full object-cover" 
                onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} 
              />
            ) : (
              <img 
                src="/placeholder.svg" 
                alt="Logo" 
                className="w-7 h-7 object-contain opacity-50" 
              />
            )}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{clinic?.name || "SECMI"}</h1>
            <p className="text-[10px] font-medium opacity-80">{clinic?.entity_nomenclature || "SINDICATO DOS COMERCIÁRIOS"}</p>
          </div>
        </div>
        
        <button className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 active:scale-95">
          <Bell className="h-6 w-6" />
        </button>
      </header>

      {/* Main Content */}
      <main className={`flex-1 ${showBottomNav ? 'pb-24' : ''}`}>{children}</main>

      {/* Bottom Navigation - Simple clean design */}
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-around z-50">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === "/app" && location.pathname === "/app/home");
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 py-2 px-4 transition-all duration-200 ${
                  isActive 
                    ? "text-emerald-600" 
                    : "text-gray-400"
                }`}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-[10px] font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
