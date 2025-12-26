import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { addDays, format } from "date-fns";

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Procedure {
  id: string;
  name: string;
}

interface PackageTemplate {
  id: string;
  name: string;
  description: string | null;
  procedure_id: string | null;
  total_sessions: number;
  price: number;
  validity_days: number | null;
}

interface PatientPackage {
  id: string;
  name: string;
  description: string | null;
  total_sessions: number;
  used_sessions: number;
  price: number;
  purchase_date: string;
  expiry_date: string | null;
  notes: string | null;
  patient: { id: string; name: string } | null;
  procedure?: { name: string } | null;
}

interface PatientPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientPackage: PatientPackage | null;
  templates: PackageTemplate[];
  onSuccess: () => void;
}

export function PatientPackageDialog({
  open,
  onOpenChange,
  patientPackage,
  templates,
  onSuccess,
}: PatientPackageDialogProps) {
  const { currentClinic, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"single" | "installments">("single");
  const [installments, setInstallments] = useState(1);

  const [formData, setFormData] = useState({
    patient_id: "",
    name: "",
    description: "",
    procedure_id: "",
    total_sessions: 1,
    price: 0,
    purchase_date: format(new Date(), "yyyy-MM-dd"),
    validity_days: "",
    notes: "",
  });

  useEffect(() => {
    if (open && currentClinic?.id) {
      fetchPatients();
      fetchProcedures();
    }
  }, [open, currentClinic?.id]);

  useEffect(() => {
    if (patientPackage) {
      setFormData({
        patient_id: patientPackage.patient?.id || "",
        name: patientPackage.name,
        description: patientPackage.description || "",
        procedure_id: "",
        total_sessions: patientPackage.total_sessions,
        price: patientPackage.price,
        purchase_date: patientPackage.purchase_date,
        validity_days: "",
        notes: patientPackage.notes || "",
      });
      setPatientSearch(patientPackage.patient?.name || "");
    } else {
      setFormData({
        patient_id: "",
        name: "",
        description: "",
        procedure_id: "",
        total_sessions: 1,
        price: 0,
        purchase_date: format(new Date(), "yyyy-MM-dd"),
        validity_days: "",
        notes: "",
      });
      setPatientSearch("");
      setSelectedTemplate("");
      setPaymentType("single");
      setInstallments(1);
    }
  }, [patientPackage, open]);

  const fetchPatients = async () => {
    if (!currentClinic?.id) return;

    const { data, error } = await supabase
      .from("patients")
      .select("id, name, phone")
      .eq("clinic_id", currentClinic.id)
      .order("name")
      .limit(100);

    if (!error && data) {
      setPatients(data);
    }
  };

  const fetchProcedures = async () => {
    if (!currentClinic?.id) return;

    const { data, error } = await supabase
      .from("procedures")
      .select("id, name")
      .eq("clinic_id", currentClinic.id)
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setProcedures(data);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        name: template.name,
        description: template.description || "",
        procedure_id: template.procedure_id || "",
        total_sessions: template.total_sessions,
        price: template.price,
        validity_days: template.validity_days?.toString() || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClinic?.id || !formData.patient_id) {
      toast.error("Selecione um paciente");
      return;
    }

    setLoading(true);

    try {
      const expiryDate = formData.validity_days
        ? format(addDays(new Date(formData.purchase_date), parseInt(formData.validity_days)), "yyyy-MM-dd")
        : null;

      const payload = {
        clinic_id: currentClinic.id,
        patient_id: formData.patient_id,
        package_template_id: selectedTemplate || null,
        name: formData.name,
        description: formData.description || null,
        procedure_id: formData.procedure_id || null,
        total_sessions: formData.total_sessions,
        price: formData.price,
        purchase_date: formData.purchase_date,
        expiry_date: expiryDate,
        notes: formData.notes || null,
        created_by: user?.id,
      };

      if (patientPackage) {
        // Update existing package
        const { error } = await supabase
          .from("patient_packages")
          .update({
            name: payload.name,
            description: payload.description,
            total_sessions: payload.total_sessions,
            price: payload.price,
            expiry_date: expiryDate,
            notes: payload.notes,
          })
          .eq("id", patientPackage.id);

        if (error) throw error;
        toast.success("Pacote atualizado com sucesso");
      } else {
        // Create new package
        const { data: newPackage, error: packageError } = await supabase
          .from("patient_packages")
          .insert(payload)
          .select()
          .single();

        if (packageError) throw packageError;

        // Create payment entries
        if (paymentType === "single") {
          await supabase.from("package_payments").insert({
            patient_package_id: newPackage.id,
            clinic_id: currentClinic.id,
            amount: formData.price,
            installment_number: 1,
            total_installments: 1,
            due_date: formData.purchase_date,
            status: "pending",
          });
        } else {
          const installmentAmount = formData.price / installments;
          const payments = Array.from({ length: installments }, (_, i) => ({
            patient_package_id: newPackage.id,
            clinic_id: currentClinic.id,
            amount: installmentAmount,
            installment_number: i + 1,
            total_installments: installments,
            due_date: format(addDays(new Date(formData.purchase_date), i * 30), "yyyy-MM-dd"),
            status: "pending",
          }));

          await supabase.from("package_payments").insert(payments);
        }

        toast.success("Pacote criado com sucesso");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving package:", error);
      toast.error("Erro ao salvar pacote");
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.phone.includes(patientSearch)
  );

  const selectedPatient = patients.find((p) => p.id === formData.patient_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {patientPackage ? "Editar Pacote" : "Novo Pacote de Sessões"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selection */}
          <div className="space-y-2">
            <Label>Paciente *</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">{selectedPatient.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPatient.phone}</p>
                </div>
                {!patientPackage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData({ ...formData, patient_id: "" });
                      setPatientSearch("");
                    }}
                  >
                    Trocar
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar paciente por nome ou telefone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {patientSearch.length >= 2 && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    {filteredPatients.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Nenhum paciente encontrado
                      </p>
                    ) : (
                      filteredPatients.slice(0, 10).map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                          onClick={() => {
                            setFormData({ ...formData, patient_id: patient.id });
                            setPatientSearch(patient.name);
                          }}
                        >
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-sm text-muted-foreground">{patient.phone}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Template Selection (only for new packages) */}
          {!patientPackage && templates.length > 0 && (
            <div className="space-y-2">
              <Label>Usar Modelo de Pacote</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo ou preencha manualmente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Preencher manualmente</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} - {template.total_sessions} sessões - R$ {template.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Package Details */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Pacote *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: 10 Sessões de Fisioterapia"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição opcional"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Procedimento Vinculado</Label>
            <Select
              value={formData.procedure_id}
              onValueChange={(value) => setFormData({ ...formData, procedure_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer procedimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Qualquer procedimento</SelectItem>
                {procedures.map((proc) => (
                  <SelectItem key={proc.id} value={proc.id}>
                    {proc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_sessions">Nº de Sessões *</Label>
              <Input
                id="total_sessions"
                type="number"
                min="1"
                value={formData.total_sessions}
                onChange={(e) => setFormData({ ...formData, total_sessions: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Valor Total (R$) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Data da Compra *</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="validity_days">Validade (dias)</Label>
              <Input
                id="validity_days"
                type="number"
                min="1"
                value={formData.validity_days}
                onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                placeholder="Sem limite"
              />
            </div>
          </div>

          {/* Payment Options (only for new packages) */}
          {!patientPackage && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label>Forma de Pagamento</Label>
              <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as "single" | "installments")}>
                <TabsList className="w-full">
                  <TabsTrigger value="single" className="flex-1">À Vista</TabsTrigger>
                  <TabsTrigger value="installments" className="flex-1">Parcelado</TabsTrigger>
                </TabsList>
                <TabsContent value="installments" className="mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="installments">Número de Parcelas</Label>
                    <Select
                      value={installments.toString()}
                      onValueChange={(v) => setInstallments(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}x de R$ {(formData.price / n).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações internas"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.patient_id}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {patientPackage ? "Salvar" : "Criar Pacote"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
