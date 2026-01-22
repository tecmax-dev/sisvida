import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save } from "lucide-react";
import { ODONTOGRAM_CONDITIONS, ToothRecord } from "./Odontogram";

interface ToothDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toothNumber: number | null;
  currentCondition: string;
  onSave: (record: ToothRecord) => void;
  saving: boolean;
}

const TOOTH_FACES = [
  { id: "vestibular", label: "Vestibular (V)" },
  { id: "lingual", label: "Lingual/Palatino (L/P)" },
  { id: "mesial", label: "Mesial (M)" },
  { id: "distal", label: "Distal (D)" },
  { id: "oclusal", label: "Oclusal/Incisal (O/I)" },
];

const MATERIALS = [
  { id: "resin", label: "Resina Composta" },
  { id: "amalgam", label: "Amálgama" },
  { id: "ceramic", label: "Cerâmica" },
  { id: "metal", label: "Metal" },
  { id: "zirconia", label: "Zircônia" },
  { id: "gold", label: "Ouro" },
  { id: "titanium", label: "Titânio" },
];

export function ToothDialog({
  open,
  onOpenChange,
  toothNumber,
  currentCondition,
  onSave,
  saving,
}: ToothDialogProps) {
  const [condition, setCondition] = useState(currentCondition);
  const [face, setFace] = useState<string>("");
  const [material, setMaterial] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setCondition(currentCondition);
      setFace("");
      setMaterial("");
      setNotes("");
    }
  }, [open, currentCondition]);

  const handleSave = () => {
    if (!toothNumber) return;

    onSave({
      tooth_number: toothNumber,
      condition,
      tooth_face: face || undefined,
      material: material || undefined,
      notes: notes || undefined,
    });
  };

  const getToothName = (num: number): string => {
    const quadrant = Math.floor(num / 10);
    const position = num % 10;
    
    const quadrantNames: Record<number, string> = {
      1: "Superior Direito",
      2: "Superior Esquerdo",
      3: "Inferior Esquerdo",
      4: "Inferior Direito",
    };

    const toothNames: Record<number, string> = {
      1: "Incisivo Central",
      2: "Incisivo Lateral",
      3: "Canino",
      4: "Primeiro Pré-molar",
      5: "Segundo Pré-molar",
      6: "Primeiro Molar",
      7: "Segundo Molar",
      8: "Terceiro Molar (Siso)",
    };

    return `${toothNames[position] || "Dente"} ${quadrantNames[quadrant] || ""}`;
  };

  const showMaterialField = ["restoration", "crown", "implant"].includes(condition);
  const showFaceField = ["caries", "restoration", "fracture", "sealant"].includes(condition);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Dente {toothNumber}
            <span className="text-sm font-normal text-muted-foreground">
              - {toothNumber && getToothName(toothNumber)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Condition Selection */}
          <div className="space-y-2">
            <Label>Condição</Label>
            <RadioGroup
              value={condition}
              onValueChange={setCondition}
              className="grid grid-cols-2 gap-2"
            >
              {ODONTOGRAM_CONDITIONS.map((cond) => (
                <div key={cond.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={cond.id} id={cond.id} />
                  <Label
                    htmlFor={cond.id}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{ backgroundColor: cond.color, borderColor: cond.color }}
                    />
                    {cond.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Face Selection */}
          {showFaceField && (
            <div className="space-y-2">
              <Label>Face do Dente</Label>
              <Select value={face} onValueChange={setFace}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a face (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {TOOTH_FACES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Material Selection */}
          {showMaterialField && (
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o material (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais sobre o dente..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
