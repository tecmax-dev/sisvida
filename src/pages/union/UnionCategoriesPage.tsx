import { useState, useEffect, useMemo} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { useUnionFinancialData } from "@/hooks/useUnionFinancialData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Tag,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { KpiCard, CountTabs } from "@/components/design-system";

const PRESET_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

export default function UnionCategoriesPage() {
  const { currentClinic, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { canManageCategories } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"income" | "expense">("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isMigrating, setIsMigrating] = useState(false);

  const clinicId = resolvedClinic?.id;

  // Use the unified hook for data with fallback
  const { 
    categories, 
    categoriesSource, 
    loadingCategories,
    needsMigration,
    migrateData 
  } = useUnionFinancialData(clinicId);

  // Also fetch direct union categories for mutations
  const { data: unionCategories, isLoading, refetch } = useQuery({
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

  // Handle migration
  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const success = await migrateData();
      if (success) {
        refetch();
      }
    } finally {
      setIsMigrating(false);
    }
  };

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

  // Use either union categories or fallback categories
  const displayCategories = unionCategories && unionCategories.length > 0 
    ? unionCategories 
    : categories;

  const incomeCategories = displayCategories?.filter((c: any) => c.type === "income") || [];
  const expenseCategories = displayCategories?.filter((c: any) => c.type === "expense") || [];

  const isUsingFallback = categoriesSource === "clinic" && (!unionCategories || unionCategories.length === 0);

  if (!clinicId) return null;

  if (isLoading && loadingCategories) {
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Tag className="h-5 w-5" /></span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Categorias Financeiras</h1>
          <p className="text-sm text-muted-foreground">Gerencie as categorias de receitas e despesas sindicais.</p>
        </div>
      </div>

      {/* Migration Alert */}
      {isUsingFallback && displayCategories.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Exibindo categorias da clínica vinculada. Clique para importar para o módulo sindical.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMigrate}
              disabled={isMigrating}
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Importar Categorias
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Total" value={(categories?.length || 0).toLocaleString("pt-BR")} hint="categorias cadastradas" icon={Tag} />
        <KpiCard label="Receitas" tone="success" value={incomeCategories.length.toLocaleString("pt-BR")} hint="categorias de receita" icon={TrendingUp} active={activeTab === "income"} onClick={() => setActiveTab("income")} />
        <KpiCard label="Despesas" tone="destructive" value={expenseCategories.length.toLocaleString("pt-BR")} hint="categorias de despesa" icon={TrendingDown} active={activeTab === "expense"} onClick={() => setActiveTab("expense")} />
      </div>

      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "income" | "expense")}>
            <CountTabs
              value={activeTab}
              onChange={(v) => setActiveTab(v)}
              items={[
                { value: "expense", label: "Despesas", count: expenseCategories.length, tone: "destructive" },
                { value: "income", label: "Receitas", count: incomeCategories.length, tone: "success" },
              ]}
            />

            <div className="space-y-4 p-4">
              {/* Add new category */}
              {canManageCategories() && (
                <div className="flex flex-wrap gap-2 items-end rounded-lg border bg-muted/30 p-3">
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
