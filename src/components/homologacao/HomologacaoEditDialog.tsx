import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HomologacaoAppointment {
  id: string;
  employee_name: string;
  employee_cpf?: string | null;
  company_name: string;
  company_cnpj?: string | null;
  company_phone: string;
  company_email?: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  professional_id?: string | null;
  service_type_id?: string | null;
  protocol_number?: string | null;
}

interface HomologacaoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: HomologacaoAppointment | null;
  onSave: (data: Partial<HomologacaoAppointment>) => Promise<void>;
  isSaving?: boolean;
}

export function HomologacaoEditDialog({
  open,
  onOpenChange,
  appointment,
  onSave,
  isSaving = false,
}: HomologacaoEditDialogProps) {
  const { currentClinic } = useAuth();
  
  const [formData, setFormData] = useState({
    employee_name: "",
    employee_cpf: "",
    company_name: "",
    company_cnpj: "",
    company_phone: "",
    company_email: "",
    appointment_date: new Date(),
    start_time: "09:00",
    professional_id: "",
    service_type_id: "",
    notes: "",
    status: "scheduled",
  });

  useEffect(() => {
    if (appointment && open) {
      setFormData({
        employee_name: appointment.employee_name || "",
        employee_cpf: appointment.employee_cpf || "",
        company_name: appointment.company_name || "",
        company_cnpj: appointment.company_cnpj || "",
        company_phone: appointment.company_phone || "",
        company_email: appointment.company_email || "",
        appointment_date: appointment.appointment_date 
          ? new Date(appointment.appointment_date + "T12:00:00") 
          : new Date(),
        start_time: appointment.start_time?.slice(0, 5) || "09:00",
        professional_id: appointment.professional_id || "",
        service_type_id: appointment.service_type_id || "",
        notes: appointment.notes || "",
        status: appointment.status || "scheduled",
      });
    }
  }, [appointment, open]);

  const { data: professionals } = useQuery({
    queryKey: ["homologacao-professionals", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_professionals")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic?.id && open,
  });

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

  const handleSubmit = async () => {
    const serviceType = serviceTypes?.find(s => s.id === formData.service_type_id);
    const durationMinutes = serviceType?.duration_minutes || 30;
    
    const [hours, minutes] = formData.start_time.split(":").map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes + durationMinutes);
    const end_time = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    await onSave({
      id: appointment?.id,
      employee_name: formData.employee_name,
      employee_cpf: formData.employee_cpf || null,
      company_name: formData.company_name,
      company_cnpj: formData.company_cnpj || null,
      company_phone: formData.company_phone,
      company_email: formData.company_email || null,
      appointment_date: format(formData.appointment_date, "yyyy-MM-dd"),
      start_time: formData.start_time,
      end_time,
      professional_id: formData.professional_id || null,
      service_type_id: formData.service_type_id || null,
      notes: formData.notes || null,
      status: formData.status,
    });
  };

  const timeSlots = [];
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  const statusOptions = [
    { value: "scheduled", label: "Agendado" },
    { value: "confirmed", label: "Confirmado" },
    { value: "completed", label: "Realizado" },
    { value: "cancelled", label: "Cancelado" },
    { value: "no_show", label: "Faltou" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Agendamento</DialogTitle>
          <DialogDescription>
            Altere os dados do agendamento de homologação
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_phone">Telefone *</Label>
                <Input
                  id="company_phone"
                  value={formData.company_phone}
                  onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">E-mail</Label>
                <Input
                  id="company_email"
                  value={formData.company_email}
                  onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                  placeholder="email@empresa.com"
                  type="email"
                />
              </div>
            </div>
          </div>

          {/* Appointment Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Dados do Agendamento</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.appointment_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.appointment_date ? (
                        format(formData.appointment_date, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.appointment_date}
                      onSelect={(date) => date && setFormData({ ...formData, appointment_date: date })}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
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
                    {professionals?.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
