import { User, MessageCircle, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { openWhatsApp } from "@/lib/whatsapp";

interface PatientHeaderProps {
  name: string;
  recordCode?: number;
  birthDate?: string;
  phone?: string;
  insurancePlan?: string;
  priority?: string;
}

export function PatientHeader({
  name,
  recordCode,
  birthDate,
  phone,
  insurancePlan,
  priority,
}: PatientHeaderProps) {
  const calculateAge = (dateString?: string) => {
    if (!dateString) return null;
    const birth = new Date(dateString);
    const today = new Date();
    
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
      years--;
      months += 12;
    }
    
    if (today.getDate() < birth.getDate()) {
      months--;
      if (months < 0) months = 11;
    }
    
    return { years, months };
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const age = calculateAge(birthDate);
  const formattedDate = formatDate(birthDate);
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const getPriorityBadge = () => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive" className="ml-2">Alta Prioridade</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="ml-2 bg-warning text-warning-foreground">Média</Badge>;
      case 'low':
        return <Badge variant="secondary" className="ml-2">Baixa</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-lg border shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{name}</h2>
            {recordCode && (
              <span className="text-sm text-muted-foreground">
                (Cód. {recordCode})
              </span>
            )}
            {getPriorityBadge()}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            {age && (
              <span>
                {age.years}a {age.months}m
              </span>
            )}
            {formattedDate && (
              <span>({formattedDate})</span>
            )}
            {insurancePlan && (
              <>
                <span className="text-border">|</span>
                <span>{insurancePlan}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {phone && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => openWhatsApp(phone)}
            className="text-success hover:text-success hover:bg-success/10"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}