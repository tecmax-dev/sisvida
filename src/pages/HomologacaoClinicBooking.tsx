import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  MapPin, 
  Phone, 
  User, 
  Building2, 
  Mail,
  ChevronRight
} from "lucide-react";

interface Professional {
  id: string;
  name: string;
  function: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  slug: string;
  is_active: boolean;
  public_booking_enabled: boolean;
}

interface Clinic {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  logo_url: string | null;
}

export default function HomologacaoClinicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Fetch clinic by slug
  const { data: clinic, isLoading: loadingClinic, error: clinicError } = useQuery({
    queryKey: ["homologacao-clinic", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, phone, address, city, state_code, logo_url")
        .eq("slug", slug)
        .single();
      
      if (error) throw error;
      return data as Clinic;
    },
    enabled: !!slug,
  });

  // Fetch professionals for this clinic
  const { data: professionals, isLoading: loadingProfessionals } = useQuery({
    queryKey: ["homologacao-professionals-clinic", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_professionals")
        .select("*")
        .eq("clinic_id", clinic.id)
        .eq("is_active", true)
        .eq("public_booking_enabled", true);
      
      if (error) throw error;
      return data as Professional[];
    },
    enabled: !!clinic?.id,
  });

  const isLoading = loadingClinic || loadingProfessionals;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <Skeleton className="h-32 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (clinicError || !clinic) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Entidade não encontrada</h2>
            <p className="text-muted-foreground">
              Não foi possível encontrar a entidade solicitada. Verifique o link e tente novamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If only one professional, redirect directly to their booking page
  if (professionals && professionals.length === 1) {
    navigate(`/agendamento/profissional/${professionals[0].slug}`, { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <Card className="mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
            <div className="flex items-center gap-4">
              {clinic.logo_url ? (
                <img 
                  src={clinic.logo_url} 
                  alt={clinic.name} 
                  className="h-16 w-16 rounded-full bg-white p-1 object-contain"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                  <Building2 className="h-8 w-8" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{clinic.name}</h1>
                <p className="text-primary-foreground/80">
                  Agendamento de Homologação
                </p>
              </div>
            </div>
          </div>
          
          {(clinic.address || clinic.phone) && (
            <CardContent className="pt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {clinic.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{clinic.address}{clinic.city && `, ${clinic.city}`}{clinic.state_code && ` - ${clinic.state_code}`}</span>
                </div>
              )}
              {clinic.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  <span>{clinic.phone}</span>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Professionals List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Selecione um Profissional
            </CardTitle>
            <CardDescription>
              Escolha o profissional para realizar o agendamento da homologação
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!professionals || professionals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum profissional disponível para agendamento no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {professionals.map((prof) => (
                  <button
                    key={prof.id}
                    onClick={() => navigate(`/agendamento/profissional/${prof.slug}`)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
                  >
                    {prof.avatar_url ? (
                      <img 
                        src={prof.avatar_url} 
                        alt={prof.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{prof.name}</h3>
                      {prof.function && (
                        <p className="text-sm text-muted-foreground">{prof.function}</p>
                      )}
                      {prof.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{prof.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
