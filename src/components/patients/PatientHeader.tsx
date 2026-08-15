import { User, MessageCircle, AlertTriangle, ShieldX, Unlock, UserX, UserCheck, Loader2, CheckCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { openWhatsApp } from "@/lib/whatsapp";
import { formatDateBR } from "@/lib/date";
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
  canUnblock?: boolean;
  // Active status
  isActive?: boolean;
  onToggleActive?: () => void;
  togglingActive?: boolean;
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
  canUnblock = false,
  isActive = true,
  onToggleActive,
  togglingActive = false,
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
    return formatDateBR(dateString) || null;
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
              {canUnblock && onUnblockNoShow && (
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

      <div className="relative overflow-hidden group">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl group-hover:bg-teal-500/10 transition-colors duration-500" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm relative z-10">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-white shadow-md ring-2 ring-teal-500/10">
                <AvatarFallback className="bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-700 font-bold text-xl uppercase">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {isActive && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm" title="Ativo">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">{name}</h2>
                {recordCode && (
                  <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-mono text-[10px] px-1.5 py-0 h-5">
                    #{recordCode}
                  </Badge>
                )}
                {getPriorityBadge()}
              </div>
              
              <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[13px] text-slate-500 font-medium">
                {age && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-teal-500/70" />
                    {age.years}a {age.months}m
                  </span>
                )}
                {formattedDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-teal-500/70" />
                    {formattedDate}
                  </span>
                )}
                {insurancePlan && (
                  <span className="flex items-center gap-1.5 bg-teal-50/50 px-2 py-0.5 rounded-lg border border-teal-100/50 text-teal-700 text-[11px] font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    {insurancePlan}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            {phone && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openWhatsApp(phone)}
                className="flex-1 sm:flex-none h-10 gap-2 border-emerald-100 bg-emerald-50/30 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-all rounded-xl shadow-sm"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs font-bold">WhatsApp</span>
              </Button>
            )}
            
            {isAdmin && onToggleActive && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleActive}
                disabled={togglingActive}
                className={cn(
                  "h-10 w-10 rounded-xl transition-all",
                  isActive 
                    ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50" 
                    : "text-emerald-600 hover:bg-emerald-50"
                )}
                title={isActive ? "Inativar sócio" : "Reativar sócio"}
              >
                {togglingActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isActive ? (
                  <UserX className="h-5 w-5" />
                ) : (
                  <UserCheck className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}