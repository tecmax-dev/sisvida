import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, User, Bell, Menu } from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Drawer */}
      <MobileDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen}
        patient={patient}
      />

      {/* Header */}
      <header className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button className="p-1" onClick={() => setDrawerOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <img src="/logo-sindicato.png" alt="SECMI" className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">SECMI</h1>
            <p className="text-xs opacity-90">SINDICATO DOS COMERCIÁRIOS</p>
          </div>
        </div>
        <button className="p-1">
          <Bell className="h-6 w-6" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-around z-50">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 py-1 px-3 ${isActive ? "text-emerald-600" : "text-gray-500"}`}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
