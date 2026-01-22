import { useState, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NotificationDialogProps {
  open: boolean;
  onClose: () => void;
  notification?: {
    id: string;
    title: string;
    message: string;
    type: string;
    priority: string;
    target_type: string;
    target_ids: string[] | null;
    scheduled_at: string;
    expires_at: string | null;
    is_active: boolean;
  } | null;
}

export default function NotificationDialog({
  open,
  onClose,
  notification,
}: NotificationDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!notification;

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "info",
    priority: "medium",
    target_type: "all_clinics",
    target_ids: [] as string[],
    scheduled_at: "",
    expires_at: "",
    is_active: true,
  });

  // Fetch clinics for targeting
  const { data: clinics } = useQuery({
    queryKey: ["all-clinics-for-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && formData.target_type === "specific_clinics",
  });

  // Fetch plans for targeting
  const { data: plans } = useQuery({
    queryKey: ["all-plans-for-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && formData.target_type === "specific_plans",
  });

  useEffect(() => {
    if (notification) {
      setFormData({
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        target_type: notification.target_type,
        target_ids: notification.target_ids || [],
        scheduled_at: notification.scheduled_at
          ? new Date(notification.scheduled_at).toISOString().slice(0, 16)
          : "",
        expires_at: notification.expires_at
          ? new Date(notification.expires_at).toISOString().slice(0, 16)
          : "",
        is_active: notification.is_active,
      });
    } else {
      setFormData({
        title: "",
        message: "",
        type: "info",
        priority: "medium",
        target_type: "all_clinics",
        target_ids: [],
        scheduled_at: new Date().toISOString().slice(0, 16),
        expires_at: "",
        is_active: true,
      });
    }
  }, [notification, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        priority: formData.priority,
        target_type: formData.target_type,
        target_ids: formData.target_type === "all_clinics" ? null : formData.target_ids,
        scheduled_at: formData.scheduled_at || new Date().toISOString(),
        expires_at: formData.expires_at || null,
        is_active: formData.is_active,
        created_by: user?.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("system_notifications")
          .update(payload)
          .eq("id", notification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_notifications").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-notifications"] });
      toast({
        title: isEditing ? "Notificação atualizada" : "Notificação criada",
        description: isEditing
          ? "A notificação foi atualizada com sucesso."
          : "A notificação foi criada e será exibida para as clínicas.",
      });
      onClose();
    },
    onError: (error) => {
      console.error("Error saving notification:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a notificação.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e a mensagem.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const toggleTarget = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      target_ids: prev.target_ids.includes(id)
        ? prev.target_ids.filter((t) => t !== id)
        : [...prev.target_ids, id],
    }));
  };

  return (
    <PopupBase open={open} onClose={onClose} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle>
          {isEditing ? "Editar Notificação" : "Nova Notificação"}
        </PopupTitle>
      </PopupHeader>

      <ScrollArea className="max-h-[60vh] pr-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Manutenção programada"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="message">Mensagem *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Descreva a notificação..."
                rows={4}
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ Informação</SelectItem>
                  <SelectItem value="feature">✨ Novidade</SelectItem>
                  <SelectItem value="maintenance">🔧 Manutenção</SelectItem>
                  <SelectItem value="billing">💳 Cobrança</SelectItem>
                  <SelectItem value="alert">⚠️ Alerta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Exibir a partir de</Label>
              <Input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              />
            </div>

            <div>
              <Label>Expira em (opcional)</Label>
              <Input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label>Destino</Label>
              <Select
                value={formData.target_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, target_type: value, target_ids: [] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_clinics">Todas as clínicas</SelectItem>
                  <SelectItem value="specific_clinics">Clínicas específicas</SelectItem>
                  <SelectItem value="specific_plans">Planos específicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.target_type === "specific_clinics" && clinics && (
              <div className="col-span-2">
                <Label>Selecione as clínicas</Label>
                <ScrollArea className="h-40 border rounded-md p-3 mt-1">
                  <div className="space-y-2">
                    {clinics.map((clinic) => (
                      <div key={clinic.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={clinic.id}
                          checked={formData.target_ids.includes(clinic.id)}
                          onCheckedChange={() => toggleTarget(clinic.id)}
                        />
                        <label htmlFor={clinic.id} className="text-sm cursor-pointer">
                          {clinic.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {formData.target_ids.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formData.target_ids.length} clínica(s) selecionada(s)
                  </p>
                )}
              </div>
            )}

            {formData.target_type === "specific_plans" && plans && (
              <div className="col-span-2">
                <Label>Selecione os planos</Label>
                <ScrollArea className="h-40 border rounded-md p-3 mt-1">
                  <div className="space-y-2">
                    {plans.map((plan) => (
                      <div key={plan.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={plan.id}
                          checked={formData.target_ids.includes(plan.id)}
                          onCheckedChange={() => toggleTarget(plan.id)}
                        />
                        <label htmlFor={plan.id} className="text-sm cursor-pointer">
                          {plan.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {formData.target_ids.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formData.target_ids.length} plano(s) selecionado(s)
                  </p>
                )}
              </div>
            )}

            <div className="col-span-2 flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label>Notificação ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Notificações inativas não serão exibidas
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>

          <PopupFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Salvando..."
                : isEditing
                ? "Salvar alterações"
                : "Criar notificação"}
            </Button>
          </PopupFooter>
        </form>
      </ScrollArea>
    </PopupBase>
  );
}
