import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Stethoscope, 
  Smile, 
  Sparkles, 
  Heart, 
  Hand,
  Calendar,
  User,
  Clock,
  ChevronRight
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

interface CategoryConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'medical', label: 'Médico', icon: Stethoscope, color: 'text-blue-600', bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200' },
  { id: 'dental', label: 'Odontológico', icon: Smile, color: 'text-cyan-600', bgColor: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200' },
  { id: 'aesthetic', label: 'Estética', icon: Sparkles, color: 'text-pink-600', bgColor: 'bg-pink-50 hover:bg-pink-100 border-pink-200' },
  { id: 'therapy', label: 'Terapias', icon: Heart, color: 'text-purple-600', bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200' },
  { id: 'massage', label: 'Massoterapia', icon: Hand, color: 'text-green-600', bgColor: 'bg-green-50 hover:bg-green-100 border-green-200' },
];

interface UnionMemberSchedulingTabProps {
  patientId: string;
  patientName: string;
}

export function UnionMemberSchedulingTab({ patientId, patientName }: UnionMemberSchedulingTabProps) {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('medical');
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

  // Group professionals by category
  const professionalsByCategory = useMemo(() => {
    const grouped: Record<string, Professional[]> = {};
    
    CATEGORIES.forEach(cat => {
      grouped[cat.id] = [];
    });

    professionals.forEach(prof => {
      const categories = new Set(prof.specialties.map(s => s.category));
      categories.forEach(cat => {
        if (grouped[cat]) {
          // Only add if not already in that category
          if (!grouped[cat].find(p => p.id === prof.id)) {
            grouped[cat].push(prof);
          }
        }
      });
    });

    return grouped;
  }, [professionals]);

  // Count professionals per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      counts[cat.id] = professionalsByCategory[cat.id]?.length || 0;
    });
    return counts;
  }, [professionalsByCategory]);

  const handleScheduleAppointment = (professionalId: string) => {
    navigate(`/dashboard/calendar?patient=${patientId}&professional=${professionalId}`);
  };

  const currentProfessionals = professionalsByCategory[activeCategory] || [];
  const currentCategory = CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div className="p-4 space-y-4">
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = categoryCounts[category.id] || 0;
          const isActive = activeCategory === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all whitespace-nowrap",
                "text-sm font-medium",
                isActive
                  ? `${category.bgColor} ${category.color} border-current shadow-sm`
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{category.label}</span>
              {count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-1 h-5 px-1.5 text-xs",
                    isActive ? "bg-white/50" : ""
                  )}
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Professionals Grid */}
      <div className="min-h-[300px]">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : currentProfessionals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              {currentCategory && (
                <currentCategory.icon className={cn("h-12 w-12 mb-4", currentCategory.color, "opacity-40")} />
              )}
              <p className="text-muted-foreground font-medium">
                Nenhum profissional disponível
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Não há profissionais cadastrados nesta categoria
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentProfessionals.map((professional) => {
              // Get specialties for current category
              const categorySpecialties = professional.specialties
                .filter(s => s.category === activeCategory)
                .map(s => s.name);

              return (
                <Card 
                  key={professional.id} 
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => handleScheduleAppointment(professional.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={cn(
                        "h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0",
                        currentCategory?.bgColor || "bg-muted"
                      )}>
                        {professional.photo_url ? (
                          <img 
                            src={professional.photo_url} 
                            alt={professional.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <User className={cn("h-6 w-6", currentCategory?.color || "text-muted-foreground")} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {professional.name}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {categorySpecialties.join(", ") || "Especialista"}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
