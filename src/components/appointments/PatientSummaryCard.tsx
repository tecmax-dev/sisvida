import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, Plus, Calendar, Shield, CheckCircle2, XCircle } from "lucide-react";
import { differenceInYears, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PatientSummaryCardProps {
  patient: {
    id: string;
    name: string;
    birth_date: string | null;
    phone: string;
    email: string | null;
    created_at?: string;
    insurance_plan?: string | null;
  };
  appointmentsCount: number;
  noShowCount: number;
  onViewProfile: () => void;
}

export function PatientSummaryCard({
  patient,
  appointmentsCount,
  noShowCount,
  onViewProfile,
}: PatientSummaryCardProps) {
  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    try {
      return differenceInYears(new Date(), parseISO(birthDate));
    } catch {
      return null;
    }
  };

  const age = calculateAge(patient.birth_date);
  const initials = patient.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const firstAppointmentDate = patient.created_at 
    ? format(parseISO(patient.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-6">
          {/* Patient Info */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div>
              <h2 className="text-xl font-semibold text-foreground">{patient.name}</h2>
              
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                {age && (
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {age} anos
                  </span>
                )}
                
                {firstAppointmentDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Primeira consulta em {firstAppointmentDate}
                  </span>
                )}
                
                {patient.insurance_plan && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    {patient.insurance_plan}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Button variant="ghost" size="sm" className="text-primary h-auto p-0">
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar tag
                </Button>
              </div>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6 text-center">
              <div>
                <div className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-2xl font-bold">{appointmentsCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Atendimentos</p>
              </div>
              
              <div>
                <div className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span className="text-2xl font-bold">{noShowCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </div>

            <Button variant="outline" onClick={onViewProfile}>
              VISUALIZAR CADASTRO
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
