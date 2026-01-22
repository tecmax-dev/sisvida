import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pill, Loader2, Printer } from "lucide-react";
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

interface Prescription {
  id: string;
  content: string;
  created_at: string;
  professional_id: string | null;
  professionals?: { name: string } | null;
}

interface Professional {
  id: string;
  name: string;
}

interface PatientPrescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export function PatientPrescriptionModal({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientPrescriptionModalProps) {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    content: "",
    professionalId: "",
  });

  useEffect(() => {
    if (open && patientId && currentClinic) {
      fetchPrescriptions();
      fetchProfessionals();
    }
  }, [open, patientId, currentClinic]);

  const fetchPrescriptions = async () => {
    if (!currentClinic) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*, professionals(name)")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPrescriptions(data || []);
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
      toast({
        title: "Erro ao carregar prescrições",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfessionals = async () => {
    if (!currentClinic) return;
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error) {
      console.error("Error fetching professionals:", error);
    }
  };

  const handleSave = async () => {
    if (!currentClinic || !patientId || !formData.content.trim()) {
      toast({
        title: "Preencha o conteúdo da prescrição",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("prescriptions").insert({
        patient_id: patientId,
        clinic_id: currentClinic.id,
        content: formData.content.trim(),
        professional_id: formData.professionalId || null,
      });

      if (error) throw error;

      toast({
        title: "Prescrição salva",
        description: "A prescrição foi adicionada com sucesso.",
      });

      setFormData({ content: "", professionalId: "" });
      setShowForm(false);
      fetchPrescriptions();
    } catch (error) {
      console.error("Error saving prescription:", error);
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (prescription: Prescription) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Prescrição - ${patientName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 18px; margin-bottom: 20px; }
            .date { color: #666; margin-bottom: 20px; }
            .content { white-space: pre-wrap; line-height: 1.6; }
            .footer { margin-top: 60px; border-top: 1px solid #ccc; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Prescrição Médica</h1>
          <p><strong>Paciente:</strong> ${patientName}</p>
          <p class="date"><strong>Data:</strong> ${format(new Date(prescription.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
          <hr />
          <div class="content">${prescription.content}</div>
          <div class="footer">
            <p>${prescription.professionals?.name || "Profissional não informado"}</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
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
            <Pill className="h-5 w-5" />
            Prescrições - {patientName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
            <Plus className="h-4 w-4 mr-1" />
            {showForm ? "Cancelar" : "Nova Prescrição"}
          </Button>
        </div>

        {showForm && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            <div>
              <Label>Profissional Responsável</Label>
              <Select
                value={formData.professionalId}
                onValueChange={(v) => setFormData((p) => ({ ...p, professionalId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conteúdo da Prescrição *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                placeholder="Digite a prescrição médica..."
                rows={6}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Prescrição
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : prescriptions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma prescrição encontrada.
            </p>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {prescriptions.map((prescription) => (
                <AccordionItem key={prescription.id} value={prescription.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-sm font-medium">
                        {format(new Date(prescription.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {prescription.professionals?.name || "Profissional não informado"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3">
                      <p className="text-sm whitespace-pre-wrap">{prescription.content}</p>
                      <Button variant="outline" size="sm" onClick={() => handlePrint(prescription)}>
                        <Printer className="h-4 w-4 mr-1" />
                        Imprimir
                      </Button>
                    </div>
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
