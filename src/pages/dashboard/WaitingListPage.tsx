import { useState, useEffect } from "react";
import { 
  Clock, 
  Plus, 
  Search, 
  User, 
  Loader2,
  Bell,
  Calendar,
  Trash2,
  Send,
  CheckCircle2,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FeatureGate } from "@/components/features/FeatureGate";

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Professional {
  id: string;
  name: string;
}

interface WaitingListEntry {
  id: string;
  created_at: string;
  is_active: boolean;
  notes: string | null;
  notified_at: string | null;
  preferred_dates: string[] | null;
  preferred_times: string[] | null;
  patient: { id: string; name: string; phone: string };
  professional: { name: string } | null;
}

function WaitingListContent() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (currentClinic) {
      fetchWaitingList();
      fetchPatients();
      fetchProfessionals();
    }
  }, [currentClinic]);

  const fetchWaitingList = async () => {
    if (!currentClinic) return;

    const { data, error } = await supabase
      .from('waiting_list')
      .select(`
        id,
        created_at,
        is_active,
        notes,
        notified_at,
        preferred_dates,
        preferred_times,
        patient:patients (id, name, phone),
        professional:professionals (name)
      `)
      .eq('clinic_id', currentClinic.id)
      .eq('is_active', true)
      .order('created_at');

    if (error) {
      console.error('Error fetching waiting list:', error);
    }
    setEntries(data as WaitingListEntry[] || []);
    setLoading(false);
  };

  const fetchPatients = async () => {
    if (!currentClinic) return;

    const { data } = await supabase
      .from('patients')
      .select('id, name, phone')
      .eq('clinic_id', currentClinic.id)
      .order('name');

    setPatients(data || []);
  };

  const fetchProfessionals = async () => {
    if (!currentClinic) return;

    const { data } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('clinic_id', currentClinic.id)
      .eq('is_active', true)
      .order('name');

    setProfessionals(data || []);
  };

  const handleAddEntry = async () => {
    if (!currentClinic || !selectedPatient) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('waiting_list')
        .insert({
          clinic_id: currentClinic.id,
          patient_id: selectedPatient,
          professional_id: selectedProfessional && selectedProfessional !== "none" ? selectedProfessional : null,
          preferred_times: preferredTimes.length > 0 ? preferredTimes : null,
          notes: notes || null,
        });

      if (error) throw error;

      toast({ title: "Paciente adicionado à lista de espera!" });
      setDialogOpen(false);
      resetForm();
      fetchWaitingList();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveEntry = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('waiting_list')
        .update({ is_active: false })
        .eq('id', deleteId);

      if (error) throw error;

      toast({ title: "Removido da lista de espera" });
      setDeleteId(null);
      fetchWaitingList();
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const handleNotifyPatient = async (entry: WaitingListEntry) => {
    try {
      // Call the WhatsApp edge function
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: entry.patient.phone,
          message: `Olá ${entry.patient.name}! 👋\n\nTemos uma vaga disponível para você! Entre em contato conosco para agendar sua consulta.\n\nClínica: ${currentClinic?.name}`,
          clinicId: currentClinic?.id,
        },
      });

      if (error) throw error;

      // Update notified_at
      await supabase
        .from('waiting_list')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', entry.id);

      toast({ title: "Paciente notificado via WhatsApp!" });
      fetchWaitingList();
    } catch (error: any) {
      toast({ 
        title: "Erro ao notificar", 
        description: error.message || "Verifique as configurações do WhatsApp", 
        variant: "destructive" 
      });
    }
  };

  const handleSchedulePatient = async (entry: WaitingListEntry) => {
    // Mark as inactive (will be scheduled through calendar)
    await supabase
      .from('waiting_list')
      .update({ is_active: false })
      .eq('id', entry.id);

    toast({ 
      title: "Paciente movido para agendamento", 
      description: "Acesse a agenda para criar a consulta" 
    });
    fetchWaitingList();
  };

  const resetForm = () => {
    setSelectedPatient("");
    setSelectedProfessional("");
    setPreferredTimes([]);
    setNotes("");
  };

  const togglePreferredTime = (time: string) => {
    setPreferredTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const timeOptions = ["Manhã", "Tarde", "Noite"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lista de Espera</h1>
          <p className="text-muted-foreground">
            Gerencie pacientes aguardando vagas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar à Lista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar à Lista de Espera</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Paciente *</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
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
                <Label>Profissional (opcional)</Label>
                <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Qualquer profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer profissional</SelectItem>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferência de Horário</Label>
                <div className="flex gap-2 mt-1.5">
                  {timeOptions.map((time) => (
                    <Button
                      key={time}
                      type="button"
                      variant={preferredTimes.includes(time) ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePreferredTime(time)}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais..."
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddEntry} disabled={saving || !selectedPatient}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </div>
      ) : entries.length > 0 ? (
        <div className="grid gap-4">
          {entries.map((entry, index) => (
            <Card key={entry.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{entry.patient.name}</h3>
                      <p className="text-sm text-muted-foreground">{entry.patient.phone}</p>
                      {entry.professional && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Preferência: {entry.professional.name}
                        </p>
                      )}
                      {entry.preferred_times && entry.preferred_times.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {entry.preferred_times.map((time) => (
                            <Badge key={time} variant="secondary" className="text-xs">
                              {time}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.notified_at && (
                      <Badge variant="outline" className="text-xs">
                        <Bell className="h-3 w-3 mr-1" />
                        Notificado
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNotifyPatient(entry)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Notificar
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSchedulePatient(entry)}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Agendar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Na lista desde {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhum paciente na lista de espera</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar paciente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da lista de espera?</AlertDialogTitle>
            <AlertDialogDescription>
              O paciente será removido da lista de espera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveEntry}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function WaitingListPage() {
  return (
    <FeatureGate feature="waiting_list" showUpgradePrompt>
      <WaitingListContent />
    </FeatureGate>
  );
}
