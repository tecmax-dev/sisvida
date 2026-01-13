import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ArrowLeft, CalendarDays } from "lucide-react";
import { AppointmentSidebar } from "@/components/appointments/AppointmentSidebar";
import { PatientSummaryCard } from "@/components/appointments/PatientSummaryCard";
import { MedicalRecordsTimeline } from "@/components/appointments/MedicalRecordsTimeline";
import { VitalSignsDisplay } from "@/components/appointments/VitalSignsDisplay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Patient {
  id: string;
  name: string;
  birth_date: string | null;
  phone: string;
  email: string | null;
  created_at: string;
  insurance_plan_id: string | null;
}

interface Dependent {
  id: string;
  name: string;
  birth_date: string | null;
}

interface Appointment {
  id: string;
  patient_id: string;
  dependent_id: string | null;
  professional_id: string;
  clinic_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  patient: Patient;
  dependent?: Dependent | null;
}

interface MedicalRecord {
  id: string;
  record_date: string;
  created_at: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  notes: string | null;
  physical_examination: string | null;
  professional?: {
    name: string;
  };
  appointment?: {
    type: string;
  };
}

interface Professional {
  id: string;
  name: string;
  clinic_id: string;
  clinic: {
    name: string;
    logo_url: string | null;
  };
}

export default function ProfessionalAppointment() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [noShowCount, setNoShowCount] = useState(0);
  const [activeTab, setActiveTab] = useState('resumo');
  const [filterType, setFilterType] = useState('all');
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [newRecord, setNewRecord] = useState({
    chief_complaint: '',
    physical_examination: '',
    diagnosis: '',
    treatment_plan: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [appointmentId]);

  const loadData = async () => {
    if (!appointmentId) {
      navigate('/profissional/painel');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate('/profissional');
      return;
    }

    // PRIMEIRO: tentar por user_id
    let { data: prof } = await supabase
      .from('professionals')
      .select(`
        id, name, clinic_id, email, user_id,
        clinic:clinics (name, logo_url)
      `)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .maybeSingle();

    // FALLBACK: tentar por email
    if (!prof && session.user.email) {
      console.warn('[Appointment] Profissional não encontrado por user_id, tentando por email...');
      const { data: profByEmail } = await supabase
        .from('professionals')
        .select(`
          id, name, clinic_id, email, user_id,
          clinic:clinics (name, logo_url)
        `)
        .eq('email', session.user.email.toLowerCase())
        .eq('is_active', true)
        .maybeSingle();

      if (profByEmail) {
        prof = profByEmail;
        console.warn('[Appointment] Profissional encontrado por email:', prof.name);
        
        // Auto-vincular user_id se estiver NULL
        if (!profByEmail.user_id) {
          await supabase
            .from('professionals')
            .update({ user_id: session.user.id })
            .eq('id', profByEmail.id)
            .is('user_id', null);
        }
      }
    }

    if (!prof) {
      navigate('/profissional');
      return;
    }

    setProfessional({
      ...prof,
      clinic: prof.clinic as { name: string; logo_url: string | null }
    });

    // Get appointment with patient and dependent
    const { data: apt } = await supabase
      .from('appointments')
      .select(`
        id, patient_id, dependent_id, professional_id, clinic_id,
        appointment_date, start_time, end_time, type, status,
        started_at, completed_at,
        patient:patients (id, name, birth_date, phone, email, created_at, insurance_plan_id),
        dependent:patient_dependents!appointments_dependent_id_fkey (id, name, birth_date)
      `)
      .eq('id', appointmentId)
      .eq('professional_id', prof.id)
      .single();

    if (!apt) {
      toast({
        title: "Agendamento não encontrado",
        variant: "destructive",
      });
      navigate('/profissional/painel');
      return;
    }

    let dependentData = apt.dependent as Dependent | null;

    // Fallback: se dependent_id existe mas dependent veio null, buscar diretamente
    if (apt.dependent_id && !dependentData) {
      console.warn('[ProfessionalAppointment] Fallback: buscando dependente', apt.dependent_id);
      const { data: depFallback } = await supabase
        .from('patient_dependents')
        .select('id, name, birth_date')
        .eq('id', apt.dependent_id)
        .maybeSingle();

      if (depFallback) {
        dependentData = depFallback;
      }
    }

    setAppointment({
      ...apt,
      dependent_id: apt.dependent_id || null,
      patient: apt.patient as Patient,
      dependent: dependentData,
    });

    // Get medical records - pass dependent_id if appointment is for dependent
    await loadMedicalRecords(apt.patient_id, prof.clinic_id, apt.dependent_id || null);

    // Get stats
    const { count: completedCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', apt.patient_id)
      .eq('clinic_id', prof.clinic_id)
      .eq('status', 'completed');

    const { count: noShowCountResult } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', apt.patient_id)
      .eq('clinic_id', prof.clinic_id)
      .eq('status', 'no_show');

    setAppointmentsCount(completedCount || 0);
    setNoShowCount(noShowCountResult || 0);
    setLoading(false);
  };

  const loadMedicalRecords = async (patientId: string, clinicId: string, dependentId?: string | null) => {
    let query = supabase
      .from('medical_records')
      .select(`
        id, record_date, created_at, chief_complaint, diagnosis,
        treatment_plan, notes, physical_examination,
        professional:professionals (name),
        appointment:appointments (type)
      `)
      .eq('clinic_id', clinicId)
      .order('record_date', { ascending: false });

    // If dependent, show only their records; otherwise show titular (dependent_id is null)
    if (dependentId) {
      query = query.eq('dependent_id', dependentId);
    } else {
      query = query.eq('patient_id', patientId).is('dependent_id', null);
    }

    const { data } = await query;

    if (data) {
      setMedicalRecords(data.map(r => ({
        ...r,
        professional: r.professional as { name: string } | undefined,
        appointment: r.appointment as { type: string } | undefined,
      })));
    }
  };

  const handleStartAppointment = async () => {
    if (!appointment) return;

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', appointment.id);

    if (error) {
      toast({ title: "Erro ao iniciar atendimento", variant: "destructive" });
      return;
    }

    setAppointment({
      ...appointment,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });

    toast({ title: "Atendimento iniciado!" });
  };

  const handleFinishAppointment = async () => {
    if (!appointment) return;

    const startedAt = appointment.started_at ? new Date(appointment.started_at) : new Date();
    const now = new Date();
    const durationMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'completed',
        completed_at: now.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq('id', appointment.id);

    if (error) {
      toast({ title: "Erro ao finalizar atendimento", variant: "destructive" });
      return;
    }

    toast({ title: "Atendimento finalizado!" });
    navigate('/profissional/painel');
  };

  const handleUpdateRecord = async (id: string, data: Partial<MedicalRecord>) => {
    const { error } = await supabase
      .from('medical_records')
      .update({
        chief_complaint: data.chief_complaint,
        diagnosis: data.diagnosis,
        treatment_plan: data.treatment_plan,
        notes: data.notes,
        physical_examination: data.physical_examination,
      })
      .eq('id', id);

    if (error) {
      toast({ title: "Erro ao atualizar registro", variant: "destructive" });
      return;
    }

    if (appointment && professional) {
      await loadMedicalRecords(appointment.patient_id, professional.clinic_id, appointment.dependent_id || null);
    }
    toast({ title: "Registro atualizado!" });
  };

  const handleDeleteRecord = async (id: string) => {
    const { error } = await supabase
      .from('medical_records')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Erro ao excluir registro", variant: "destructive" });
      return;
    }

    setMedicalRecords(records => records.filter(r => r.id !== id));
    toast({ title: "Registro excluído!" });
  };

  const handleAddRecord = async () => {
    if (!appointment || !professional) return;

    setSaving(true);
    const { error } = await supabase
      .from('medical_records')
      .insert({
        patient_id: appointment.patient_id,
        dependent_id: appointment.dependent_id || null,
        clinic_id: professional.clinic_id,
        professional_id: professional.id,
        appointment_id: appointment.id,
        record_date: new Date().toISOString().split('T')[0],
        chief_complaint: newRecord.chief_complaint || null,
        physical_examination: newRecord.physical_examination || null,
        diagnosis: newRecord.diagnosis || null,
        treatment_plan: newRecord.treatment_plan || null,
        notes: newRecord.notes || null,
      });

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao adicionar registro", variant: "destructive" });
      return;
    }

    await loadMedicalRecords(appointment.patient_id, professional.clinic_id, appointment.dependent_id || null);
    setShowAddRecord(false);
    setNewRecord({
      chief_complaint: '',
      physical_examination: '',
      diagnosis: '',
      treatment_plan: '',
      notes: '',
    });
    toast({ title: "Registro adicionado!" });
  };

  const handleViewProfile = () => {
    if (!appointment) return;

    // Titular: abre o cadastro do próprio paciente.
    // Dependente: abre o cadastro do titular já na aba de dependentes e com o dependente pré-selecionado para edição.
    if (appointment.dependent_id) {
      window.open(
        `/dashboard/patients/${appointment.patient_id}/edit?tab=dependentes&dependentes=true&editDependent=${appointment.dependent_id}`,
        '_blank'
      );
      return;
    }

    window.open(`/dashboard/patients/${appointment.patient_id}/edit`, '_blank');
  };

  const filteredRecords = filterType === 'all' 
    ? medicalRecords 
    : medicalRecords.filter(r => r.appointment?.type === filterType);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appointment || !professional) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <AppointmentSidebar
        appointmentStatus={appointment.status}
        startedAt={appointment.started_at}
        onStartAppointment={handleStartAppointment}
        onFinishAppointment={handleFinishAppointment}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/profissional/painel')}
                title="Voltar ao Painel"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/profissional/painel')}
                title="Voltar à Agenda"
              >
                <CalendarDays className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold text-foreground">
                {activeTab === 'resumo' && 'Resumo'}
                {activeTab === 'anamnese' && 'Anamnese'}
                {activeTab === 'evolucoes' && 'Evoluções'}
                {activeTab === 'prescricoes' && 'Prescrições'}
                {activeTab === 'exames' && 'Exames'}
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {professional.clinic.logo_url && (
                <img 
                  src={professional.clinic.logo_url} 
                  alt={professional.clinic.name} 
                  className="h-8" 
                />
              )}
              <span className="text-sm text-muted-foreground">{professional.name}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {activeTab === 'resumo' && (
            <>
              {/* Vital Signs from Pre-Attendance */}
              <VitalSignsDisplay 
                appointmentId={appointment.id} 
                className="mb-6"
              />

              <PatientSummaryCard
                patient={
                  appointment.dependent_id && appointment.dependent
                    ? {
                        id: appointment.dependent.id,
                        name: appointment.dependent.name,
                        birth_date: appointment.dependent.birth_date,
                        phone: appointment.patient.phone,
                        email: appointment.patient.email,
                        created_at: appointment.patient.created_at,
                        insurance_plan: null,
                        is_dependent: true,
                        holder_name: appointment.patient.name,
                      }
                    : {
                        ...appointment.patient,
                        insurance_plan: null,
                        is_dependent: false,
                        holder_name: null,
                      }
                }
                appointmentsCount={appointmentsCount}
                noShowCount={noShowCount}
                onViewProfile={handleViewProfile}
              />

              <MedicalRecordsTimeline
                records={filteredRecords}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                filterType={filterType}
                onFilterChange={setFilterType}
              />
            </>
          )}

          {activeTab === 'anamnese' && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Em desenvolvimento</p>
            </div>
          )}

          {activeTab === 'evolucoes' && (
            <MedicalRecordsTimeline
              records={filteredRecords}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              filterType={filterType}
              onFilterChange={setFilterType}
            />
          )}

          {activeTab === 'prescricoes' && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Em desenvolvimento</p>
            </div>
          )}

          {activeTab === 'exames' && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Em desenvolvimento</p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Button */}
      <Button
        className="fixed bottom-6 right-6 shadow-lg gap-2"
        size="lg"
        onClick={() => setShowAddRecord(true)}
      >
        <Plus className="h-5 w-5" />
        INSERIR INFORMAÇÕES
      </Button>

      {/* Add Record Dialog */}
      <Dialog open={showAddRecord} onOpenChange={setShowAddRecord}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Evolução</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Queixa Principal</Label>
              <Textarea
                value={newRecord.chief_complaint}
                onChange={(e) => setNewRecord({ ...newRecord, chief_complaint: e.target.value })}
                placeholder="Descreva a queixa principal do paciente..."
              />
            </div>

            <div>
              <Label>Exame Físico</Label>
              <Textarea
                value={newRecord.physical_examination}
                onChange={(e) => setNewRecord({ ...newRecord, physical_examination: e.target.value })}
                placeholder="Resultados do exame físico..."
              />
            </div>

            <div>
              <Label>Diagnóstico</Label>
              <Textarea
                value={newRecord.diagnosis}
                onChange={(e) => setNewRecord({ ...newRecord, diagnosis: e.target.value })}
                placeholder="Diagnóstico..."
              />
            </div>

            <div>
              <Label>Plano de Tratamento</Label>
              <Textarea
                value={newRecord.treatment_plan}
                onChange={(e) => setNewRecord({ ...newRecord, treatment_plan: e.target.value })}
                placeholder="Plano de tratamento..."
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={newRecord.notes}
                onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                placeholder="Observações adicionais..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAddRecord(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddRecord} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
