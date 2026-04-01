import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, FileCheck, Save, Info, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PayslipAcceptanceSettingsProps {
  clinicId: string;
  currentValue?: number | null;
  onUpdate?: () => void;
  isAdmin?: boolean;
}

type PresetOption = "30" | "60" | "0" | "custom";

function valueToPreset(val: number | null | undefined): PresetOption {
  if (val === null || val === undefined || val === 0) return "0";
  if (val === 30) return "30";
  if (val === 60) return "60";
  return "custom";
}

export function PayslipAcceptanceSettings({
  clinicId,
  currentValue,
  onUpdate,
  isAdmin = false,
}: PayslipAcceptanceSettingsProps) {
  const [preset, setPreset] = useState<PresetOption>(valueToPreset(currentValue));
  const [customDays, setCustomDays] = useState(
    currentValue && ![0, 30, 60].includes(currentValue) ? currentValue.toString() : "90"
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPreset(valueToPreset(currentValue));
    if (currentValue && ![0, 30, 60].includes(currentValue)) {
      setCustomDays(currentValue.toString());
    }
  }, [currentValue]);

  const canEdit = isAdmin;

  const getDaysValue = (): number => {
    if (preset === "0") return 0;
    if (preset === "30") return 30;
    if (preset === "60") return 60;
    return parseInt(customDays) || 90;
  };

  const handleSave = async () => {
    if (!canEdit) return;

    const days = getDaysValue();
    if (preset === "custom" && (days < 1 || days > 365)) {
      toast({
        title: "Valor inválido",
        description: "O período personalizado deve ser entre 1 e 365 dias.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ payslip_acceptance_days: days } as any)
        .eq("id", clinicId);

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "O prazo de aceitação de contracheques foi atualizado.",
      });
      onUpdate?.();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getDescription = () => {
    const days = getDaysValue();
    if (days === 0) return "Sem limite de prazo — contracheques de qualquer competência serão aceitos.";
    const months = Math.ceil(days / 30);
    return `Contracheques com competência de até ${days} dias (≈${months} ${months === 1 ? "mês" : "meses"}) anteriores serão aceitos.`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          Prazo de Aceitação de Contracheque
        </CardTitle>
        <CardDescription>
          Configure o período máximo retroativo aceito para validação de contracheques na renovação de carteirinha
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canEdit && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <Lock className="h-4 w-4" />
            <AlertDescription className="font-medium">
              Apenas administradores podem alterar esta configuração.
            </AlertDescription>
          </Alert>
        )}

        {canEdit && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Esta configuração define quantos dias retroativos um contracheque pode ter para ser aceito
              na validação por IA durante a renovação da carteirinha digital.
            </AlertDescription>
          </Alert>
        )}

        <RadioGroup
          value={preset}
          onValueChange={(v) => setPreset(v as PresetOption)}
          disabled={!canEdit}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="30" id="payslip-30" disabled={!canEdit} />
            <Label htmlFor="payslip-30" className={!canEdit ? "text-muted-foreground" : ""}>
              30 dias (mês anterior)
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="60" id="payslip-60" disabled={!canEdit} />
            <Label htmlFor="payslip-60" className={!canEdit ? "text-muted-foreground" : ""}>
              60 dias (2 meses anteriores)
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="0" id="payslip-unlimited" disabled={!canEdit} />
            <Label htmlFor="payslip-unlimited" className={!canEdit ? "text-muted-foreground" : ""}>
              Sem limite de prazo
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="custom" id="payslip-custom" disabled={!canEdit} />
            <Label htmlFor="payslip-custom" className={!canEdit ? "text-muted-foreground" : ""}>
              Personalizado
            </Label>
          </div>
        </RadioGroup>

        {preset === "custom" && (
          <div className="flex items-center gap-2 pl-7">
            <Input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              disabled={!canEdit}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">dias</span>
          </div>
        )}

        <p className="text-sm text-muted-foreground">{getDescription()}</p>

        <Button onClick={handleSave} disabled={saving || !canEdit} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
