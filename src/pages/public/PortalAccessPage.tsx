import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";

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
      if (data) setClinicData(data);
    };
    fetchClinicData();
  }, []);

   const portals = [
     { id: "empresa", title: "Empresa", path: `/portal-empresa/${clinicData?.slug || ""}` },
     { id: "socios", title: "Sócio", path: `/portal-socio/${clinicData?.slug || ""}` },
     { id: "escritorio", title: "Escritório", path: `/portal-contador/${clinicData?.slug || ""}` },
   ];

   // Verificação para redirecionar se já houver slug e evitar rota /portal-acesso crua
   useEffect(() => {
     if (clinicData?.slug && window.location.pathname === "/portal-acesso") {
       // Se o usuário acessar a rota raiz sem slug, mas já carregamos os dados da clínica alvo,
       // opcionalmente poderíamos redirecionar para incluir o slug na URL para consistência.
     }
   }, [clinicData]);

  return (
    <PublicPageWrapper>
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-6 border-b border-slate-200">
          {clinicData?.logo_url ? (
            <img
              src={clinicData.logo_url}
              alt={clinicData.name}
              className="h-14 w-auto object-contain"
            />
          ) : (
            <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-7 h-7 text-slate-400" />
            </div>
          )}
          <span className="text-lg font-semibold text-slate-800">
            {clinicData?.name || "Sistema"}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <h1 className="text-base font-semibold text-slate-700 mb-6">
            Por favor, selecione:
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {portals.map((portal) => (
              <Link
                key={portal.id}
                to={portal.path}
                className="min-w-[140px] py-3 px-8 bg-blue-600 hover:bg-blue-700 text-white text-center font-medium rounded transition-colors text-sm"
              >
                {portal.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PublicPageWrapper>
  );
};

export default PortalAccessPage;
