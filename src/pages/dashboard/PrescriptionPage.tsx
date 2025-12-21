import { useState, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  Search, 
  User, 
  Loader2,
  Printer,
  Pill,
  CheckCircle,
  Clock,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { DigitalSignature } from "@/components/medical/DigitalSignature";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateAge } from "@/lib/utils";
import { sendWhatsAppDocument } from "@/lib/whatsapp";
import { generatePrescriptionPDF } from "@/lib/prescriptionExportUtils";

interface Patient {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  registration_number: string | null;
}

interface Prescription {
  id: string;
  content: string;
  is_signed: boolean;
  signed_at: string | null;
  signature_data: string | null;
  created_at: string;
  patient: { name: string; birth_date: string | null; phone: string } | null;
  professional: { name: string; specialty: string | null; registration_number: string | null } | null;
}

export default function PrescriptionPage() {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [prescriptionContent, setPrescriptionContent] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);

  useEffect(() => {
    if (currentClinic) {
      fetchPatients();
      fetchProfessionals();
      fetchPrescriptions();
    }
  }, [currentClinic]);

  const fetchPatients = async () => {
    if (!currentClinic) return;
    
    const { data } = await supabase
      .from('patients')
      .select('id, name, phone, birth_date')
      .eq('clinic_id', currentClinic.id)
      .order('name');

    setPatients(data || []);
    setLoading(false);
  };

  const fetchProfessionals = async () => {
    if (!currentClinic) return;
    
    const { data } = await supabase
      .from('professionals')
      .select('id, name, specialty, registration_number')
      .eq('clinic_id', currentClinic.id)
      .eq('is_active', true)
      .order('name');

    setProfessionals(data || []);
  };

  const fetchPrescriptions = async () => {
    if (!currentClinic) return;
    
    const { data } = await supabase
      .from('prescriptions')
      .select(`
        id,
        content,
        is_signed,
        signed_at,
        signature_data,
        created_at,
        patient:patients (name, birth_date, phone),
        professional:professionals (name, specialty, registration_number)
      `)
      .eq('clinic_id', currentClinic.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setPrescriptions(data as Prescription[] || []);
  };

  const handleCreatePrescription = async () => {
    if (!currentClinic || !selectedPatient || !prescriptionContent.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um paciente e preencha a prescrição.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('prescriptions')
        .insert({
          clinic_id: currentClinic.id,
          patient_id: selectedPatient.id,
          professional_id: selectedProfessionalId || null,
          content: prescriptionContent,
          is_signed: !!signatureData,
          signed_at: signatureData ? new Date().toISOString() : null,
          signature_data: signatureData,
        });

      if (error) throw error;

      toast({ title: "Prescrição salva com sucesso!" });
      setDialogOpen(false);
      setPrescriptionContent("");
      setSignatureData(null);
      setSelectedProfessionalId("");
      fetchPrescriptions();
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (prescription: Prescription) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const age = prescription.patient?.birth_date 
      ? calculateAge(prescription.patient.birth_date) 
      : null;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receituário</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .clinic-name { font-size: 24px; font-weight: bold; }
          .patient-info { margin-bottom: 30px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .prescription { white-space: pre-wrap; line-height: 1.8; min-height: 300px; padding: 20px 0; }
          .signature-area { margin-top: 60px; text-align: center; }
          .signature-line { border-top: 1px solid #333; width: 300px; margin: 0 auto 10px; }
          .signature-img { max-width: 300px; margin-bottom: 10px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic-name">${currentClinic?.name || 'Clínica'}</div>
          ${currentClinic?.address ? `<div>${currentClinic.address}</div>` : ''}
          ${currentClinic?.phone ? `<div>Tel: ${currentClinic.phone}</div>` : ''}
        </div>
        
        <h2 style="text-align: center; margin-bottom: 30px;">RECEITUÁRIO</h2>
        
        <div class="patient-info">
          <strong>Paciente:</strong> ${prescription.patient?.name || 'Não informado'}
          ${age ? ` (${age} anos)` : ''}
          <br>
          <strong>Data:</strong> ${format(new Date(prescription.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
        
        <div class="prescription">${prescription.content}</div>
        
        <div class="signature-area">
          ${prescription.signature_data ? `<img src="${prescription.signature_data}" class="signature-img" alt="Assinatura" />` : ''}
          <div class="signature-line"></div>
          <div>${prescription.professional?.name || 'Profissional'}</div>
          ${prescription.professional?.specialty ? `<div>${prescription.professional.specialty}</div>` : ''}
          ${prescription.professional?.registration_number ? `<div>${prescription.professional.registration_number}</div>` : ''}
        </div>
        
        <div class="footer">
          Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSendWhatsApp = async (prescription: Prescription) => {
    if (!currentClinic || !prescription.patient?.phone) {
      toast({
        title: "Erro",
        description: "Paciente sem telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    setSendingWhatsApp(prescription.id);
    
    try {
      const { base64, fileName } = await generatePrescriptionPDF({
        clinic: {
          name: currentClinic.name,
          address: currentClinic.address,
          phone: currentClinic.phone,
          cnpj: currentClinic.cnpj,
        },
        patient: {
          name: prescription.patient.name,
          birth_date: prescription.patient.birth_date,
        },
        professional: prescription.professional ? {
          name: prescription.professional.name,
          specialty: prescription.professional.specialty,
          registration_number: prescription.professional.registration_number,
        } : undefined,
        prescription: {
          content: prescription.content,
          created_at: prescription.created_at,
          signature_data: prescription.signature_data,
          is_signed: prescription.is_signed,
        },
      });

      const result = await sendWhatsAppDocument({
        phone: prescription.patient.phone,
        clinicId: currentClinic.id,
        pdfBase64: base64,
        fileName,
        caption: [
          `📋 *Receituário Médico*`,
          ``,
          `Olá ${prescription.patient.name}! 👋`,
          ``,
          `Segue em anexo seu receituário.`,
          ``,
          `📅 *Data:* ${format(parseISO(prescription.created_at!), "dd/MM/yyyy", { locale: ptBR })}`,
          `👨‍⚕️ *Profissional:* ${prescription.professional?.name || 'Profissional'}`,
          `🏥 *Clínica:* ${currentClinic.name}`,
          ``,
          `⚠️ *Atenção:* Siga as orientações do profissional de saúde. Em caso de dúvidas, entre em contato conosco.`,
          ``,
          `Atenciosamente,`,
          `Equipe ${currentClinic.name}`,
        ].join('\n'),
      });

      if (result.success) {
        toast({
          title: "Receituário enviado!",
          description: `PDF enviado via WhatsApp para ${prescription.patient.phone}`,
        });
      } else {
        throw new Error(result.error || "Erro ao enviar");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingWhatsApp(null);
    }
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prescrição Digital</h1>
          <p className="text-muted-foreground">
            Crie e assine prescrições médicas digitalmente
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Prescrição
        </Button>
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
              filteredPatients.map((patient) => {
                const age = calculateAge(patient.birth_date);
                return (
                  <div
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setDialogOpen(true);
                    }}
                    className="p-3 rounded-lg border border-border cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{patient.name}</p>
                      {age !== null && (
                        <Badge variant="outline">{age} anos</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{patient.phone}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhum paciente encontrado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Prescriptions List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Prescrições Recentes
            </CardTitle>
            <CardDescription>
              {prescriptions.length} prescrição(ões) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {prescriptions.length > 0 ? (
              prescriptions.map((prescription) => {
                const age = prescription.patient?.birth_date 
                  ? calculateAge(prescription.patient.birth_date) 
                  : null;
                return (
                  <div 
                    key={prescription.id} 
                    className="border border-border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {prescription.patient?.name || "Paciente não informado"}
                          </p>
                          {age !== null && (
                            <Badge variant="outline" className="text-xs">{age} anos</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(prescription.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {prescription.is_signed ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Assinada
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendWhatsApp(prescription)}
                          disabled={sendingWhatsApp === prescription.id || !prescription.patient?.phone}
                          title={!prescription.patient?.phone ? "Paciente sem telefone" : "Enviar via WhatsApp"}
                        >
                          {sendingWhatsApp === prescription.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-1" />
                          )}
                          WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrint(prescription)}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Imprimir
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Pill className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p className="line-clamp-2">{prescription.content}</p>
                    </div>
                    {prescription.professional && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Profissional: {prescription.professional.name}
                        {prescription.professional.registration_number && 
                          ` - ${prescription.professional.registration_number}`}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma prescrição encontrada</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira prescrição
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Prescription Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Prescrição</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Paciente</Label>
                <Select 
                  value={selectedPatient?.id || ""} 
                  onValueChange={(v) => setSelectedPatient(patients.find(p => p.id === v) || null)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Profissional</Label>
                <Select 
                  value={selectedProfessionalId} 
                  onValueChange={setSelectedProfessionalId}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.name} {prof.specialty && `- ${prof.specialty}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Prescrição</Label>
              <Textarea
                value={prescriptionContent}
                onChange={(e) => setPrescriptionContent(e.target.value)}
                placeholder="Digite a prescrição médica...

Exemplo:
1) Medicamento X - 500mg
   Tomar 1 comprimido de 8 em 8 horas por 7 dias

2) Medicamento Y - 10mg
   Tomar 1 comprimido ao dia, em jejum"
                className="mt-1.5 min-h-[200px] font-mono"
              />
            </div>

            <DigitalSignature
              onSign={(data) => setSignatureData(data)}
              onClear={() => setSignatureData(null)}
              existingSignature={signatureData}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreatePrescription} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Prescrição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}