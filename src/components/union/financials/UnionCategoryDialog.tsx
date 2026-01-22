import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UnionCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

const PRESET_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

export function UnionCategoryDialog({
  open,
  onOpenChange,
  clinicId,
}: UnionCategoryDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"income" | "expense">("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["union-financial-categories", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_categories")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: open && !!clinicId,
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, type, color }: { name: string; type: string; color: string }) => {
      const { error } = await supabase.from("union_financial_categories").insert({
        clinic_id: clinicId,
        name,
        type,
        color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-categories"] });
      toast.success("Categoria criada!");
      setNewCategoryName("");
    },
    onError: () => {
      toast.error("Erro ao criar categoria");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_financial_categories")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-categories"] });
      toast.success("Categoria removida!");
    },
    onError: () => {
      toast.error("Erro ao remover categoria");
    },
  });

  const handleCreate = () => {
    if (!newCategoryName.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }
    createMutation.mutate({
      name: newCategoryName.trim(),
      type: activeTab,
      color: selectedColor,
    });
  };

  const incomeCategories = categories?.filter((c) => c.type === "income") || [];
  const expenseCategories = categories?.filter((c) => c.type === "expense") || [];

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle>Gerenciar Categorias Financeiras</PopupTitle>
        <PopupDescription>
          Categorias para classificação de receitas e despesas sindicais
        </PopupDescription>
      </PopupHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "income" | "expense")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="income" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Receitas ({incomeCategories.length})
          </TabsTrigger>
          <TabsTrigger value="expense" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Despesas ({expenseCategories.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 space-y-4">
          {/* Add new category */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Nova Categoria</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={activeTab === "income" ? "Ex: Contribuição Sindical" : "Ex: Despesas Administrativas"}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex gap-1">
              {PRESET_COLORS.slice(0, 5).map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    selectedColor === color ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {/* Categories list */}
          <TabsContent value="income" className="mt-0">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {incomeCategories.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma categoria de receita cadastrada
                  </p>
                ) : (
                  incomeCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color || "#22c55e" }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(category.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="expense" className="mt-0">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {expenseCategories.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma categoria de despesa cadastrada
                  </p>
                ) : (
                  expenseCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color || "#ef4444" }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(category.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>

      <PopupFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
