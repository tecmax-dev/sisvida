import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Mail, Smartphone, Calendar, Users, Info } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  segment_id: z.string().optional(),
  channel: z.enum(["whatsapp", "email", "sms"]),
  message_template: z.string().min(1, "Mensagem é obrigatória"),
  scheduled_at: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  segment_id: string | null;
  channel: string;
  message_template: string;
  scheduled_at: string | null;
  status: string;
}

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
  clinicId: string;
}

const templateVariables = [
  { variable: "{nome}", description: "Nome do paciente" },
  { variable: "{primeiro_nome}", description: "Primeiro nome do paciente" },
  { variable: "{clinica}", description: "Nome da clínica" },
  { variable: "{data}", description: "Data atual" },
  { variable: "{telefone}", description: "Telefone do paciente" },
];

export default function CampaignDialog({
  open,
  onOpenChange,
  campaign,
  clinicId,
}: CampaignDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!campaign;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      segment_id: "",
      channel: "whatsapp",
      message_template: "",
      scheduled_at: "",
    },
  });

  const { data: segments } = useQuery({
    queryKey: ["patient-segments", clinicId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patient_segments")
        .select("id, name, patient_count")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; patient_count: number | null }[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (campaign) {
      form.reset({
        name: campaign.name,
        description: campaign.description || "",
        segment_id: campaign.segment_id || "",
        channel: campaign.channel as "whatsapp" | "email" | "sms",
        message_template: campaign.message_template,
        scheduled_at: campaign.scheduled_at
          ? format(new Date(campaign.scheduled_at), "yyyy-MM-dd'T'HH:mm")
          : "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        segment_id: "",
        channel: "whatsapp",
        message_template: "",
        scheduled_at: "",
      });
    }
  }, [campaign, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        clinic_id: clinicId,
        name: data.name,
        description: data.description || null,
        segment_id: data.segment_id || null,
        channel: data.channel,
        message_template: data.message_template,
        scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null,
        status: data.scheduled_at ? "scheduled" : "draft",
      };

      const { error } = await (supabase as any).from("campaigns").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha criada com sucesso");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao criar campanha");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        segment_id: data.segment_id || null,
        channel: data.channel,
        message_template: data.message_template,
        scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null,
        status: data.scheduled_at ? "scheduled" : campaign?.status || "draft",
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("campaigns")
        .update(payload)
        .eq("id", campaign!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha atualizada com sucesso");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar campanha");
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
  const selectedSegmentId = form.watch("segment_id");
  const selectedSegment = segments?.find((s) => s.id === selectedSegmentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Campanha" : "Nova Campanha"}
          </DialogTitle>
          <DialogDescription>
            Configure os detalhes da sua campanha de marketing
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="audience">Audiência</TabsTrigger>
                <TabsTrigger value="message">Mensagem</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Campanha</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Promoção de Natal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o objetivo da campanha..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Canal de Envio</FormLabel>
                      <div className="grid grid-cols-3 gap-3">
                        <Card
                          className={`cursor-pointer transition-all ${
                            field.value === "whatsapp"
                              ? "border-primary ring-2 ring-primary/20"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => field.onChange("whatsapp")}
                        >
                          <CardContent className="flex flex-col items-center justify-center p-4">
                            <MessageSquare className="h-8 w-8 text-green-500 mb-2" />
                            <span className="font-medium">WhatsApp</span>
                          </CardContent>
                        </Card>
                        <Card
                          className={`cursor-pointer transition-all ${
                            field.value === "email"
                              ? "border-primary ring-2 ring-primary/20"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => field.onChange("email")}
                        >
                          <CardContent className="flex flex-col items-center justify-center p-4">
                            <Mail className="h-8 w-8 text-blue-500 mb-2" />
                            <span className="font-medium">Email</span>
                          </CardContent>
                        </Card>
                        <Card
                          className={`cursor-pointer transition-all ${
                            field.value === "sms"
                              ? "border-primary ring-2 ring-primary/20"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => field.onChange("sms")}
                        >
                          <CardContent className="flex flex-col items-center justify-center p-4">
                            <Smartphone className="h-8 w-8 text-purple-500 mb-2" />
                            <span className="font-medium">SMS</span>
                          </CardContent>
                        </Card>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduled_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agendamento (opcional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="datetime-local"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Deixe em branco para enviar manualmente ou salvar como rascunho
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="audience" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="segment_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segmento de Pacientes</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um segmento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {segments?.map((segment) => (
                            <SelectItem key={segment.id} value={segment.id}>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                {segment.name}
                                <span className="text-muted-foreground">
                                  ({segment.patient_count || 0})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Escolha para quais pacientes esta campanha será enviada
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedSegment && (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{selectedSegment.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {selectedSegment.patient_count || 0} pacientes serão alcançados
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!segments?.length && (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Info className="h-5 w-5" />
                        <div>
                          <div className="font-medium">Nenhum segmento criado</div>
                          <div className="text-sm">
                            Crie segmentos na aba "Segmentos" para organizar seus pacientes
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="message" className="space-y-4 mt-4">
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
                          placeholder={
                            selectedChannel === "whatsapp"
                              ? "Olá {primeiro_nome}! 👋\n\nEsperamos que esteja bem..."
                              : selectedChannel === "email"
                              ? "Prezado(a) {nome},\n\nEsperamos que esta mensagem o encontre bem..."
                              : "{clinica}: Olá {primeiro_nome}! ..."
                          }
                          className="min-h-[200px] font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {selectedChannel === "sms" && (
                          <span className="text-amber-600">
                            SMS limitado a 160 caracteres. Atual: {messageTemplate.length}
                          </span>
                        )}
                        {selectedChannel === "whatsapp" && (
                          <span>Você pode usar emojis e formatação do WhatsApp</span>
                        )}
                      </FormDescription>
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
                          .replace("{data}", format(new Date(), "dd/MM/yyyy"))
                          .replace("{telefone}", "(11) 99999-9999")}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
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
                  ? "Atualizar"
                  : "Criar Campanha"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
