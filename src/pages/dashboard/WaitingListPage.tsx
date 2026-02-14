import { useState, useEffect, useMemo } from "react";
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
  Check,
  ChevronsUpDown,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FeatureGate } from "@/components/features/FeatureGate";
import { RoleGuard } from "@/components/auth/RoleGuard";

interface Patient {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
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
  notification_status: string | null;
  offered_appointment_date: string | null;
  offered_appointment_time: string | null;
  offered_professional_id: string | null;
  offered_professional_name: string | null;
  slot_offered_at: string | null;
  confirmed_at: string | null;
  skipped_at: string | null;
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
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false);

  const selectedPatientName = useMemo(() => {
    return patients.find(p => p.id === selectedPatient)?.name || "";
  }, [patients, selectedPatient]);

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
        notification_status,
        offered_appointment_date,
        offered_appointment_time,
        offered_professional_id,
        offered_professional_name,
        slot_offered_at,
        confirmed_at,
        skipped_at,
        patient:patients!waiting_list_patient_id_fkey (id, name, phone),
        professional:professionals!waiting_list_professional_id_fkey (name)
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
      .select('id, name, phone, cpf')
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
    // Mark as inactive and confirmed
    await supabase
      .from('waiting_list')
      .update({ 
        is_active: false, 
        notification_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    toast({ 
      title: "Paciente confirmado!", 
      description: "Acesse a agenda para criar a consulta" 
    });
    fetchWaitingList();
  };

  const handleSkipPatient = async (entry: WaitingListEntry) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Mark current patient as skipped, reset slot offer
      await supabase
        .from('waiting_list')
        .update({ 
          notification_status: 'skipped',
          skipped_at: new Date().toISOString(),
          skipped_by: user?.id || null,
          is_active: false,
        })
        .eq('id', entry.id);

      // Auto-notify next in line if there's an offered slot
      if (entry.offered_appointment_date && entry.offered_appointment_time && entry.offered_professional_name && currentClinic) {
        const { notifyNextInWaitingList } = await import('@/lib/waitingListUtils');
        const result = await notifyNextInWaitingList(
          currentClinic.id,
          currentClinic.name,
          {
            appointmentDate: entry.offered_appointment_date,
            startTime: entry.offered_appointment_time,
            professionalId: entry.offered_professional_id || '',
            professionalName: entry.offered_professional_name,
          }
        );

        if (result.notified) {
          toast({
            title: "Próximo da fila notificado",
            description: `${result.patientName} foi notificado sobre a vaga.`,
          });
        } else {
          toast({
            title: "Paciente pulado",
            description: result.waitingCount > 0 
              ? "Não foi possível notificar o próximo. Verifique a lista."
              : "Não há mais pacientes na lista de espera.",
          });
        }
      } else {
        toast({ title: "Paciente removido da fila" });
      }

      fetchWaitingList();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
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
                <Popover open={patientPopoverOpen} onOpenChange={setPatientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientPopoverOpen}
                      className="w-full justify-between mt-1.5"
                    >
                      {selectedPatientName || "Selecione o paciente"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar paciente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {patients.map((patient) => (
                            <CommandItem
                              key={patient.id}
                              value={`${patient.name} ${patient.cpf || ''}`}
                              onSelect={() => {
                                setSelectedPatient(patient.id);
                                setPatientPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPatient === patient.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{patient.name}</span>
                                {patient.cpf && (
                                  <span className="text-xs text-muted-foreground">{patient.cpf}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                       {/* Slot offered info */}
                       {entry.notification_status === 'notified' && entry.offered_appointment_date && (
                         <div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                           <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                             🔔 Vaga oferecida
                           </p>
                           <p className="text-xs text-amber-700 dark:text-amber-400">
                             {new Date(entry.offered_appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')} às {entry.offered_appointment_time?.slice(0, 5)} — {entry.offered_professional_name}
                           </p>
                           {entry.slot_offered_at && (
                             <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                               Notificado em {new Date(entry.slot_offered_at).toLocaleString('pt-BR')}
                             </p>
                           )}
                         </div>
                       )}
                       {entry.notes && (
                         <p className="text-sm text-muted-foreground mt-2 italic">
                           {entry.notes}
                         </p>
                       )}
                     </div>
                   </div>
                   <div className="flex items-center gap-2 flex-wrap">
                     {/* Status badge */}
                     {entry.notification_status === 'notified' && (
                       <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                         <Bell className="h-3 w-3 mr-1" />
                         Aguardando resposta
                       </Badge>
                     )}
                     {entry.notified_at && entry.notification_status !== 'notified' && (
                       <Badge variant="outline" className="text-xs">
                         <Bell className="h-3 w-3 mr-1" />
                         Notificado
                       </Badge>
                     )}

                     {/* Skip button - only for notified entries */}
                     {entry.notification_status === 'notified' && (
                       <Button
                         variant="outline"
                         size="sm"
                         className="text-orange-600 border-orange-300 hover:bg-orange-50"
                         onClick={() => handleSkipPatient(entry)}
                       >
                         <User className="h-4 w-4 mr-1" />
                         Pular → Próximo
                       </Button>
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
                       <CheckCircle2 className="h-4 w-4 mr-1" />
                       Confirmar
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
                     {entry.notification_status === 'notified' && ' • 🟡 Aguardando confirmação'}
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
    <RoleGuard permission="view_waiting_list">
      <FeatureGate feature="waiting_list" showUpgradePrompt>
        <WaitingListContent />
      </FeatureGate>
    </RoleGuard>
  );
}
