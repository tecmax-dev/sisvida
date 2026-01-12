import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Tag,
} from "lucide-react";

const PRESET_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

export default function UnionCategoriesPage() {
  const { currentClinic } = useAuth();
  const { canManageCategories } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"income" | "expense">("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const clinicId = currentClinic?.id;

  const { data: categories, isLoading } = useQuery({
    queryKey: ["union-financial-categories", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_categories")
        .select("*")
        .eq("clinic_id", clinicId!)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
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

  if (!clinicId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Categorias Financeiras</h1>
        <p className="text-muted-foreground">
          Gerencie as categorias de receitas e despesas sindicais
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categories?.length || 0}</p>
            <p className="text-xs text-muted-foreground">categorias cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{incomeCategories.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600">{expenseCategories.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "income" | "expense")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="income" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Receitas ({incomeCategories.length})
              </TabsTrigger>
              <TabsTrigger value="expense" className="gap-2">
                <TrendingDown className="h-4 w-4" />
                Despesas ({expenseCategories.length})
              </TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              {/* Add new category */}
              {canManageCategories() && (
                <div className="flex gap-2 items-end p-4 bg-muted/50 rounded-lg">
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
                    {PRESET_COLORS.map((color) => (
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
              )}

              {/* Categories list */}
              <TabsContent value="income" className="mt-0">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {incomeCategories.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma categoria de receita cadastrada</p>
                        <p className="text-sm">Adicione uma categoria acima.</p>
                      </div>
                    ) : (
                      incomeCategories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-3 bg-background border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: category.color || "#22c55e" }}
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                          {canManageCategories() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(category.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="expense" className="mt-0">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {expenseCategories.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma categoria de despesa cadastrada</p>
                        <p className="text-sm">Adicione uma categoria acima.</p>
                      </div>
                    ) : (
                      expenseCategories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-3 bg-background border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: category.color || "#ef4444" }}
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                          {canManageCategories() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(category.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
