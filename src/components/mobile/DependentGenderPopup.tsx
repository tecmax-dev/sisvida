import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCircle, Loader2 } from "lucide-react";

interface DependentMissingGender {
  id: string;
  name: string;
}

interface DependentGenderPopupProps {
  patientId: string;
}

/**
 * Popup exibido no app quando o titular possui dependentes sem sexo cadastrado.
 * O preenchimento libera os agendamentos do dependente (bloqueio aplicado no app).
 * A gravação usa a RPC segura update_own_dependent_gender (somente o campo sexo).
 */
export function DependentGenderPopup({ patientId }: DependentGenderPopupProps) {
  const [missing, setMissing] = useState<DependentMissingGender[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!patientId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("patient_dependents")
        .select("id, name, gender")
        .eq("patient_id", patientId)
        .eq("is_active", true);

      if (error) {
        console.error("[DependentGenderPopup] erro ao carregar dependentes:", error);
        return;
      }

      const list = (data || [])
        .filter((d: any) => !(d.gender || "").trim())
        .map((d: any) => ({ id: d.id as string, name: d.name as string }));

      setMissing(list);
      setOpen(list.length > 0);
    };

    load();
  }, [patientId]);

  const allFilled = missing.length > 0 && missing.every((d) => !!selections[d.id]);

  const handleSave = async () => {
    if (!allFilled) return;
    setSaving(true);
    try {
      for (const dep of missing) {
        const gender = selections[dep.id];
        const { error } = await supabase.rpc("update_own_dependent_gender", {
          p_dependent_id: dep.id,
          p_gender: gender,
        });
        if (error) throw error;
      }

      toast({
        title: "Dados atualizados",
        description: "Sexo dos dependentes registrado com sucesso.",
      });
      setMissing([]);
      setOpen(false);
    } catch (error) {
      console.error("[DependentGenderPopup] erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (missing.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            Complete o cadastro
          </DialogTitle>
          <DialogDescription>
            Informe o sexo dos dependentes abaixo. Sem essa informação, eles não
            conseguem realizar agendamentos pelo app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {missing.map((dep) => (
            <div key={dep.id} className="space-y-1.5">
              <Label className="text-sm font-medium">{dep.name}</Label>
              <Select
                value={selections[dep.id] || ""}
                onValueChange={(v) =>
                  setSelections((prev) => ({ ...prev, [dep.id]: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sexo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Depois
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!allFilled || saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
