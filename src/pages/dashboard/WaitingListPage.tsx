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
  const [lastAppointmentsByProfessional, setLastAppointmentsByProfessional] = useState<Record<string, LastAppointmentInfo>>({});
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [smsSendingId, setSmsSendingId] = useState<string | null>(null);
  const [slotEntry, setSlotEntry] = useState<WaitingListEntry | null>(null);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotProfessionalId, setSlotProfessionalId] = useState<string>("none");
  const [slotSending, setSlotSending] = useState(false);


  // Filtros de visualização/impressão
  const [filterProfessional, setFilterProfessional] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPatientName, setFilterPatientName] = useState("");
  const [filterNeverAttended, setFilterNeverAttended] = useState(false);

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
      setLastAppointmentsByProfessional({});
      return;
    }
    const patientIds = Array.from(new Set(list.map((e) => e.patient.id)));
    const { data, error } = await supabase
      .from('appointments')
      .select('patient_id, professional_id, appointment_date, start_time, status, professional:professionals!appointments_professional_id_fkey (name)')
      .eq('clinic_id', currentClinic.id)
      .in('patient_id', patientIds)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error fetching last appointments:', error);
      return;
    }

    const map: Record<string, LastAppointmentInfo> = {};
    const mapByProfessional: Record<string, LastAppointmentInfo> = {};
    for (const row of (data as any[]) || []) {
      if (!map[row.patient_id]) {
        map[row.patient_id] = {
          date: row.appointment_date,
          time: row.start_time,
          status: row.status,
          professionalName: row.professional?.name || null,
        };
      }
      if (row.professional_id) {
        const key = `${row.patient_id}::${row.professional_id}`;
        if (!mapByProfessional[key]) {
          mapByProfessional[key] = {
            date: row.appointment_date,
            time: row.start_time,
            status: row.status,
            professionalName: row.professional?.name || null,
          };
        }
      }
    }
    setLastAppointments(map);
    setLastAppointmentsByProfessional(mapByProfessional);
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

  const handleNotifyPatient = async (
    entry: WaitingListEntry,
    override?: { date: string; time: string; professionalId: string | null; professionalName: string },
  ) => {
    try {
      const slotDateValue = override?.date || entry.offered_appointment_date;
      const slotTimeValue = override?.time || entry.offered_appointment_time;

      if (!slotDateValue || !slotTimeValue) {
        setSlotEntry(entry);
        setSlotDate("");
        setSlotTime("");
        setSlotProfessionalId(entry.professional?.id ?? "none");
        return;
      }


      const { data, error } = await supabase.functions.invoke('send-waiting-list-slot', {
        body: {
          waitingListId: entry.id,
          appointmentDate: slotDateValue,
          startTime: slotTimeValue,
          professionalId:
            override?.professionalId ?? entry.offered_professional_id ?? entry.professional?.id ?? null,
          professionalName:
            override?.professionalName ||
            entry.offered_professional_name ||
            entry.professional?.name ||
            "Profissional",
        },
      });


      if (error) throw error;
      if (!(data as any)?.ok) {
        const reason = (data as any)?.reason;
        const map: Record<string, string> = {
          NO_CONSENT: "Paciente ainda não autorizou receber mensagens no WhatsApp.",
          OPT_OUT: "Paciente pediu para não receber mensagens.",
          INVALID_PHONE: "Telefone inválido no cadastro.",
          TEMPLATE_NOT_APPROVED: "O modelo oficial não pôde ser enviado agora.",
        };
        throw new Error(map[reason] || reason || "Não foi possível enviar a mensagem.");
      }

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

  const handleConfirmSlotAndNotify = async () => {
    if (!slotEntry) return;
    if (!slotDate || !slotTime) {
      toast({ title: "Informe a data e o horário da vaga", variant: "destructive" });
      return;
    }
    const professionalId = slotProfessionalId !== "none" ? slotProfessionalId : null;
    const professionalName =
      professionals.find((p) => p.id === professionalId)?.name ||
      slotEntry.professional?.name ||
      "Profissional";

    setSlotSending(true);
    try {
      const { error } = await supabase
        .from("waiting_list")
        .update({
          offered_appointment_date: slotDate,
          offered_appointment_time: slotTime.length === 5 ? `${slotTime}:00` : slotTime,
          offered_professional_id: professionalId,
          offered_professional_name: professionalName,
          slot_offered_at: new Date().toISOString(),
        })
        .eq("id", slotEntry.id);
      if (error) throw error;

      const entryToNotify = slotEntry;
      setSlotEntry(null);
      await handleNotifyPatient(entryToNotify, {
        date: slotDate,
        time: slotTime.length === 5 ? `${slotTime}:00` : slotTime,
        professionalId,
        professionalName,
      });
    } catch (error: any) {
      toast({ title: "Erro ao definir vaga", description: error.message, variant: "destructive" });
    } finally {
      setSlotSending(false);
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

  const isNeverAttended = useCallback(
    (entry: WaitingListEntry) => {
      if (entry.professional) {
        return !lastAppointmentsByProfessional[`${entry.patient.id}::${entry.professional.id}`];
      }
      return !lastAppointments[entry.patient.id];
    },
    [lastAppointments, lastAppointmentsByProfessional]
  );

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

      if (filterNeverAttended && !isNeverAttended(entry)) return false;

      return true;
    });
  }, [entries, filterProfessional, filterStatus, filterDateFrom, filterDateTo, filterPatientName, filterNeverAttended, isNeverAttended]);

  const hasActiveFilters =
    filterProfessional !== "all" || filterStatus !== "all" || !!filterDateFrom || !!filterDateTo || !!filterPatientName.trim() || filterNeverAttended;

  const clearFilters = () => {
    setFilterProfessional("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterPatientName("");
    setFilterNeverAttended(false);
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
        const lastWithWaitedProfessional = entry.professional
          ? lastAppointmentsByProfessional[`${entry.patient.id}::${entry.professional.id}`]
          : null;
        const lastWithProfInfo = entry.professional
          ? lastWithWaitedProfessional
            ? `${new Date(lastWithWaitedProfessional.date + "T12:00:00").toLocaleDateString("pt-BR")} (${lastAppointmentStatusLabel(lastWithWaitedProfessional.status)})`
            : "Nunca atendido"
          : "-";
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
          <td>${lastWithProfInfo}</td>
        </tr>`;
      })
      .join("");

    const logoUrl = (currentClinic as any)?.logo_url as string | undefined;
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${currentClinic?.name || "Logo"}" class="logo" />`
      : `<div class="logo-fallback">${(currentClinic?.name || "C").slice(0, 1).toUpperCase()}</div>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Espera - ${currentClinic?.name || ""}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; padding: 32px 36px; color: #374151; }
            .header { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding-bottom: 16px; margin-bottom: 18px; border-bottom: 1px solid #e5e7eb; }
            .logo { height: 56px; width: auto; object-fit: contain; margin-bottom: 4px; }
            .logo-fallback { height: 56px; width: 56px; border-radius: 10px; background: #111827; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; margin-bottom: 4px; }
            .header h1 { font-size: 16px; margin: 0; font-weight: 600; color: #111827; letter-spacing: 0.01em; }
            .header .subtitle { color: #9ca3af; font-size: 10.5px; margin-top: 1px; }
            .filters { font-size: 10.5px; color: #6b7280; margin-bottom: 16px; display: flex; justify-content: center; gap: 22px; flex-wrap: wrap; }
            .filters strong { color: #374151; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
            th, td { border-bottom: 1px solid #f0f1f3; padding: 7px 9px; text-align: left; vertical-align: top; }
            th { color: #9ca3af; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; border-bottom: 1.5px solid #d1d5db; }
            td { color: #374151; }
            .muted { color: #9ca3af; }
            .footer-note { margin-top: 24px; font-size: 9.5px; color: #c1c5cc; text-align: center; }
            @media print { body { padding: 10px 16px; } }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h1>Lista de Espera — ${currentClinic?.name || ""}</h1>
            <div class="subtitle">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
          </div>
          <div class="filters">
            <div><strong>Profissional:</strong> ${profName}</div>
            <div><strong>Período:</strong> ${periodo}</div>
            <div><strong>Status:</strong> ${statusLabel}</div>
            ${filterNeverAttended ? `<div><strong>Histórico:</strong> Somente nunca atendidos</div>` : ""}
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
                <th>Última c/ profissional aguardado</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="9" style="text-align:center;color:#9ca3af;">Nenhum registro encontrado com os filtros aplicados</td></tr>`}
            </tbody>
          </table>
          <div class="footer-note">${currentClinic?.name || ""}</div>
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

      <Card className="shadow-none border-border/70 bg-muted/30">
        <CardHeader className="pb-2 pt-3.5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filtrar lista
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpar filtros
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5 mr-1" />
                Imprimir lista
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
            <div className="flex flex-col justify-end">
              <Label className="text-xs">Histórico</Label>
              <Button
                type="button"
                variant={filterNeverAttended ? "default" : "outline"}
                size="sm"
                className="mt-1 h-9 text-xs justify-start"
                onClick={() => setFilterNeverAttended((v) => !v)}
              >
                <User className="h-3.5 w-3.5 mr-1.5" />
                Nunca atendido
              </Button>
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
        <div className="space-y-1.5">
          {filteredEntries.map((entry, index) => {
            const last = lastAppointments[entry.patient.id];
            const lastWithWaitedProfessional = entry.professional
              ? lastAppointmentsByProfessional[`${entry.patient.id}::${entry.professional.id}`]
              : null;
            return (
            <Card key={entry.id} className="shadow-none border-border/60 hover:border-border transition-colors">
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-semibold">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-medium text-sm text-foreground leading-tight">{entry.patient.name}</h3>
                        <span className="text-[11px] text-muted-foreground">{entry.patient.phone}</span>
                        {entry.notification_status === 'notified' && (
                          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 text-amber-600 border-amber-300">
                            <Bell className="h-2.5 w-2.5 mr-1" />
                            Vaga oferecida
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-x-1.5 flex-wrap text-[11px] text-muted-foreground leading-tight">
                        <span>{entry.professional ? entry.professional.name : "Qualquer profissional"}</span>
                        {entry.preferred_times && entry.preferred_times.length > 0 && (
                          <span>· {entry.preferred_times.join(", ")}</span>
                        )}
                        <span>· desde {new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                        <span className="text-muted-foreground/70">·</span>
                        {last ? (
                          <span className="inline-flex items-center gap-1">
                            Último: {new Date(last.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            {last.professionalName ? ` (${last.professionalName})` : ''}
                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1 leading-none", lastAppointmentStatusClass(last.status))}>
                              {lastAppointmentStatusLabel(last.status)}
                            </Badge>
                          </span>
                        ) : (
                          <span>Sem histórico</span>
                        )}
                        {entry.professional && (
                          <>
                            <span className="text-muted-foreground/70">·</span>
                            {lastWithWaitedProfessional ? (
                              <span className="inline-flex items-center gap-1">
                                Última c/ {entry.professional.name}: {new Date(lastWithWaitedProfessional.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                <Badge variant="outline" className={cn("text-[9px] h-4 px-1 leading-none", lastAppointmentStatusClass(lastWithWaitedProfessional.status))}>
                                  {lastAppointmentStatusLabel(lastWithWaitedProfessional.status)}
                                </Badge>
                              </span>
                            ) : (
                              <span>Nunca atendido por {entry.professional.name}</span>
                            )}
                          </>
                        )}
                      </div>
                      {entry.notification_status === 'notified' && entry.offered_appointment_date && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-tight">
                          🔔 {new Date(entry.offered_appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')} às {entry.offered_appointment_time?.slice(0, 5)} — {entry.offered_professional_name}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-[11px] text-muted-foreground italic truncate leading-tight">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {entry.notification_status === 'notified' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6.5 px-1.5 text-[11px] text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={() => handleSkipPatient(entry)}
                      >
                        Pular
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6.5 w-6.5"
                      title="Notificar via WhatsApp"
                      onClick={() => handleNotifyPatient(entry)}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6.5 w-6.5"
                      title="Notificar via SMS"
                      disabled={smsSendingId === entry.id}
                      onClick={() => handleNotifyPatientSms(entry)}
                    >
                      {smsSendingId === entry.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-6.5 px-2 text-[11px]"
                      onClick={() => handleSchedulePatient(entry)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Confirmar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6.5 w-6.5 text-destructive"
                      title="Remover"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
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

      <Dialog open={!!slotEntry} onOpenChange={(open) => !open && setSlotEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Definir vaga para {slotEntry?.patient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Data da vaga</Label>
              <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={slotProfessionalId} onValueChange={setSlotProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem profissional definido</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSlotEntry(null)} disabled={slotSending}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmSlotAndNotify} disabled={slotSending}>
                {slotSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Avisar pelo WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
