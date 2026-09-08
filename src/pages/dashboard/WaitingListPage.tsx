import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  MessageSquare,
  Printer,
  Filter,
  X,
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

interface LastAppointmentInfo {
  date: string;
  time: string | null;
  status: string;
  professionalName: string | null;
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
  professional: { id: string; name: string } | null;
}

function WaitingListContent() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [lastAppointments, setLastAppointments] = useState<Record<string, LastAppointmentInfo>>({});
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [smsSendingId, setSmsSendingId] = useState<string | null>(null);

  // Filtros de visualização/impressão
  const [filterProfessional, setFilterProfessional] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPatientName, setFilterPatientName] = useState("");

  // Form state
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [selectedPatientData, setSelectedPatientData] = useState<Patient | null>(null);
  const patientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPatientName = selectedPatientData?.name || "";

  // Search patients on-demand (server-side) to handle clinics with thousands of patients
  const searchPatients = useCallback(async (term: string) => {
    if (!currentClinic || !term.trim() || term.trim().length < 2) {
      setPatients([]);
      return;
    }
    setPatientSearchLoading(true);
    try {
      const searchTerm = term.trim();
      const searchDigits = searchTerm.replace(/\D/g, "");
      
      let cpfFormatted = "";
      if (searchDigits.length === 11) {
        cpfFormatted = searchDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      }
      
      const cpfFilter = cpfFormatted
        ? `cpf.ilike.%${searchDigits}%,cpf.ilike.%${cpfFormatted}%`
        : searchDigits.length >= 3
          ? `cpf.ilike.%${searchDigits}%`
          : "";
      
      const orFilters = [`name.ilike.%${searchTerm}%`, cpfFilter].filter(Boolean).join(",");
      
      const { data } = await supabase
        .from("patients")
        .select("id, name, phone, cpf")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .or(orFilters)
        .order("name")
        .limit(30);
      
      setPatients(data || []);
    } catch (err) {
      console.error("Error searching patients:", err);
      setPatients([]);
    } finally {
      setPatientSearchLoading(false);
    }
  }, [currentClinic]);

  // Debounced patient search
  useEffect(() => {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    patientSearchTimer.current = setTimeout(() => {
      searchPatients(patientSearch);
    }, 300);
    return () => { if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current); };
  }, [patientSearch, searchPatients]);

  useEffect(() => {
    if (currentClinic) {
      fetchWaitingList();
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
        professional:professionals!waiting_list_professional_id_fkey (id, name)
      `)
      .eq('clinic_id', currentClinic.id)
      .eq('is_active', true)
      .order('created_at');

    if (error) {
      console.error('Error fetching waiting list:', error);
    }
    const list = (data as WaitingListEntry[]) || [];
    setEntries(list);
    setLoading(false);
    fetchLastAppointments(list);
  };

  const fetchLastAppointments = async (list: WaitingListEntry[]) => {
    if (!currentClinic || list.length === 0) {
      setLastAppointments({});
      return;
    }
    const patientIds = Array.from(new Set(list.map((e) => e.patient.id)));
    const { data, error } = await supabase
      .from('appointments')
      .select('patient_id, appointment_date, start_time, status, professional:professionals!appointments_professional_id_fkey (name)')
      .eq('clinic_id', currentClinic.id)
      .in('patient_id', patientIds)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error fetching last appointments:', error);
      return;
    }

    const map: Record<string, LastAppointmentInfo> = {};
    for (const row of (data as any[]) || []) {
      if (!map[row.patient_id]) {
        map[row.patient_id] = {
          date: row.appointment_date,
          time: row.start_time,
          status: row.status,
          professionalName: row.professional?.name || null,
        };
      }
    }
    setLastAppointments(map);
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
    return _handleSchedulePatient(entry);
  };

  const handleNotifyPatientSms = async (entry: WaitingListEntry) => {
    if (!entry.patient?.phone) {
      toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" });
      return;
    }
    setSmsSendingId(entry.id);
    try {
      const firstName = entry.patient.name.split(" ")[0];
      const slotText =
        entry.offered_appointment_date && entry.offered_appointment_time
          ? ` em ${new Date(entry.offered_appointment_date + "T12:00:00").toLocaleDateString("pt-BR")} as ${entry.offered_appointment_time.slice(0, 5)}${entry.offered_professional_name ? ` com ${entry.offered_professional_name}` : ""}`
          : "";
      const message = `${firstName}, abriu uma vaga${slotText}. Confirme pelo app ou entre em contato. ${currentClinic?.name ?? ""}`.trim();

      const { data, error } = await supabase.functions.invoke("sindicato-send-sms", {
        body: { body: message, recipients: [{ phone: entry.patient.phone, name: entry.patient.name }] },
      });
      if (error) throw error;
      const failed = (data?.results ?? []).find((r: any) => r.status !== "sent");
      if (failed) throw new Error(failed.error || "Falha no envio do SMS");

      await supabase
        .from("waiting_list")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", entry.id);

      toast({ title: "SMS enviado!", description: `Vaga informada para ${entry.patient.name}` });
      fetchWaitingList();
    } catch (error: any) {
      toast({ title: "Erro ao enviar SMS", description: error.message, variant: "destructive" });
    } finally {
      setSmsSendingId(null);
    }
  };

  const _handleSchedulePatient = async (entry: WaitingListEntry) => {
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
    setSelectedPatientData(null);
    setSelectedProfessional("");
    setPreferredTimes([]);
    setNotes("");
    setPatientSearch("");
    setPatients([]);
  };

  const togglePreferredTime = (time: string) => {
    setPreferredTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const timeOptions = ["Manhã", "Tarde", "Noite"];

  const lastAppointmentStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Atendido';
      case 'confirmed': return 'Confirmado';
      case 'no_show': return 'Faltou';
      case 'cancelled': return 'Cancelado';
      case 'scheduled': return 'Agendado';
      case 'in_progress': return 'Em atendimento';
      case 'arrived': return 'Chegou';
      default: return status;
    }
  };

  const lastAppointmentStatusClass = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30';
      case 'confirmed': return 'text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30';
      case 'no_show': return 'text-red-700 border-red-300 bg-red-50 dark:text-red-400 dark:bg-red-950/30';
      case 'cancelled': return 'text-muted-foreground border-border bg-muted';
      default: return 'text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30';
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filterProfessional !== "all") {
        if (filterProfessional === "none") {
          if (entry.professional) return false;
        } else if (entry.professional?.id !== filterProfessional) {
          return false;
        }
      }

      if (filterStatus === "notified" && entry.notification_status !== "notified") return false;
      if (filterStatus === "waiting" && entry.notification_status === "notified") return false;

      if (filterDateFrom) {
        const entryDate = entry.created_at.slice(0, 10);
        if (entryDate < filterDateFrom) return false;
      }
      if (filterDateTo) {
        const entryDate = entry.created_at.slice(0, 10);
        if (entryDate > filterDateTo) return false;
      }

      if (filterPatientName.trim()) {
        if (!entry.patient.name.toLowerCase().includes(filterPatientName.trim().toLowerCase())) return false;
      }

      return true;
    });
  }, [entries, filterProfessional, filterStatus, filterDateFrom, filterDateTo, filterPatientName]);

  const hasActiveFilters =
    filterProfessional !== "all" || filterStatus !== "all" || !!filterDateFrom || !!filterDateTo || !!filterPatientName.trim();

  const clearFilters = () => {
    setFilterProfessional("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterPatientName("");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast({ title: "Não foi possível abrir a janela de impressão", description: "Verifique o bloqueador de pop-ups.", variant: "destructive" });
      return;
    }

    const profName =
      filterProfessional === "all"
        ? "Todos os profissionais"
        : filterProfessional === "none"
          ? "Sem preferência de profissional"
          : professionals.find((p) => p.id === filterProfessional)?.name || "—";

    const periodo =
      filterDateFrom || filterDateTo
        ? `${filterDateFrom ? new Date(filterDateFrom + "T12:00:00").toLocaleDateString("pt-BR") : "início"} até ${filterDateTo ? new Date(filterDateTo + "T12:00:00").toLocaleDateString("pt-BR") : "hoje"}`
        : "Todos os períodos";

    const statusLabel =
      filterStatus === "all" ? "Todos" : filterStatus === "notified" ? "Vaga oferecida" : "Aguardando";

    const rows = filteredEntries
      .map((entry, idx) => {
        const last = lastAppointments[entry.patient.id];
        const lastInfo = last
          ? `${new Date(last.date + "T12:00:00").toLocaleDateString("pt-BR")}${last.time ? " " + last.time.slice(0, 5) : ""} - ${last.professionalName || "-"} (${lastAppointmentStatusLabel(last.status)})`
          : "Sem agendamentos anteriores";
        return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${entry.patient.name}</td>
          <td>${entry.patient.phone || "-"}</td>
          <td>${entry.professional?.name || "Qualquer profissional"}</td>
          <td>${entry.preferred_times?.join(", ") || "-"}</td>
          <td>${entry.notification_status === "notified" ? "Vaga oferecida" : "Aguardando"}</td>
          <td>${new Date(entry.created_at).toLocaleDateString("pt-BR")}</td>
          <td>${lastInfo}</td>
        </tr>`;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Espera - ${currentClinic?.name || ""}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1a1a1a; }
            h1 { font-size: 20px; margin: 0 0 4px 0; }
            .subtitle { color: #555; font-size: 13px; margin-bottom: 16px; }
            .filters { font-size: 12px; color: #333; margin-bottom: 16px; display: flex; gap: 24px; flex-wrap: wrap; border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; background: #fafafa; }
            .filters strong { color: #000; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
            th { background: #f2f2f2; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Lista de Espera</h1>
          <div class="subtitle">${currentClinic?.name || ""} — gerado em ${new Date().toLocaleString("pt-BR")}</div>
          <div class="filters">
            <div><strong>Profissional:</strong> ${profName}</div>
            <div><strong>Entrada na fila:</strong> ${periodo}</div>
            <div><strong>Status:</strong> ${statusLabel}</div>
            <div><strong>Total:</strong> ${filteredEntries.length} paciente(s)</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Paciente</th>
                <th>Telefone</th>
                <th>Profissional</th>
                <th>Preferência</th>
                <th>Status</th>
                <th>Entrada</th>
                <th>Último agendamento</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="8" style="text-align:center;color:#777;">Nenhum registro encontrado com os filtros aplicados</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

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
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Digite nome ou CPF para buscar..." 
                        value={patientSearch}
                        onValueChange={setPatientSearch}
                      />
                      <CommandList>
                        {patientSearchLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
                          </div>
                        ) : patientSearch.trim().length < 2 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            Digite ao menos 2 caracteres para buscar
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                            <CommandGroup>
                              {patients.map((patient) => (
                                <CommandItem
                                  key={patient.id}
                                  value={patient.id}
                                  onSelect={() => {
                                    setSelectedPatient(patient.id);
                                    setSelectedPatientData(patient);
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
                          </>
                        )}
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtrar lista
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar filtros
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Imprimir lista
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Profissional</Label>
              <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  <SelectItem value="none">Sem preferência</SelectItem>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="waiting">Aguardando</SelectItem>
                  <SelectItem value="notified">Vaga oferecida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Entrada de</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Entrada até</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nome do paciente</Label>
              <div className="relative mt-1">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filterPatientName}
                  onChange={(e) => setFilterPatientName(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="pl-8"
                />
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground mt-3">
              Mostrando {filteredEntries.length} de {entries.length} paciente(s) na lista.
            </p>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className="grid gap-4">
          {filteredEntries.map((entry, index) => (
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
                       {/* Último agendamento */}
                       {lastAppointments[entry.patient.id] ? (
                         <div className="mt-2 flex items-center gap-2 flex-wrap">
                           <span className="text-xs text-muted-foreground">
                             Último agendamento: {new Date(lastAppointments[entry.patient.id].date + 'T12:00:00').toLocaleDateString('pt-BR')}
                             {lastAppointments[entry.patient.id].time ? ` às ${lastAppointments[entry.patient.id].time!.slice(0, 5)}` : ''}
                             {lastAppointments[entry.patient.id].professionalName ? ` com ${lastAppointments[entry.patient.id].professionalName}` : ''}
                           </span>
                           <Badge variant="outline" className={cn("text-xs", lastAppointmentStatusClass(lastAppointments[entry.patient.id].status))}>
                             {lastAppointmentStatusLabel(lastAppointments[entry.patient.id].status)}
                           </Badge>
                         </div>
                       ) : (
                         <p className="text-xs text-muted-foreground mt-2">Sem agendamentos anteriores</p>
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
                      variant="outline"
                      size="sm"
                      disabled={smsSendingId === entry.id}
                      onClick={() => handleNotifyPatientSms(entry)}
                    >
                      {smsSendingId === entry.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-1" />
                      )}
                      Notificar SMS
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
            {entries.length > 0 ? (
              <>
                <p className="mb-4">Nenhum paciente encontrado com os filtros aplicados</p>
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtros
                </Button>
              </>
            ) : (
              <>
                <p className="mb-4">Nenhum paciente na lista de espera</p>
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar paciente
                </Button>
              </>
            )}
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
