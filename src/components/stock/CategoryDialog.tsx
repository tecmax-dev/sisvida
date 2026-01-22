import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: any | null;
  clinicId: string;
  onSuccess: () => void;
}

const COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#84CC16", // Lime
  "#6366F1", // Indigo
];

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  clinicId,
  onSuccess,
}: CategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    is_active: true,
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || "",
        description: category.description || "",
        color: category.color || "#3B82F6",
        is_active: category.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "#3B82F6",
        is_active: true,
      });
    }
  }, [category, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;

    setLoading(true);
    try {
      const data = {
        clinic_id: clinicId,
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        is_active: formData.is_active,
      };

      if (category) {
        const { error } = await supabase
          .from("stock_categories")
          .update(data)
          .eq("id", category.id);
        if (error) throw error;
        toast.success("Categoria atualizada com sucesso");
      } else {
        const { error } = await supabase.from("stock_categories").insert(data);
        if (error) throw error;
        toast.success("Categoria criada com sucesso");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar categoria");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="md">
      <PopupHeader>
        <PopupTitle>
          {category ? "Editar Categoria" : "Nova Categoria"}
        </PopupTitle>
      </PopupHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <div>
          <Label>Cor</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full transition-all ${
                  formData.color === color
                    ? "ring-2 ring-offset-2 ring-primary scale-110"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setFormData({ ...formData, color })}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active">Categoria ativa</Label>
        </div>

        <PopupFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </PopupFooter>
      </form>
    </PopupBase>
  );
}
