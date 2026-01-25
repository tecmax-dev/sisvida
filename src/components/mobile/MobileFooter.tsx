import { Instagram, Facebook, Youtube, Globe, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClinicData {
  name: string;
  logo_url: string | null;
  entity_nomenclature: string | null;
}

export function MobileFooter() {
  const [clinic, setClinic] = useState<ClinicData | null>(null);

  useEffect(() => {
    const loadClinic = async () => {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) return;

      const { data } = await supabase
        .from("clinics")
        .select("name, logo_url, entity_nomenclature")
        .eq("id", clinicId)
        .single();

      if (data) setClinic(data);
    };
    loadClinic();
  }, []);

  const socialLinks = [
    { icon: Instagram, href: "#" },
    { icon: Facebook, href: "#" },
    { icon: Youtube, href: "#" },
    { icon: Globe, href: "#" },
  ];

  const handleWhatsApp = () => {
    window.open("https://wa.me/557332311784", "_blank");
  };

  return (
    <>
      <footer className="bg-emerald-600 text-white py-6 mt-4">
        <div className="px-6 text-center">
          <p className="text-sm font-medium mb-4">Nossos canais de comunicação</p>
          
          {/* Social links */}
          <div className="flex justify-center gap-4 mb-4">
            {socialLinks.map((social, idx) => (
              <a 
                key={idx}
                href={social.href} 
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <social.icon className="h-5 w-5 text-white" />
              </a>
            ))}
          </div>
        </div>
      </footer>

      {/* Copyright bar */}
      <div className="bg-gray-800 text-center py-3">
        <p className="text-[10px] text-gray-400">
          © 2026 Tecmax Tecnologia. Todos os Direitos Reservados
        </p>
      </div>
      
      {/* WhatsApp FAB - Floating Action Button */}
      <button
        onClick={handleWhatsApp}
        className="fixed bottom-24 right-4 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 z-50 hover:bg-green-600 active:scale-95 transition-all duration-200"
      >
        <MessageCircle className="h-7 w-7 text-white" />
      </button>
    </>
  );
}
