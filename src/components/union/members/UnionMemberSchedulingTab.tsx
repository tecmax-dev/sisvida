import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { 
  User,
  Calendar,
  Clock,
  ChevronRight,
  Stethoscope
} from "lucide-react";

interface Professional {
  id: string;
  name: string;
  photo_url: string | null;
  specialties: Array<{
    id: string;
    name: string;
    category: string;
  }>;
}

interface SpecialtyTab {
  id: string;
  name: string;
  count: number;
}

interface UnionMemberSchedulingTabProps {
  patientId: string;
  patientName: string;
}

export function UnionMemberSchedulingTab({ patientId, patientName }: UnionMemberSchedulingTabProps) {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentClinic?.id) {
      fetchProfessionals();
    }
  }, [currentClinic?.id]);

  const fetchProfessionals = async () => {
    if (!currentClinic?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select(`
          id,
          name,
          photo_url,
          professional_specialties (
            specialty:specialties (
              id,
              name,
              category
            )
          )
        `)
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const formattedProfessionals: Professional[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        photo_url: p.photo_url,
        specialties: (p.professional_specialties || [])
          .filter((ps: any) => ps.specialty)
          .map((ps: any) => ({
            id: ps.specialty.id,
            name: ps.specialty.name,
            category: ps.specialty.category,
          })),
      }));

      setProfessionals(formattedProfessionals);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build specialty tabs from professionals' specialties
  const specialtyTabs = useMemo((): SpecialtyTab[] => {
    const specialtyMap = new Map<string, { id: string; name: string; professionalIds: Set<string> }>();

    professionals.forEach(prof => {
      prof.specialties.forEach(spec => {
        if (!specialtyMap.has(spec.id)) {
          specialtyMap.set(spec.id, { id: spec.id, name: spec.name, professionalIds: new Set() });
        }
        specialtyMap.get(spec.id)!.professionalIds.add(prof.id);
      });
    });

    return Array.from(specialtyMap.values())
      .map(s => ({ id: s.id, name: s.name, count: s.professionalIds.size }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [professionals]);

  // Auto-select first specialty when tabs load
  useEffect(() => {
    if (specialtyTabs.length > 0 && !activeSpecialty) {
      setActiveSpecialty(specialtyTabs[0].id);
    }
  }, [specialtyTabs, activeSpecialty]);

  // Filter professionals by active specialty
  const filteredProfessionals = useMemo(() => {
    if (!activeSpecialty) return [];
    return professionals.filter(p => p.specialties.some(s => s.id === activeSpecialty));
  }, [professionals, activeSpecialty]);

  const handleScheduleAppointment = (professionalId: string) => {
    navigate(`/dashboard/calendar?patient=${patientId}&professional=${professionalId}`);
  };

  const activeSpecialtyName = specialtyTabs.find(s => s.id === activeSpecialty)?.name;

  return (
    <div className="p-4 space-y-4">
      {/* Specialty Tabs */}
      {loading ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg flex-shrink-0" />
          ))}
        </div>
      ) : specialtyTabs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Stethoscope className="h-12 w-12 mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">
              Nenhuma especialidade disponível
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Não há profissionais com especialidades cadastradas
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {specialtyTabs.map((specialty) => {
              const isActive = activeSpecialty === specialty.id;
              
              return (
                <button
                  key={specialty.id}
                  onClick={() => setActiveSpecialty(specialty.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all whitespace-nowrap",
                    "text-sm font-medium flex-shrink-0",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <span>{specialty.name}</span>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "ml-1 h-5 px-1.5 text-xs",
                      isActive ? "bg-primary/20 text-primary" : ""
                    )}
                  >
                    {specialty.count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Professionals Grid */}
          <div className="min-h-[300px]">
            {filteredProfessionals.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Stethoscope className="h-12 w-12 mb-4 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">
                    Nenhum profissional disponível
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Não há profissionais para {activeSpecialtyName}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProfessionals.map((professional) => (
                  <Card 
                    key={professional.id} 
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => handleScheduleAppointment(professional.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                          {professional.photo_url ? (
                            <img 
                              src={professional.photo_url} 
                              alt={professional.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-6 w-6 text-primary" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {professional.name}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {professional.specialties.map(s => s.name).join(", ") || "Especialista"}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>

                      {/* Action hint */}
                      <div className="mt-3 pt-3 border-t flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Clique para agendar
                        </span>
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
