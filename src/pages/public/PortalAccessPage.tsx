import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

const PortalAccessPage = () => {
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
      description: "Emissão de boletos para empresas, gerenciamento de lista nominal e controle de outros acessos.",
      path: `/portal-empresa/${clinicData?.slug || ""}`,
    },
    {
      id: "socios",
      title: "Sócios",
      description: "Acesso restrito para associados, gerenciamento de benefícios, boletos e outros serviços.",
      path: `/portal-socio/${clinicData?.slug || ""}`,
    },
    {
      id: "escritorio",
      title: "Escritórios",
      description: "Emissão de boletos realizada por escritórios de contabilidade para gestores de múltiplas empresas.",
      path: `/portal-contador/${clinicData?.slug || ""}`,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header com fundo azul e pattern */}
      <div 
        className="relative py-12 px-4"
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)',
        }}
      >
        {/* Network pattern overlay */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        
        <div className="relative z-10 flex flex-col items-center justify-center">
          {/* Logo */}
          <div className="mb-6">
            {clinicData?.logo_url ? (
              <img 
                src={clinicData.logo_url} 
                alt={clinicData.name}
                className="h-20 w-auto object-contain"
              />
            ) : (
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            )}
          </div>
          
          {/* Title */}
          <h1 className="text-white text-xl font-medium">
            Escolha uma opção abaixo
          </h1>
        </div>
      </div>

      {/* Cards Section */}
      <div className="flex-1 bg-slate-100 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {portals.map((portal) => (
              <div 
                key={portal.id} 
                className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col"
              >
                <div className="p-6 flex-1 flex flex-col">
                  {/* Title */}
                  <h2 className="text-xl font-bold text-slate-800 text-center mb-3">
                    {portal.title}
                  </h2>
                  
                  {/* Description */}
                  <p className="text-slate-600 text-sm text-center leading-relaxed flex-1">
                    {portal.description}
                  </p>
                </div>
                
                {/* Divider */}
                <div className="border-t border-slate-200" />
                
                {/* Button */}
                <div className="p-4">
                  <Link
                    to={portal.path}
                    className="block w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-center font-medium rounded transition-colors"
                  >
                    Acessar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <a href="#" className="hover:text-slate-900 transition-colors">Ajuda</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Termo de serviços</a>
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {clinicData?.name || "Sistema"}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PortalAccessPage;
