import { useState } from "react";
import { CalendarDays, Check, X, Loader2, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface InlineAppointmentLimitEditProps {
  patientId: string;
  patientName: string;
  currentLimit: number | null;
  clinicDefault: number | null;
  onUpdate: () => void;
}

export function InlineAppointmentLimitEdit({
  patientId,
  patientName,
  currentLimit,
  clinicDefault,
  onUpdate,
}: InlineAppointmentLimitEditProps) {
  const { currentClinic } = useAuth();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(currentLimit?.toString() || "");
  const [saving, setSaving] = useState(false);

  // Only admins can edit
  if (!isAdmin) {
    const displayValue = currentLimit ?? clinicDefault;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {displayValue === null || displayValue === 0 ? (
                <Infinity className="h-3 w-3" />
              ) : (
                <span>{displayValue}/mês</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Limite de consultas: {displayValue === null || displayValue === 0 ? "Ilimitado" : `${displayValue} por mês`}</p>
            {currentLimit === null && clinicDefault !== null && (
              <p className="text-xs text-muted-foreground">Usando padrão da clínica</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const handleSave = async () => {
    if (!currentClinic) return;
    
    setSaving(true);
    try {
      const newLimit = value.trim() === "" ? null : parseInt(value);
      
      if (value.trim() !== "" && (isNaN(newLimit!) || newLimit! < 0)) {
        toast({
          title: "Valor inválido",
          description: "Digite um número válido ou deixe vazio para usar o padrão.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("patients")
        .update({ max_appointments_per_month: newLimit })
        .eq("id", patientId)
        .eq("clinic_id", currentClinic.id);

      if (error) throw error;

      toast({
        title: "Limite atualizado",
        description: newLimit === null 
          ? `${patientName} usará o limite padrão da clínica.`
          : newLimit === 0
            ? `${patientName} terá consultas ilimitadas.`
            : `${patientName}: máximo ${newLimit} consulta${newLimit > 1 ? "s" : ""}/mês.`,
      });

      setEditing(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(currentLimit?.toString() || "");
    setEditing(false);
  };

  const displayValue = currentLimit ?? clinicDefault;
  const isCustom = currentLimit !== null;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-16 text-xs px-2"
          placeholder={clinicDefault?.toString() || "0"}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3 text-green-600" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleCancel}
          disabled={saving}
        >
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              setValue(currentLimit?.toString() || "");
              setEditing(true);
            }}
            className={`flex items-center gap-1 text-xs hover:text-primary transition-colors ${
              isCustom ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            <CalendarDays className="h-3 w-3" />
            {displayValue === null || displayValue === 0 ? (
              <Infinity className="h-3 w-3" />
            ) : (
              <span>{displayValue}/mês</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Limite de consultas: {displayValue === null || displayValue === 0 ? "Ilimitado" : `${displayValue} por mês`}</p>
          {isCustom ? (
            <p className="text-xs text-primary">Limite personalizado</p>
          ) : clinicDefault !== null ? (
            <p className="text-xs text-muted-foreground">Usando padrão da clínica ({clinicDefault})</p>
          ) : (
            <p className="text-xs text-muted-foreground">Sem limite definido</p>
          )}
          <p className="text-xs mt-1">Clique para editar</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
