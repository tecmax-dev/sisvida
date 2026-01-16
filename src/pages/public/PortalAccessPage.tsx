import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Calculator, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

const PortalAccessPage = () => {
  const navigate = useNavigate();
  const [clinicData, setClinicData] = useState<{ name: string; logo_url: string | null; slug: string } | null>(null);

  useEffect(() => {
    const fetchClinicData = async () => {
      const { data } = await supabase
        .from("clinics")
        .select("name, logo_url, slug")
        .eq("id", TARGET_CLINIC_ID)
        .single();
      
      if (data) {
        setClinicData(data);
      }
    };
    fetchClinicData();
  }, []);

  const portals = [
    {
      id: "empresa",
      title: "Empresas",
      description: "Acesso exclusivo para empresas conveniadas",
      icon: Building2,
      color: "from-amber-500 to-orange-600",
      hoverColor: "hover:from-amber-600 hover:to-orange-700",
      path: `/portal-empresa/${clinicData?.slug || ""}`,
    },
    {
      id: "escritorio",
      title: "Escritórios",
      description: "Acesso para escritórios de contabilidade",
      icon: Calculator,
      color: "from-blue-500 to-indigo-600",
      hoverColor: "hover:from-blue-600 hover:to-indigo-700",
      path: `/portal-contador/${clinicData?.slug || ""}`,
    },
    {
      id: "socios",
      title: "Sócios",
      description: "Acesso exclusivo para associados",
      icon: Users,
      color: "from-emerald-500 to-teal-600",
      hoverColor: "hover:from-emerald-600 hover:to-teal-700",
      path: `/portal-socio/${clinicData?.slug || ""}`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Network Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="network" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="1.5" fill="currentColor" className="text-blue-400" />
              <circle cx="0" cy="0" r="1" fill="currentColor" className="text-blue-400" />
              <circle cx="100" cy="0" r="1" fill="currentColor" className="text-blue-400" />
              <circle cx="0" cy="100" r="1" fill="currentColor" className="text-blue-400" />
              <circle cx="100" cy="100" r="1" fill="currentColor" className="text-blue-400" />
              <line x1="50" y1="50" x2="0" y2="0" stroke="currentColor" strokeWidth="0.3" className="text-blue-400/50" />
              <line x1="50" y1="50" x2="100" y2="0" stroke="currentColor" strokeWidth="0.3" className="text-blue-400/50" />
              <line x1="50" y1="50" x2="0" y2="100" stroke="currentColor" strokeWidth="0.3" className="text-blue-400/50" />
              <line x1="50" y1="50" x2="100" y2="100" stroke="currentColor" strokeWidth="0.3" className="text-blue-400/50" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#network)" />
        </svg>
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          {clinicData?.logo_url ? (
            <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-white/10 backdrop-blur-sm p-2 shadow-2xl ring-2 ring-white/20">
              <img
                src={clinicData.logo_url}
                alt={clinicData.name}
                className="w-full h-full object-contain rounded-full"
              />
            </div>
          ) : (
            <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-2xl ring-2 ring-white/20">
              <Building2 className="w-14 h-14 text-white/70" />
            </div>
          )}
          
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {clinicData?.name || "Sindicato"}
          </h1>
          <p className="text-blue-200/80 text-lg">
            Acesso restrito, somente pessoas autorizadas.
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {portals.map((portal) => (
            <button
              key={portal.id}
              onClick={() => navigate(portal.path)}
              className={`group relative bg-gradient-to-br ${portal.color} ${portal.hoverColor} p-6 rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl`}
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/10 transition-all duration-300" />
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <portal.icon className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">{portal.title}</h2>
                <p className="text-white/80 text-sm">{portal.description}</p>
              </div>

              {/* Bottom shine effect */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent rounded-b-2xl" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} {clinicData?.name || "Sindicato"}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortalAccessPage;
