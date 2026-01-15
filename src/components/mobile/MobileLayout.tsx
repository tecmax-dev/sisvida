import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, User, Bell, Menu, Sparkles } from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface MobileLayoutProps {
  children: ReactNode;
}

interface PatientData {
  name: string;
  email: string | null;
  photo_url: string | null;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [patient, setPatient] = useState<PatientData | null>(null);

  // Get session data for push notifications
  const patientId = sessionStorage.getItem('mobile_patient_id');
  const clinicId = sessionStorage.getItem('mobile_clinic_id');

  // Initialize push notifications
  usePushNotifications({ patientId, clinicId });

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    const patientId = sessionStorage.getItem('mobile_patient_id');
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

  const navItems = [
    { path: "/app", icon: Home, label: "Início" },
    { path: "/app/agendamentos", icon: Calendar, label: "Consultas" },
    { path: "/app/perfil", icon: User, label: "Perfil" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex flex-col">
      {/* Drawer */}
      <MobileDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen}
        patient={patient}
      />

      {/* Header - Premium gradient design */}
      <header className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-50 shadow-lg shadow-emerald-500/20">
        <button 
          className="p-2 hover:bg-white/10 rounded-xl transition-all duration-200 active:scale-95" 
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <img 
              src="/logo-sindicato.png" 
              alt="SECMI" 
              className="w-8 h-8 object-contain" 
              onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} 
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-lg leading-tight tracking-tight">SECMI</h1>
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <p className="text-[10px] font-medium opacity-90 tracking-wide">SINDICATO DOS COMERCIÁRIOS</p>
          </div>
        </div>
        
        <button className="p-2 hover:bg-white/10 rounded-xl transition-all duration-200 active:scale-95 relative">
          <Bell className="h-6 w-6" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">{children}</main>

      {/* Bottom Navigation - Glass morphism design */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100/50 px-6 py-3 flex justify-around z-50 shadow-2xl shadow-black/5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1.5 py-2 px-5 rounded-2xl transition-all duration-300 ${
                isActive 
                  ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-105" 
                  : "text-gray-400 hover:text-gray-600 active:scale-95"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "drop-shadow-sm" : ""}`} />
              <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "text-white" : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
