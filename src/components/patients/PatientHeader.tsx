import { User, MessageCircle, AlertTriangle, ShieldX, Unlock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { openWhatsApp } from "@/lib/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PatientHeaderProps {
  name: string;
  recordCode?: number;
  birthDate?: string;
  phone?: string;
  insurancePlan?: string;
  priority?: string;
  // No-show blocking info
  noShowBlockedUntil?: string | null;
  noShowBlockedAt?: string | null;
  noShowUnblockedAt?: string | null;
  onUnblockNoShow?: () => void;
  isAdmin?: boolean;
}

export function PatientHeader({
  name,
  recordCode,
  birthDate,
  phone,
  insurancePlan,
  priority,
  noShowBlockedUntil,
  noShowBlockedAt,
  noShowUnblockedAt,
  onUnblockNoShow,
  isAdmin = false,
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

  // Check if patient is currently blocked for no-show
  const isBlocked = noShowBlockedUntil && 
    new Date(noShowBlockedUntil) >= new Date() && 
    !noShowUnblockedAt;

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
    <div className="space-y-3">
      {/* No-show blocking alert */}
      {isBlocked && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <ShieldX className="h-5 w-5" />
          <AlertTitle className="font-semibold">Paciente Bloqueado por Não Comparecimento</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex flex-col gap-2">
              <p>
                Este paciente está <strong>bloqueado para novos agendamentos</strong> até{' '}
                <strong>{format(new Date(noShowBlockedUntil!), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong> 
                {' '}devido a não comparecimento em consulta anterior.
              </p>
              {noShowBlockedAt && (
                <p className="text-sm opacity-80">
                  Bloqueado em: {format(new Date(noShowBlockedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
              {isAdmin && onUnblockNoShow && (
                <div className="mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onUnblockNoShow}
                    className="gap-2 border-destructive/50 hover:bg-destructive/20"
                  >
                    <Unlock className="h-4 w-4" />
                    Liberar Bloqueio
                  </Button>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

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
              {isBlocked && (
                <Badge variant="destructive" className="ml-2 gap-1">
                  <ShieldX className="h-3 w-3" />
                  Bloqueado
                </Badge>
              )}
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
    </div>
  );
}