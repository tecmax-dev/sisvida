import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Procedure {
  id: string;
  name: string;
}

interface PackageTemplate {
  id: string;
  name: string;
  description: string | null;
  procedure_id: string | null;
  total_sessions: number;
  price: number;
  validity_days: number | null;
  is_active: boolean;
}

interface PackageTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PackageTemplate | null;
  onSuccess: () => void;
}

export function PackageTemplateDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: PackageTemplateDialogProps) {
  const { currentClinic } = useAuth();
  const [loading, setLoading] = useState(false);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    procedure_id: "",
    total_sessions: 1,
    price: 0,
    validity_days: "",
    is_active: true,
  });

  useEffect(() => {
    if (open && currentClinic?.id) {
      fetchProcedures();
    }
  }, [open, currentClinic?.id]);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || "",
        procedure_id: template.procedure_id || "",
        total_sessions: template.total_sessions,
        price: template.price,
        validity_days: template.validity_days?.toString() || "",
        is_active: template.is_active,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        procedure_id: "",
        total_sessions: 1,
        price: 0,
        validity_days: "",
        is_active: true,
      });
    }
  }, [template, open]);

  const fetchProcedures = async () => {
    if (!currentClinic?.id) return;

    const { data, error } = await supabase
      .from("procedures")
      .select("id, name")
      .eq("clinic_id", currentClinic.id)
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setProcedures(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClinic?.id) return;

    setLoading(true);

    try {
      const payload = {
        clinic_id: currentClinic.id,
        name: formData.name,
        description: formData.description || null,
        procedure_id: formData.procedure_id || null,
        total_sessions: formData.total_sessions,
        price: formData.price,
        validity_days: formData.validity_days ? parseInt(formData.validity_days) : null,
        is_active: formData.is_active,
      };

      if (template) {
        const { error } = await supabase
          .from("package_templates")
          .update(payload)
          .eq("id", template.id);

        if (error) throw error;
        toast.success("Modelo atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("package_templates")
          .insert(payload);

        if (error) throw error;
        toast.success("Modelo criado com sucesso");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Erro ao salvar modelo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar Modelo de Pacote" : "Novo Modelo de Pacote"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Pacote *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Pacote 10 Sessões Fisioterapia"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição opcional do pacote"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="procedure">Procedimento Vinculado</Label>
            <Select
              value={formData.procedure_id || "any"}
              onValueChange={(value) =>
                setFormData({ ...formData, procedure_id: value === "any" ? "" : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer procedimento</SelectItem>
                {procedures.map((proc) => (
                  <SelectItem key={proc.id} value={proc.id}>
                    {proc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se vinculado, sessões só serão consumidas em consultas deste procedimento
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_sessions">Nº de Sessões *</Label>
              <Input
                id="total_sessions"
                type="number"
                min="1"
                value={formData.total_sessions}
                onChange={(e) => setFormData({ ...formData, total_sessions: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Valor Total (R$) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="validity_days">Validade (dias)</Label>
            <Input
              id="validity_days"
              type="number"
              min="1"
              value={formData.validity_days}
              onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
              placeholder="Deixe vazio para sem validade"
            />
            <p className="text-xs text-muted-foreground">
              Tempo máximo para usar todas as sessões após a compra
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Modelo Ativo</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {template ? "Salvar" : "Criar Modelo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
