import { useState, useEffect } from "react";
import { 
  ClipboardList, 
  Plus, 
  Search, 
  User, 
  Loader2,
  Heart,
  Pill,
  AlertTriangle,
  Phone,
  Edit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Anamnesis {
  id: string;
  filled_at: string;
  allergies: string | null;
  current_medications: string | null;
  chronic_diseases: string | null;
  previous_surgeries: string | null;
  family_history: string | null;
  smoking: boolean;
  alcohol: boolean;
  physical_activity: boolean;
  blood_type: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  additional_notes: string | null;
}

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function AnamnesisPage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    allergies: "",
    current_medications: "",
    chronic_diseases: "",
    previous_surgeries: "",
    family_history: "",
    smoking: false,
    alcohol: false,
    physical_activity: false,
    blood_type: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    additional_notes: "",
  });

  useEffect(() => {
    if (currentClinic) {
      fetchPatients();
    }
  }, [currentClinic]);

  useEffect(() => {
    if (selectedPatient) {
      fetchAnamnesis();
    }
  }, [selectedPatient]);

  const fetchPatients = async () => {
    if (!currentClinic) return;

    const { data } = await supabase
      .from('patients')
      .select('id, name, phone')
      .eq('clinic_id', currentClinic.id)
      .order('name');

    setPatients(data || []);
    setLoading(false);
  };

  const fetchAnamnesis = async () => {
    if (!currentClinic || !selectedPatient) return;

    const { data } = await supabase
      .from('anamnesis')
      .select('*')
      .eq('clinic_id', currentClinic.id)
      .eq('patient_id', selectedPatient.id)
      .order('filled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setAnamnesis(data);
      setFormData({
        allergies: data.allergies || "",
        current_medications: data.current_medications || "",
        chronic_diseases: data.chronic_diseases || "",
        previous_surgeries: data.previous_surgeries || "",
        family_history: data.family_history || "",
        smoking: data.smoking || false,
        alcohol: data.alcohol || false,
        physical_activity: data.physical_activity || false,
        blood_type: data.blood_type || "",
        emergency_contact_name: data.emergency_contact_name || "",
        emergency_contact_phone: data.emergency_contact_phone || "",
        additional_notes: data.additional_notes || "",
      });
    } else {
      setAnamnesis(null);
      resetForm();
    }
  };

  const handleSaveAnamnesis = async () => {
    if (!currentClinic || !selectedPatient) return;

    setSaving(true);
    try {
      if (anamnesis) {
        // Update existing
        const { error } = await supabase
          .from('anamnesis')
          .update(formData)
          .eq('id', anamnesis.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('anamnesis')
          .insert({
            clinic_id: currentClinic.id,
            patient_id: selectedPatient.id,
            ...formData,
          });

        if (error) throw error;
      }

      toast({ title: "Anamnese salva com sucesso!" });
      setDialogOpen(false);
      fetchAnamnesis();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      allergies: "",
      current_medications: "",
      chronic_diseases: "",
      previous_surgeries: "",
      family_history: "",
      smoking: false,
      alcohol: false,
      physical_activity: false,
      blood_type: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      additional_notes: "",
    });
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anamnese</h1>
          <p className="text-muted-foreground">
            Ficha de histórico médico dos pacientes
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Pacientes
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPatient?.id === patient.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-foreground">{patient.name}</p>
                  <p className="text-sm text-muted-foreground">{patient.phone}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhum paciente encontrado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Anamnesis Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {selectedPatient ? `Anamnese - ${selectedPatient.name}` : "Selecione um paciente"}
              </CardTitle>
              {anamnesis && (
                <CardDescription>
                  Última atualização: {new Date(anamnesis.filled_at).toLocaleDateString('pt-BR')}
                </CardDescription>
              )}
            </div>
            {selectedPatient && (
              <Button onClick={() => setDialogOpen(true)}>
                {anamnesis ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {anamnesis ? "Editar" : "Criar"} Anamnese
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um paciente para ver a anamnese</p>
              </div>
            ) : anamnesis ? (
              <div className="space-y-6">
                {/* Allergies & Medications */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="font-medium text-foreground">Alergias</span>
                    </div>
                    <p className="text-sm text-foreground">
                      {anamnesis.allergies || "Nenhuma alergia registrada"}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Pill className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">Medicamentos em Uso</span>
                    </div>
                    <p className="text-sm text-foreground">
                      {anamnesis.current_medications || "Nenhum medicamento registrado"}
                    </p>
                  </div>
                </div>

                {/* Health Info */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Doenças Crônicas</p>
                    <p className="text-foreground">{anamnesis.chronic_diseases || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Cirurgias Anteriores</p>
                    <p className="text-foreground">{anamnesis.previous_surgeries || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Histórico Familiar</p>
                    <p className="text-foreground">{anamnesis.family_history || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Tipo Sanguíneo</p>
                    <Badge variant="outline">{anamnesis.blood_type || "Não informado"}</Badge>
                  </div>
                </div>

                {/* Lifestyle */}
                <div className="flex flex-wrap gap-3">
                  <Badge variant={anamnesis.smoking ? "destructive" : "secondary"}>
                    {anamnesis.smoking ? "Fumante" : "Não fumante"}
                  </Badge>
                  <Badge variant={anamnesis.alcohol ? "destructive" : "secondary"}>
                    {anamnesis.alcohol ? "Consome álcool" : "Não consome álcool"}
                  </Badge>
                  <Badge variant={anamnesis.physical_activity ? "default" : "secondary"}>
                    {anamnesis.physical_activity ? "Pratica atividade física" : "Sedentário"}
                  </Badge>
                </div>

                {/* Emergency Contact */}
                {anamnesis.emergency_contact_name && (
                  <div className="p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">Contato de Emergência</span>
                    </div>
                    <p className="text-foreground">{anamnesis.emergency_contact_name}</p>
                    <p className="text-sm text-muted-foreground">{anamnesis.emergency_contact_phone}</p>
                  </div>
                )}

                {anamnesis.additional_notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                    <p className="text-foreground">{anamnesis.additional_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Nenhuma anamnese registrada</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Anamnese
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Anamnesis Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {anamnesis ? "Editar" : "Nova"} Anamnese - {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Critical Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-destructive">Alergias *</Label>
                <Textarea
                  value={formData.allergies}
                  onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
                  placeholder="Liste todas as alergias conhecidas..."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Medicamentos em Uso</Label>
                <Textarea
                  value={formData.current_medications}
                  onChange={(e) => setFormData(prev => ({ ...prev, current_medications: e.target.value }))}
                  placeholder="Medicamentos que o paciente usa..."
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Health History */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Doenças Crônicas</Label>
                <Textarea
                  value={formData.chronic_diseases}
                  onChange={(e) => setFormData(prev => ({ ...prev, chronic_diseases: e.target.value }))}
                  placeholder="Diabetes, hipertensão, etc..."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Cirurgias Anteriores</Label>
                <Textarea
                  value={formData.previous_surgeries}
                  onChange={(e) => setFormData(prev => ({ ...prev, previous_surgeries: e.target.value }))}
                  placeholder="Liste cirurgias realizadas..."
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>Histórico Familiar</Label>
              <Textarea
                value={formData.family_history}
                onChange={(e) => setFormData(prev => ({ ...prev, family_history: e.target.value }))}
                placeholder="Doenças na família (pais, irmãos)..."
                className="mt-1.5"
              />
            </div>

            {/* Lifestyle */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Fumante</Label>
                <Switch
                  checked={formData.smoking}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, smoking: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Consome álcool</Label>
                <Switch
                  checked={formData.alcohol}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alcohol: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Atividade física</Label>
                <Switch
                  checked={formData.physical_activity}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, physical_activity: checked }))}
                />
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Tipo Sanguíneo</Label>
                <Select
                  value={formData.blood_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, blood_type: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {bloodTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contato de Emergência</Label>
                <Input
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                  placeholder="Nome do contato"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Telefone Emergência</Label>
                <Input
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>Observações Adicionais</Label>
              <Textarea
                value={formData.additional_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
                placeholder="Outras informações relevantes..."
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAnamnesis} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Anamnese
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
