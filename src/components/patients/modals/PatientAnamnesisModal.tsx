import { useEffect, useState } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AnamnesisData {
  id?: string;
  bloodType: string;
  allergies: string;
  chronicDiseases: string;
  currentMedications: string;
  previousSurgeries: string;
  familyHistory: string;
  smoking: boolean;
  alcohol: boolean;
  physicalActivity: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  additionalNotes: string;
}

const initialData: AnamnesisData = {
  bloodType: "",
  allergies: "",
  chronicDiseases: "",
  currentMedications: "",
  previousSurgeries: "",
  familyHistory: "",
  smoking: false,
  alcohol: false,
  physicalActivity: false,
  emergencyContactName: "",
  emergencyContactPhone: "",
  additionalNotes: "",
};

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface PatientAnamnesisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export function PatientAnamnesisModal({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientAnamnesisModalProps) {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<AnamnesisData>(initialData);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && patientId && currentClinic) {
      fetchAnamnesis();
    }
  }, [open, patientId, currentClinic]);

  const fetchAnamnesis = async () => {
    if (!currentClinic) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("anamnesis")
        .select("*")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setFormData({
          bloodType: data.blood_type || "",
          allergies: data.allergies || "",
          chronicDiseases: data.chronic_diseases || "",
          currentMedications: data.current_medications || "",
          previousSurgeries: data.previous_surgeries || "",
          familyHistory: data.family_history || "",
          smoking: data.smoking || false,
          alcohol: data.alcohol || false,
          physicalActivity: data.physical_activity || false,
          emergencyContactName: data.emergency_contact_name || "",
          emergencyContactPhone: data.emergency_contact_phone || "",
          additionalNotes: data.additional_notes || "",
        });
      } else {
        setExistingId(null);
        setFormData(initialData);
      }
    } catch (error) {
      console.error("Error fetching anamnesis:", error);
      toast({
        title: "Erro ao carregar anamnese",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentClinic || !patientId) return;

    setSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        clinic_id: currentClinic.id,
        blood_type: formData.bloodType || null,
        allergies: formData.allergies || null,
        chronic_diseases: formData.chronicDiseases || null,
        current_medications: formData.currentMedications || null,
        previous_surgeries: formData.previousSurgeries || null,
        family_history: formData.familyHistory || null,
        smoking: formData.smoking,
        alcohol: formData.alcohol,
        physical_activity: formData.physicalActivity,
        emergency_contact_name: formData.emergencyContactName || null,
        emergency_contact_phone: formData.emergencyContactPhone || null,
        additional_notes: formData.additionalNotes || null,
        filled_at: new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await supabase
          .from("anamnesis")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("anamnesis").insert(payload);
        if (error) throw error;
      }

      toast({
        title: "Anamnese salva",
        description: "As informações foram atualizadas com sucesso.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving anamnesis:", error);
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof AnamnesisData>(field: K, value: AnamnesisData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => {
          if (!document.hasFocus()) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (!document.hasFocus()) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Anamnese - {patientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Blood Type */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Tipo Sanguíneo</Label>
                  <Select value={formData.bloodType} onValueChange={(v) => updateField("bloodType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Medical History */}
              <div className="space-y-4">
                <div>
                  <Label>Alergias</Label>
                  <Textarea
                    value={formData.allergies}
                    onChange={(e) => updateField("allergies", e.target.value)}
                    placeholder="Medicamentos, alimentos, substâncias..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Doenças Crônicas</Label>
                  <Textarea
                    value={formData.chronicDiseases}
                    onChange={(e) => updateField("chronicDiseases", e.target.value)}
                    placeholder="Diabetes, hipertensão, etc..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Medicamentos em Uso</Label>
                  <Textarea
                    value={formData.currentMedications}
                    onChange={(e) => updateField("currentMedications", e.target.value)}
                    placeholder="Liste os medicamentos..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Cirurgias Anteriores</Label>
                  <Textarea
                    value={formData.previousSurgeries}
                    onChange={(e) => updateField("previousSurgeries", e.target.value)}
                    placeholder="Descreva cirurgias realizadas..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Histórico Familiar</Label>
                  <Textarea
                    value={formData.familyHistory}
                    onChange={(e) => updateField("familyHistory", e.target.value)}
                    placeholder="Doenças na família..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Habits */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Hábitos</h4>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.smoking}
                      onCheckedChange={(v) => updateField("smoking", v)}
                    />
                    <Label>Tabagismo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.alcohol}
                      onCheckedChange={(v) => updateField("alcohol", v)}
                    />
                    <Label>Consumo de Álcool</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.physicalActivity}
                      onCheckedChange={(v) => updateField("physicalActivity", v)}
                    />
                    <Label>Atividade Física</Label>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Contato de Emergência</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={formData.emergencyContactName}
                      onChange={(e) => updateField("emergencyContactName", e.target.value)}
                      placeholder="Nome do contato"
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={formData.emergencyContactPhone}
                      onChange={(e) => updateField("emergencyContactPhone", e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <Label>Observações Adicionais</Label>
                <Textarea
                  value={formData.additionalNotes}
                  onChange={(e) => updateField("additionalNotes", e.target.value)}
                  placeholder="Informações adicionais relevantes..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
