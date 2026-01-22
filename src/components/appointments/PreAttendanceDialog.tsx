import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, Thermometer, Weight, Ruler, Heart, Droplets } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface PreAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  patientId: string;
  patientName: string;
  onSaved?: () => void;
}

interface PreAttendanceData {
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
  oxygen_saturation: number | null;
  glucose: number | null;
  notes: string;
}

export function PreAttendanceDialog({
  open,
  onOpenChange,
  appointmentId,
  patientId,
  patientName,
  onSaved,
}: PreAttendanceDialogProps) {
  const { toast } = useToast();
  const { currentClinic, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<PreAttendanceData>({
    blood_pressure_systolic: null,
    blood_pressure_diastolic: null,
    heart_rate: null,
    temperature: null,
    weight: null,
    height: null,
    oxygen_saturation: null,
    glucose: null,
    notes: "",
  });

  useEffect(() => {
    if (open && appointmentId) {
      fetchExistingData();
    }
  }, [open, appointmentId]);

  const fetchExistingData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pre_attendance")
        .select("*")
        .eq("appointment_id", appointmentId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setFormData({
          blood_pressure_systolic: data.blood_pressure_systolic,
          blood_pressure_diastolic: data.blood_pressure_diastolic,
          heart_rate: data.heart_rate,
          temperature: data.temperature ? parseFloat(String(data.temperature)) : null,
          weight: data.weight ? parseFloat(String(data.weight)) : null,
          height: data.height ? parseFloat(String(data.height)) : null,
          oxygen_saturation: data.oxygen_saturation,
          glucose: data.glucose,
          notes: data.notes || "",
        });
      } else {
        setExistingId(null);
        setFormData({
          blood_pressure_systolic: null,
          blood_pressure_diastolic: null,
          heart_rate: null,
          temperature: null,
          weight: null,
          height: null,
          oxygen_saturation: null,
          glucose: null,
          notes: "",
        });
      }
    } catch (error: any) {
      console.error("Error fetching pre-attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentClinic || !user) return;

    // Validate blood pressure - both fields must be filled together
    if (
      (formData.blood_pressure_systolic && !formData.blood_pressure_diastolic) ||
      (!formData.blood_pressure_systolic && formData.blood_pressure_diastolic)
    ) {
      toast({
        title: "Pressão arterial incompleta",
        description: "Preencha tanto a sistólica quanto a diastólica",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        clinic_id: currentClinic.id,
        appointment_id: appointmentId,
        patient_id: patientId,
        blood_pressure_systolic: formData.blood_pressure_systolic || null,
        blood_pressure_diastolic: formData.blood_pressure_diastolic || null,
        heart_rate: formData.heart_rate || null,
        temperature: formData.temperature || null,
        weight: formData.weight || null,
        height: formData.height || null,
        oxygen_saturation: formData.oxygen_saturation || null,
        glucose: formData.glucose || null,
        notes: formData.notes || null,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await supabase
          .from("pre_attendance")
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pre_attendance")
          .insert(dataToSave);

        if (error) throw error;
      }

      toast({ title: "Pré-atendimento salvo com sucesso!" });
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof PreAttendanceData, value: string) => {
    if (field === "notes") {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      const numValue = value === "" ? null : parseFloat(value);
      setFormData((prev) => ({ ...prev, [field]: numValue }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Pré-Atendimento
          </DialogTitle>
          <DialogDescription>
            Registrar sinais vitais de {patientName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Blood Pressure */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                Pressão Arterial (mmHg)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Sistólica"
                  value={formData.blood_pressure_systolic ?? ""}
                  onChange={(e) => updateField("blood_pressure_systolic", e.target.value)}
                  className="text-center"
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="number"
                  placeholder="Diastólica"
                  value={formData.blood_pressure_diastolic ?? ""}
                  onChange={(e) => updateField("blood_pressure_diastolic", e.target.value)}
                  className="text-center"
                />
              </div>
            </div>

            {/* Heart Rate & O2 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-pink-500" />
                  Freq. Cardíaca (bpm)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 72"
                  value={formData.heart_rate ?? ""}
                  onChange={(e) => updateField("heart_rate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  Saturação O₂ (%)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 98"
                  value={formData.oxygen_saturation ?? ""}
                  onChange={(e) => updateField("oxygen_saturation", e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
            </div>

            {/* Temperature & Glucose */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-orange-500" />
                  Temperatura (°C)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 36.5"
                  value={formData.temperature ?? ""}
                  onChange={(e) => updateField("temperature", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-purple-500" />
                  Glicemia (mg/dL)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 100"
                  value={formData.glucose ?? ""}
                  onChange={(e) => updateField("glucose", e.target.value)}
                />
              </div>
            </div>

            {/* Weight & Height */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Weight className="h-4 w-4 text-green-500" />
                  Peso (kg)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 70.5"
                  value={formData.weight ?? ""}
                  onChange={(e) => updateField("weight", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-cyan-500" />
                  Altura (cm)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 175"
                  value={formData.height ?? ""}
                  onChange={(e) => updateField("height", e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações adicionais do pré-atendimento..."
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
