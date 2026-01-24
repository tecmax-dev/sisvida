import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import illustrationAjuda from "@/assets/mobile/illustration-ajuda.png";

interface HelpCardContent {
  title: string;
  subtitle: string;
  buttonText: string;
}

const defaultContent: HelpCardContent = {
  title: "Como chegar até nós?",
  subtitle: "",
  buttonText: "Ver no mapa",
};

export function MobileHelpSection() {
  const navigate = useNavigate();
  const [content, setContent] = useState<HelpCardContent>(defaultContent);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      let clinicId: string | null = null;
      
      // Try to get user's clinic_id if logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: patientData } = await (supabase as any)
          .from("patients")
          .select("clinic_id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        clinicId = patientData?.clinic_id;
      }
      
      // If no clinic_id from patient, fetch any active help content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("union_app_content")
        .select("metadata")
        .eq("content_type", "ajuda")
        .eq("is_active", true);
      
      if (clinicId) {
        query = query.eq("clinic_id", clinicId);
      }
      
      const { data: helpData } = await query.limit(1).maybeSingle();

      if (helpData?.metadata) {
        const metadata = helpData.metadata as Record<string, unknown>;
        setContent({
          title: (metadata.home_card_title as string) || defaultContent.title,
          subtitle: (metadata.home_card_subtitle as string) || defaultContent.subtitle,
          buttonText: (metadata.home_card_button_text as string) || defaultContent.buttonText,
        });
      }
    } catch (error) {
      console.error("Error loading help section content:", error);
    }
  };

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-bold text-foreground tracking-wide mb-3">PRECISA DE AJUDA?</h3>
      
      <div 
        className="bg-muted rounded-xl p-5 flex items-center justify-between border border-border"
      >
        <div className="flex-1">
          <h4 className="font-bold text-foreground text-lg mb-3">{content.title}</h4>
          {content.subtitle && (
            <p className="text-sm text-muted-foreground mb-3">{content.subtitle}</p>
          )}
          <Button 
            onClick={() => navigate("/app/ajuda")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
          >
            {content.buttonText}
          </Button>
        </div>
        
        <div className="w-28 h-28 flex-shrink-0">
          <img 
            src={illustrationAjuda} 
            alt="Ajuda"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}