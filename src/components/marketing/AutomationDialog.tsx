import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageSquare, Mail, Smartphone, Zap, Calendar, Clock, UserPlus, BellRing, RotateCcw } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  trigger_type: z.string().min(1, "Gatilho é obrigatório"),
  channel: z.enum(["whatsapp", "email", "sms"]),
  message_template: z.string().min(1, "Mensagem é obrigatória"),
  delay_hours: z.string().optional(),
  is_active: z.boolean(),
  // Trigger config
  inactivityDays: z.string().optional(),
  reminderHours: z.string().optional(),
  returnDays: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  message_template: string;
  channel: string;
  delay_hours: number | null;
  is_active: boolean;
}

interface AutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation: Automation | null;
  clinicId: string;
}

const triggers = [
  {
    value: "post_attendance",
    label: "Pós-atendimento",
    description: "Após consulta ser concluída",
    icon: Calendar,
  },
  {
    value: "appointment_confirmed",
    label: "Confirmação de consulta",
    description: "Quando paciente confirma a consulta",
    icon: BellRing,
  },
  {
    value: "post_registration",
    label: "Pós-cadastro",
    description: "Após novo cadastro de paciente",
    icon: UserPlus,
  },
  {
    value: "inactivity",
    label: "Inatividade",
    description: "Após período sem visita",
    icon: Clock,
  },
  {
    value: "return_reminder",
    label: "Lembrete de retorno",
    description: "Lembrar paciente de retornar",
    icon: RotateCcw,
  },
];

const templateVariables = [
  { variable: "{nome}", description: "Nome do paciente" },
  { variable: "{primeiro_nome}", description: "Primeiro nome" },
  { variable: "{clinica}", description: "Nome da clínica" },
  { variable: "{data_consulta}", description: "Data da consulta" },
  { variable: "{profissional}", description: "Nome do profissional" },
];

