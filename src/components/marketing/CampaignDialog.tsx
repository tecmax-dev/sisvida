import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
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
import { MessageSquare, Mail, Smartphone, Calendar, Users, Info, ImageIcon, X, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  segment_id: z.string().optional(),
  channel: z.enum(["whatsapp", "email", "sms"]),
  message_template: z.string().min(1, "Mensagem é obrigatória"),
  scheduled_at: z.string().optional(),
  image_url: z.string().optional(),
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
  image_url?: string | null;
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
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      segment_id: "",
      channel: "whatsapp",
      message_template: "",
      scheduled_at: "",
      image_url: "",
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
        image_url: campaign.image_url || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        segment_id: "",
        channel: "whatsapp",
        message_template: "",
        scheduled_at: "",
        image_url: "",
      });
    }
  }, [campaign, form, open]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `campaign-${Date.now()}.${fileExt}`;
      const filePath = `${clinicId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("clinic-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("clinic-assets")
        .getPublicUrl(filePath);

      form.setValue("image_url", urlData.publicUrl);
      toast.success("Imagem carregada com sucesso");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    form.setValue("image_url", "");
  };

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
        image_url: data.image_url || null,
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
        image_url: data.image_url || null,
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
  const imageUrl = form.watch("image_url");

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="3xl">
      <PopupHeader>
        <PopupTitle>
          {isEditing ? "Editar Campanha" : "Nova Campanha"}
        </PopupTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os detalhes da sua campanha de marketing
        </p>
      </PopupHeader>

      <div className="max-h-[60vh] overflow-y-auto">
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
                          placeholder="Escreva sua mensagem aqui..."
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Use as variáveis acima para personalizar a mensagem
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedChannel === "whatsapp" && (
                  <FormField
                    control={form.control}
                    name="image_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imagem (opcional)</FormLabel>
                        {imageUrl ? (
                          <div className="relative inline-block">
                            <img
                              src={imageUrl}
                              alt="Preview"
                              className="max-h-32 rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={removeImage}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer">
                              <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors">
                                {isUploading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4" />
                                )}
                                <span className="text-sm">
                                  {isUploading ? "Enviando..." : "Selecionar imagem"}
                                </span>
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                                disabled={isUploading}
                              />
                            </label>
                          </div>
                        )}
                        <FormDescription>
                          Adicione uma imagem para enviar junto com a mensagem
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {messageTemplate && (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm font-medium mb-2">Prévia:</div>
                      <div className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                        {messageTemplate
                          .replace("{nome}", "João Silva")
                          .replace("{primeiro_nome}", "João")
                          .replace("{clinica}", "Clínica Exemplo")
                          .replace("{data}", format(new Date(), "dd/MM/yyyy"))
                          .replace("{telefone}", "(11) 99999-9999")}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
          Cancelar
        </Button>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? "Salvar Alterações" : "Criar Campanha"}
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
