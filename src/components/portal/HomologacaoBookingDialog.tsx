import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, User, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string;
  phone?: string | null;
  email?: string | null;
}

interface Professional {
  id: string;
  name: string;
  slug: string;
  function?: string | null;
  avatar_url?: string | null;
}

interface HomologacaoBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employer: Employer | null;
  clinicSlug?: string;
  clinicId?: string;
}

export function HomologacaoBookingDialog({
  open,
  onOpenChange,
  employer,
  clinicSlug,
  clinicId,
}: HomologacaoBookingDialogProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadProfessionals = async () => {
      if (!open || !clinicId) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("homologacao_professionals")
          .select("id, name, slug, function, avatar_url")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .eq("public_booking_enabled", true);

        if (error) throw error;
        setProfessionals(data || []);
      } catch (err) {
        console.error("Error loading professionals:", err);
        toast.error("Erro ao carregar profissionais");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfessionals();
  }, [open, clinicId]);

  const handleSelectProfessional = (professional: Professional) => {
    if (!employer) return;

    // Build URL with query params for auto-fill
    const params = new URLSearchParams();
    params.set("company_name", employer.name);
    params.set("company_cnpj", employer.cnpj || "");
    if (employer.phone) params.set("company_phone", employer.phone);
    if (employer.email) params.set("company_email", employer.email);
    if (employer.trade_name) params.set("company_trade_name", employer.trade_name);
    params.set("from_portal", "contador");

    const url = `/agendamento/profissional/${professional.slug}?${params.toString()}`;
    window.open(url, "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-600" />
            Agendar Homologação
          </DialogTitle>
          <DialogDescription>
            Selecione o profissional para agendar a homologação da empresa
          </DialogDescription>
        </DialogHeader>

        {employer && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-900 text-sm">
                {employer.trade_name || employer.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 ml-6">
              CNPJ: {employer.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
            </p>
          </div>
        )}

        <div className="space-y-2 mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : professionals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <User className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Nenhum profissional disponível</p>
            </div>
          ) : (
            professionals.map((prof) => (
              <Card
                key={prof.id}
                className="cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-all"
                onClick={() => handleSelectProfessional(prof)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {prof.avatar_url ? (
                        <img
                          src={prof.avatar_url}
                          alt={prof.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-emerald-700">
                            {prof.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{prof.name}</p>
                        {prof.function && (
                          <p className="text-xs text-slate-500">{prof.function}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <span className="text-xs font-medium">Agendar</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