export default function AutomationDialog({
  open,
  onOpenChange,
  automation,
  clinicId,
}: AutomationDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!automation;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      trigger_type: "",
      channel: "whatsapp",
      message_template: "",
      delay_hours: "",
      is_active: true,
      inactivityDays: "",
      reminderHours: "",
      returnDays: "",
    },
  });

  const selectedTrigger = form.watch("trigger_type");

  useEffect(() => {
    if (automation) {
      const config = automation.trigger_config || {};
      form.reset({
        name: automation.name,
        trigger_type: automation.trigger_type,
        channel: automation.channel as "whatsapp" | "email" | "sms",
        message_template: automation.message_template,
        delay_hours: automation.delay_hours?.toString() || "",
        is_active: automation.is_active,
        inactivityDays: config.inactivityDays?.toString() || "",
        reminderHours: config.reminderHours?.toString() || "",
        returnDays: config.returnDays?.toString() || "",
      });
    } else {
      form.reset({
        name: "",
        trigger_type: "",
        channel: "whatsapp",
        message_template: "",
        delay_hours: "",
        is_active: true,
        inactivityDays: "",
        reminderHours: "",
        returnDays: "",
      });
    }
  }, [automation, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const triggerConfig: Record<string, any> = {};
      if (data.inactivityDays) triggerConfig.inactivityDays = parseInt(data.inactivityDays);
      if (data.reminderHours) triggerConfig.reminderHours = parseInt(data.reminderHours);
      if (data.returnDays) triggerConfig.returnDays = parseInt(data.returnDays);

      const payload = {
        clinic_id: clinicId,
        name: data.name,
        trigger_type: data.trigger_type,
        trigger_config: triggerConfig,
        channel: data.channel,
        message_template: data.message_template,
        delay_hours: data.delay_hours ? parseInt(data.delay_hours) : 0,
        is_active: data.is_active,
      };

      const { error } = await (supabase as any).from("automation_flows").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Automação criada com sucesso");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao criar automação");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const triggerConfig: Record<string, any> = {};
      if (data.inactivityDays) triggerConfig.inactivityDays = parseInt(data.inactivityDays);
      if (data.reminderHours) triggerConfig.reminderHours = parseInt(data.reminderHours);
      if (data.returnDays) triggerConfig.returnDays = parseInt(data.returnDays);

      const payload = {
        name: data.name,
        trigger_type: data.trigger_type,
        trigger_config: triggerConfig,
        channel: data.channel,
        message_template: data.message_template,
        delay_hours: data.delay_hours ? parseInt(data.delay_hours) : 0,
        is_active: data.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("automation_flows")
        .update(payload)
        .eq("id", automation!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Automação atualizada com sucesso");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar automação");
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const insertVariable = (variable: string) => {
    const currentValue = form.getValues("message_template");
    form.setValue("message_template", currentValue + variable);
  };

  const selectedChannel = form.watch("channel");
  const messageTemplate = form.watch("message_template");

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="3xl">
      <PopupHeader>
        <PopupTitle>
          {isEditing ? "Editar Automação" : "Nova Automação"}
        </PopupTitle>
        <PopupDescription>
          Configure mensagens automáticas para seus pacientes
        </PopupDescription>
      </PopupHeader>

      <ScrollArea className="max-h-[60vh] pr-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1 mr-4">
                      <FormLabel>Nome da Automação</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Agradecimento pós-consulta" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 mt-6">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="mb-0">Ativa</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="trigger_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gatilho</FormLabel>
                    <div className="grid grid-cols-3 gap-3">
                      {triggers.map((trigger) => {
                        const Icon = trigger.icon;
                        return (
                          <Card
                            key={trigger.value}
                            className={`cursor-pointer transition-all ${
                              field.value === trigger.value
                                ? "border-primary ring-2 ring-primary/20"
                                : "hover:border-primary/50"
                            }`}
                            onClick={() => field.onChange(trigger.value)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" />
                                <span className="font-medium text-sm">{trigger.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {trigger.description}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Trigger-specific config */}
              {selectedTrigger === "inactivity" && (
                <FormField
                  control={form.control}
                  name="inactivityDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dias de inatividade</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ex: 180" {...field} />
                      </FormControl>
                      <FormDescription>
                        Quantos dias sem visita para disparar a automação
                      </FormDescription>
                    </FormItem>
                  )}
                />
              )}

              {selectedTrigger === "appointment_reminder" && (
                <FormField
                  control={form.control}
                  name="reminderHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas antes da consulta</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ex: 24" {...field} />
                      </FormControl>
                      <FormDescription>
                        Quantas horas antes da consulta enviar o lembrete
                      </FormDescription>
                    </FormItem>
                  )}
                />
              )}

              {selectedTrigger === "return_reminder" && (
                <FormField
                  control={form.control}
                  name="returnDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dias após última consulta</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ex: 30" {...field} />
                      </FormControl>
                      <FormDescription>
                        Quantos dias depois da consulta enviar o lembrete de retorno
                      </FormDescription>
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Canal de Envio</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="whatsapp">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-green-500" />
                              WhatsApp
                            </div>
                          </SelectItem>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-blue-500" />
                              Email
                            </div>
                          </SelectItem>
                          <SelectItem value="sms">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-purple-500" />
                              SMS
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delay_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delay (horas)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0 = imediato" {...field} />
                      </FormControl>
                      <FormDescription>
                        Tempo de espera após o gatilho
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Variáveis disponíveis</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {templateVariables.map((v) => (
                    <Button
                      key={v.variable}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(v.variable)}
                      title={v.description}
                    >
                      {v.variable}
                    </Button>
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="message_template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Olá {primeiro_nome}! Obrigado pela sua visita..."
                        className="min-h-[150px] font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {messageTemplate && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="text-sm font-medium mb-2">Pré-visualização:</div>
                    <div className="bg-background rounded-lg p-4 whitespace-pre-wrap text-sm">
                      {messageTemplate
                        .replace("{nome}", "Maria Silva")
                        .replace("{primeiro_nome}", "Maria")
                        .replace("{clinica}", "Clínica Exemplo")
                        .replace("{data_consulta}", format(new Date(), "dd/MM/yyyy"))
                        .replace("{profissional}", "Dr. João")}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <PopupFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : isEditing
                  ? "Salvar Alterações"
                  : "Criar Automação"}
              </Button>
            </PopupFooter>
          </form>
        </Form>
      </ScrollArea>
    </PopupBase>
  );
}
