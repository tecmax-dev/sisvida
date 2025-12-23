import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface MedicalRecord {
  id: string;
  record_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  notes: string | null;
  professional_id: string | null;
  professionals?: { name: string } | null;
}

interface PatientRecordsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export function PatientRecordsModal({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientRecordsModalProps) {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    chiefComplaint: "",
    diagnosis: "",
    treatmentPlan: "",
    notes: "",
  });

  useEffect(() => {
    if (open && patientId && currentClinic) {
      fetchRecords();
    }
  }, [open, patientId, currentClinic]);

  const fetchRecords = async () => {
    if (!currentClinic) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .select("*, professionals(name)")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic.id)
        .order("record_date", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast({
        title: "Erro ao carregar prontuário",
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
      const { error } = await supabase.from("medical_records").insert({
        patient_id: patientId,
        clinic_id: currentClinic.id,
        chief_complaint: formData.chiefComplaint || null,
        diagnosis: formData.diagnosis || null,
        treatment_plan: formData.treatmentPlan || null,
        notes: formData.notes || null,
        record_date: new Date().toISOString().split("T")[0],
      });

      if (error) throw error;

      toast({
        title: "Registro salvo",
        description: "A evolução foi adicionada ao prontuário.",
      });

      setFormData({ chiefComplaint: "", diagnosis: "", treatmentPlan: "", notes: "" });
      setShowForm(false);
      fetchRecords();
    } catch (error) {
      console.error("Error saving record:", error);
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prontuário - {patientName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
            <Plus className="h-4 w-4 mr-1" />
            {showForm ? "Cancelar" : "Nova Evolução"}
          </Button>
        </div>

        {showForm && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div className="grid gap-4">
              <div>
                <Label>Queixa Principal</Label>
                <Textarea
                  value={formData.chiefComplaint}
                  onChange={(e) => setFormData((p) => ({ ...p, chiefComplaint: e.target.value }))}
                  placeholder="Descreva a queixa principal..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Diagnóstico</Label>
                <Textarea
                  value={formData.diagnosis}
                  onChange={(e) => setFormData((p) => ({ ...p, diagnosis: e.target.value }))}
                  placeholder="Diagnóstico..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Plano de Tratamento</Label>
                <Textarea
                  value={formData.treatmentPlan}
                  onChange={(e) => setFormData((p) => ({ ...p, treatmentPlan: e.target.value }))}
                  placeholder="Plano de tratamento..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Observações adicionais..."
                  rows={2}
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Evolução
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro encontrado.
            </p>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {records.map((record) => (
                <AccordionItem key={record.id} value={record.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-sm font-medium">
                        {format(new Date(record.record_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {record.professionals?.name || "Profissional não informado"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    {record.chief_complaint && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Queixa Principal</p>
                        <p className="text-sm">{record.chief_complaint}</p>
                      </div>
                    )}
                    {record.diagnosis && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Diagnóstico</p>
                        <p className="text-sm">{record.diagnosis}</p>
                      </div>
                    )}
                    {record.treatment_plan && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Plano de Tratamento</p>
                        <p className="text-sm">{record.treatment_plan}</p>
                      </div>
                    )}
                    {record.notes && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Observações</p>
                        <p className="text-sm">{record.notes}</p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
