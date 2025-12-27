import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Percent, DollarSign, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RepassRulesPanelProps {
  clinicId: string;
}

interface RepassRule {
  id: string;
  clinic_id: string;
  professional_id: string | null;
  procedure_id: string | null;
  insurance_plan_id: string | null;
  calculation_type: 'percentage' | 'fixed';
  value: number;
  priority: number;
  effective_from: string;
  effective_until: string | null;
  version: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  professional?: { name: string } | null;
  procedure?: { name: string } | null;
  insurance_plan?: { name: string } | null;
}

export function RepassRulesPanel({ clinicId }: RepassRulesPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RepassRule | null>(null);

  const [formData, setFormData] = useState({
    professional_id: "_all",
    procedure_id: "_all",
    insurance_plan_id: "_all",
    calculation_type: "percentage" as 'percentage' | 'fixed',
    value: "",
    priority: "0",
    effective_from: new Date().toISOString().split('T')[0],
    effective_until: "",
    is_active: true,
    notes: "",
  });

  // Fetch rules
  const { data: rules = [], isLoading, isError } = useQuery({
    queryKey: ["repass-rules", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      const { data, error } = await supabase
        .from("medical_repass_rules")
        .select(`
          *,
          professional:professionals(name),
          procedure:procedures(name),
          insurance_plan:insurance_plans(name)
        `)
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .order("priority", { ascending: false });

      if (error) {
        console.error("Error fetching repass rules:", error);
        throw error;
      }
      return data as RepassRule[];
    },
    enabled: !!clinicId,
    retry: 1,
    staleTime: 30000,
  });

  // Fetch professionals
  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch procedures
  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedures")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch insurance plans
  const { data: insurancePlans = [] } = useQuery({
    queryKey: ["insurance-plans", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_plans")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Helper to convert _all to null for database
  const toDbValue = (val: string) => (val === "_all" || val === "" ? null : val);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("medical_repass_rules").insert({
        clinic_id: clinicId,
        professional_id: toDbValue(data.professional_id),
        procedure_id: toDbValue(data.procedure_id),
        insurance_plan_id: toDbValue(data.insurance_plan_id),
        calculation_type: data.calculation_type,
        value: parseFloat(data.value),
        priority: parseInt(data.priority),
        effective_from: data.effective_from,
        effective_until: data.effective_until || null,
        is_active: data.is_active,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repass-rules", clinicId] });
      toast.success("Regra criada com sucesso");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao criar regra");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("medical_repass_rules")
        .update({
          professional_id: toDbValue(data.professional_id),
          procedure_id: toDbValue(data.procedure_id),
          insurance_plan_id: toDbValue(data.insurance_plan_id),
          calculation_type: data.calculation_type,
          value: parseFloat(data.value),
          priority: parseInt(data.priority),
          effective_from: data.effective_from,
          effective_until: data.effective_until || null,
          is_active: data.is_active,
          notes: data.notes || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repass-rules", clinicId] });
      toast.success("Regra atualizada");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao atualizar regra");
    },
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("medical_repass_rules")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repass-rules", clinicId] });
      toast.success("Regra removida");
    },
    onError: () => {
      toast.error("Erro ao remover regra");
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setFormData({
      professional_id: "_all",
      procedure_id: "_all",
      insurance_plan_id: "_all",
      calculation_type: "percentage",
      value: "",
      priority: "0",
      effective_from: new Date().toISOString().split('T')[0],
      effective_until: "",
      is_active: true,
      notes: "",
    });
  };

  const handleEdit = (rule: RepassRule) => {
    setEditingRule(rule);
    setFormData({
      professional_id: rule.professional_id || "_all",
      procedure_id: rule.procedure_id || "_all",
      insurance_plan_id: rule.insurance_plan_id || "_all",
      calculation_type: rule.calculation_type,
      value: rule.value.toString(),
      priority: rule.priority.toString(),
      effective_from: rule.effective_from,
      effective_until: rule.effective_until || "",
      is_active: rule.is_active,
      notes: rule.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate({ ...formData, id: editingRule.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatValue = (rule: RepassRule) => {
    if (rule.calculation_type === 'percentage') {
      return `${rule.value}%`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(rule.value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Regras de Repasse
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma regra de repasse configurada
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      {rule.professional?.name || <span className="text-muted-foreground">Todos</span>}
                    </TableCell>
                    <TableCell>
                      {rule.procedure?.name || <span className="text-muted-foreground">Todos</span>}
                    </TableCell>
                    <TableCell>
                      {rule.insurance_plan?.name || <span className="text-muted-foreground">Todos</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {rule.calculation_type === 'percentage' ? (
                          <><Percent className="h-3 w-3" /> Percentual</>
                        ) : (
                          <><DollarSign className="h-3 w-3" /> Fixo</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatValue(rule)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(rule.effective_from), "dd/MM/yyyy", { locale: ptBR })}
                      {rule.effective_until && (
                        <> até {format(new Date(rule.effective_until), "dd/MM/yyyy", { locale: ptBR })}</>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rule)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regra" : "Nova Regra de Repasse"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Profissional (opcional)</Label>
              <Select
                value={formData.professional_id}
                onValueChange={(value) => setFormData({ ...formData, professional_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os profissionais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos os profissionais</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Procedimento (opcional)</Label>
              <Select
                value={formData.procedure_id}
                onValueChange={(value) => setFormData({ ...formData, procedure_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os procedimentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos os procedimentos</SelectItem>
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Convênio (opcional)</Label>
              <Select
                value={formData.insurance_plan_id}
                onValueChange={(value) => setFormData({ ...formData, insurance_plan_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os convênios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos os convênios</SelectItem>
                  {insurancePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Cálculo</Label>
                <Select
                  value={formData.calculation_type}
                  onValueChange={(value) => setFormData({ ...formData, calculation_type: value as 'percentage' | 'fixed' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step={formData.calculation_type === 'percentage' ? "0.01" : "0.01"}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.calculation_type === 'percentage' ? "Ex: 30" : "Ex: 100.00"}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vigência Início</Label>
                <Input
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Vigência Fim (opcional)</Label>
                <Input
                  type="date"
                  value={formData.effective_until}
                  onChange={(e) => setFormData({ ...formData, effective_until: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Regra ativa</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingRule ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
