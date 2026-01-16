import { ReactNode, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Calendar, Handshake, ExternalLink, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Convention {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  external_link: string | null;
  is_active: boolean;
}

interface PortalConventionsSectionProps {
  clinicId: string;
}

export function PortalConventionsSection({ clinicId }: PortalConventionsSectionProps) {
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConventions = async () => {
      try {
        const { data, error } = await supabase
          .from("union_app_content")
          .select("id, title, description, file_url, external_link, is_active")
          .eq("clinic_id", clinicId)
          .eq("content_type", "convencao")
          .eq("is_active", true)
          .order("order_index", { ascending: true })
          .limit(5);

        if (!error && data) {
          setConventions(data);
        }
      } catch (err) {
        console.error("Error loading conventions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (clinicId) {
      loadConventions();
    }
  }, [clinicId]);

  if (isLoading) {
    return (
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </CardContent>
      </Card>
    );
  }

  if (conventions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-indigo-600" />
          Convenções Coletivas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {conventions.map((convention) => (
            <a
              key={convention.id}
              href={convention.file_url || convention.external_link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-slate-900 text-sm truncate">
                    {convention.title}
                  </h4>
                  {convention.description && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {convention.description}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface PortalHomologacaoCardProps {
  clinicSlug?: string;
  onNavigate?: () => void;
}

export function PortalHomologacaoCard({ clinicSlug, onNavigate }: PortalHomologacaoCardProps) {
  const [professionals, setProfessionals] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);

  useEffect(() => {
    const loadClinicAndProfessionals = async () => {
      if (!clinicSlug) {
        setIsLoading(false);
        return;
      }

      try {
        // First get clinic by slug
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("id")
          .eq("slug", clinicSlug)
          .maybeSingle();

        if (!clinicData) {
          setIsLoading(false);
          return;
        }

        setClinicId(clinicData.id);

        // Then get professionals with homologation enabled
        const { data: profData } = await supabase
          .from("homologacao_professionals")
          .select("id, name, slug")
          .eq("clinic_id", clinicData.id)
          .eq("is_active", true)
          .limit(3);

        if (profData) {
          setProfessionals(profData);
        }
      } catch (err) {
        console.error("Error loading homologation data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadClinicAndProfessionals();
  }, [clinicSlug]);

  if (isLoading) {
    return null;
  }

  if (professionals.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-600" />
          Agendar Homologação
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <p className="text-sm text-slate-600 mb-4">
          Agende a homologação de rescisão de contrato de trabalho com nossos profissionais.
        </p>
        <div className="space-y-2">
          {professionals.map((prof) => (
            <a
              key={prof.id}
              href={`/agendamento/profissional/${prof.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center">
                  <span className="text-sm font-semibold text-emerald-700">
                    {prof.name.charAt(0)}
                  </span>
                </div>
                <span className="font-medium text-slate-900 text-sm">{prof.name}</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600">
                <span className="text-xs font-medium">Agendar</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
