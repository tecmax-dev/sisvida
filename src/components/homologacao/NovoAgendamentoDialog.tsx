import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
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
import { toast } from "sonner";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
    company_name: "",
    company_cnpj: "",
    company_phone: "",
    appointment_date: new Date(),
    start_time: "09:00",
    professional_id: "",
    service_type_id: "",
    notes: "",
  });

  // Fetch professionals
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
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle>Novo Agendamento</PopupTitle>
        <PopupDescription>
          Preencha os dados para criar um novo agendamento de homologação
        </PopupDescription>
      </PopupHeader>
        
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
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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

        <PopupFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Salvando..." : "Criar Agendamento"}
          </Button>
        </PopupFooter>
    </PopupBase>
  );
}
