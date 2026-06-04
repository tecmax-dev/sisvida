import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import {
  useHomologacaoProfessionalsWithSchedules,
  filterProfessionalsByDayOfWeek,
  getProfessionalWorkingDays,
} from "@/hooks/useHomologacaoProfessionalsWithSchedules";

interface NovoAgendamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovoAgendamentoDialog({ open, onOpenChange, onSuccess }: NovoAgendamentoDialogProps) {
  const { currentClinic } = useAuth();
  
  const [formData, setFormData] = useState({
    employee_name: "",
    employee_cpf: "",
    employee_phone: "",
    company_name: "",
    company_cnpj: "",
    company_phone: "",
    appointment_date: new Date(),
    start_time: "09:00",
    professional_id: "",
    service_type_id: "",
    notes: "",
  });

  // Fetch professionals with their schedules
  const { data: allProfessionals = [] } = useHomologacaoProfessionalsWithSchedules({
    clinicId: currentClinic?.id,
    enabled: !!currentClinic?.id && open,
  });

  // Fetch min_advance_booking_hours from clinic settings
  const { data: minAdvanceHours } = useQuery({
    queryKey: ["clinic-min-advance-hours", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return 6;
      const { data, error } = await supabase
        .from("clinics")
        .select("min_advance_booking_hours")
        .eq("id", currentClinic.id)
        .single();
      if (error) return 6;
      return (data as any)?.min_advance_booking_hours ?? 6;
    },
    enabled: !!currentClinic?.id && open,
  });

  // Filter professionals by the selected day of week
  const professionalsForSelectedDay = useMemo(() => {
    const dayOfWeek = formData.appointment_date.getDay();
    return filterProfessionalsByDayOfWeek(allProfessionals, dayOfWeek);
  }, [allProfessionals, formData.appointment_date]);

  // Reset professional when date changes and they don't work that day
  useEffect(() => {
    if (formData.professional_id) {
      const stillAvailable = professionalsForSelectedDay.some(
        (p) => p.id === formData.professional_id
      );
      if (!stillAvailable) {
        setFormData((prev) => ({ ...prev, professional_id: "" }));
      }
    }
  }, [professionalsForSelectedDay, formData.professional_id]);

  // Check if a time slot is within the minimum advance hours
  const isSlotTooClose = useMemo(() => {
    const hours = minAdvanceHours ?? 6;
    return (time: string) => {
      const now = new Date();
      const isToday = isSameDay(formData.appointment_date, now);
      if (!isToday) return false;
      
      const [h, m] = time.split(":").map(Number);
      const slotDate = new Date(formData.appointment_date);
      slotDate.setHours(h, m, 0, 0);
      
      const diffMs = slotDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours < hours;
    };
  }, [formData.appointment_date, minAdvanceHours]);

  // Fetch service types
  const { data: serviceTypes } = useQuery({
    queryKey: ["homologacao-service-types", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_service_types")
        .select("id, name, duration_minutes")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic?.id && open,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const serviceType = serviceTypes?.find(s => s.id === data.service_type_id);
      const durationMinutes = serviceType?.duration_minutes || 30;
      
      // Calculate end time
      const [hours, minutes] = data.start_time.split(":").map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + durationMinutes);
      const end_time = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

      const { error } = await supabase
        .from("homologacao_appointments")
        .insert({
          employee_name: data.employee_name,
          employee_cpf: data.employee_cpf || null,
          employee_phone: data.employee_phone || null,
          company_name: data.company_name,
          company_cnpj: data.company_cnpj || null,
          company_phone: data.company_phone,
          appointment_date: format(data.appointment_date, "yyyy-MM-dd"),
          start_time: data.start_time,
          end_time,
          professional_id: data.professional_id || null,
          service_type_id: data.service_type_id || null,
          notes: data.notes || null,
          clinic_id: currentClinic?.id,
          status: "scheduled",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar agendamento: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      employee_name: "",
      employee_cpf: "",
      employee_phone: "",
      company_name: "",
      company_cnpj: "",
      company_phone: "",
      appointment_date: new Date(),
      start_time: "09:00",
      professional_id: "",
      service_type_id: "",
      notes: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.employee_name.trim()) {
      toast.error("O nome do funcionário é obrigatório");
      return;
    }
    if (!formData.company_name.trim()) {
      toast.error("O nome da empresa é obrigatório");
      return;
    }
    if (!formData.company_phone.trim()) {
      toast.error("O telefone da empresa é obrigatório");
      return;
    }
    // Validate minimum advance booking hours
    if (isSlotTooClose(formData.start_time)) {
      const hours = minAdvanceHours ?? 6;
      toast.error(`Não é possível agendar com menos de ${hours} hora(s) de antecedência`);
      return;
    }
    createMutation.mutate(formData);
  };

  // Generate time slots
  const timeSlots = [];
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo agendamento de homologação
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Employee Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Dados do Funcionário</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee_name">Nome do Funcionário *</Label>
                <Input
                  id="employee_name"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee_cpf">CPF</Label>
                <Input
                  id="employee_cpf"
                  value={formData.employee_cpf}
                  onChange={(e) => setFormData({ ...formData, employee_cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee_phone">Telefone do Trabalhador</Label>
                <Input
                  id="employee_phone"
                  value={formData.employee_phone}
                  onChange={(e) => setFormData({ ...formData, employee_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Dados da Empresa</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da Empresa *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Razão social"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_cnpj">CNPJ</Label>
                <Input
                  id="company_cnpj"
                  value={formData.company_cnpj}
                  onChange={(e) => setFormData({ ...formData, company_cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_phone">Telefone da Empresa *</Label>
              <Input
                id="company_phone"
                value={formData.company_phone}
                onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          {/* Appointment Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Dados do Agendamento</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="appointment_date">Data</Label>
                <Input
                  id="appointment_date"
                  type="date"
                  value={format(formData.appointment_date, "yyyy-MM-dd")}
                  min={format(new Date(), "yyyy-MM-dd")}
                  onChange={(event) => {
                    const selectedDate = parseDateOnlyToLocalNoon(event.target.value);
                    if (!Number.isNaN(selectedDate.getTime())) {
                      setFormData({ ...formData, appointment_date: selectedDate });
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Select
                  value={formData.start_time}
                  onValueChange={(value) => setFormData({ ...formData, start_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => {
                      const tooClose = isSlotTooClose(time);
                      return (
                        <SelectItem key={time} value={time} disabled={tooClose}>
                          {time} {tooClose ? `(mín. ${minAdvanceHours ?? 6}h)` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select
                  value={formData.professional_id}
                  onValueChange={(value) => setFormData({ ...formData, professional_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {professionalsForSelectedDay.length > 0 ? (
                      professionalsForSelectedDay.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>
                          {prof.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4 mx-auto mb-1" />
                        Nenhum profissional atende neste dia
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {professionalsForSelectedDay.length === 0 && allProfessionals.length > 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Nenhum profissional com horário configurado para este dia da semana
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tipo de Serviço</Label>
                <Select
                  value={formData.service_type_id}
                  onValueChange={(value) => setFormData({ ...formData, service_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes?.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.duration_minutes} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre o agendamento..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Salvando..." : "Criar Agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
