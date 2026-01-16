import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Portal Sections */}
        <div className="space-y-8">
          {portals.map((portal) => (
            <div key={portal.id} className="pb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-3">
                {portal.title}
              </h2>
              <p className="text-slate-600 mb-4 leading-relaxed">
                {portal.description}
              </p>
              <hr className="border-slate-200 mb-4" />
              <Link
                to={portal.path}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
              >
                Acessar
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortalAccessPage;
