import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Tag, FileText, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplierDefault {
  id: string;
  description: string;
  category_id: string | null;
  default_value: number | null;
  category?: {
    id: string;
    name: string;
    color: string | null;
  };
}

interface UnionSupplierDefaultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  clinicId: string;
}

export function UnionSupplierDefaultsDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  clinicId,
}: UnionSupplierDefaultsDialogProps) {
  const queryClient = useQueryClient();
  const [newDescription, setNewDescription] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch existing defaults for this supplier
  const { data: defaults, isLoading } = useQuery({
    queryKey: ["union-supplier-defaults", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_supplier_defaults")
        .select(`
          id,
          description,
          category_id,
          default_value,
          category:union_financial_categories(id, name, color)
        `)
        .eq("supplier_id", supplierId)
        .eq("is_active", true)
        .order("description");

      if (error) throw error;
      return data as SupplierDefault[];
    },
    enabled: !!supplierId && open,
  });

  // Fetch categories for expense - use same query key as UnionCategoriesPage
  const { data: categories } = useQuery({
    queryKey: ["union-financial-categories", clinicId, "expense"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_categories")
        .select("id, name, color")
        .eq("clinic_id", clinicId)
        .eq("type", "expense")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && open,
  });

  const handleAdd = async () => {
    if (!newDescription.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("union_supplier_defaults").insert({
        clinic_id: clinicId,
        supplier_id: supplierId,
        description: newDescription.trim(),
        category_id: newCategoryId || null,
        default_value: newValue ? parseFloat(newValue.replace(",", ".")) : null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe uma descrição igual para este fornecedor");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Vínculo adicionado!");
      setNewDescription("");
      setNewCategoryId("");
      setNewValue("");
      queryClient.invalidateQueries({ queryKey: ["union-supplier-defaults", supplierId] });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao adicionar vínculo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("union_supplier_defaults")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Vínculo removido");
      queryClient.invalidateQueries({ queryKey: ["union-supplier-defaults", supplierId] });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao remover vínculo");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Vínculos do Fornecedor
        </PopupTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Configure categorias e descrições padrão para <strong>{supplierName}</strong>
        </p>
      </PopupHeader>

      <div className="space-y-4">
        {/* Add new default */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Vínculo
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs">Descrição da Despesa *</Label>
              <Input
                placeholder="Ex: Conta de Energia"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: cat.color || "#6b7280" }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor Padrão</Label>
                <Input
                  placeholder="0,00"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || !newDescription.trim()}
            className="w-full"
          >
            {saving ? "Adicionando..." : "Adicionar Vínculo"}
          </Button>
        </div>

        {/* List existing defaults */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Vínculos Cadastrados
          </h4>
          <ScrollArea className="h-[200px]">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Carregando...</div>
            ) : defaults?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum vínculo cadastrado</p>
                <p className="text-xs">Adicione descrições padrão para agilizar o lançamento</p>
              </div>
            ) : (
              <div className="space-y-2">
                {defaults?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {item.category && (
                          <span className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: item.category.color || "#6b7280" }}
                            />
                            {item.category.name}
                          </span>
                        )}
                        {item.default_value && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(item.default_value)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
