import { useState } from "react";
import { useUnionBudget } from "@/hooks/useUnionBudget";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BudgetExercise } from "@/types/unionBudget";

interface BudgetExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
  exercise?: BudgetExercise;
}

const months = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function BudgetExerciseDialog({ open, onOpenChange, clinicId, exercise }: BudgetExerciseDialogProps) {
  const { createExercise, updateExercise, isCreating, isUpdating } = useUnionBudget(clinicId);
  const isEditing = !!exercise;
  
  const [formData, setFormData] = useState({
    name: exercise?.name || "",
    description: exercise?.description || "",
    fiscal_year_start_month: exercise?.fiscal_year_start_month?.toString() || "1",
    fiscal_year_start_day: exercise?.fiscal_year_start_day?.toString() || "1",
    start_date: exercise?.start_date || "",
    end_date: exercise?.end_date || "",
    base_year: exercise?.base_year?.toString() || new Date().getFullYear().toString(),
    growth_rate_revenue: exercise?.growth_rate_revenue?.toString() || "0",
    growth_rate_expense: exercise?.growth_rate_expense?.toString() || "0",
    inflation_rate: exercise?.inflation_rate?.toString() || "0",
    base_member_count: exercise?.base_member_count?.toString() || "",
    projected_member_count: exercise?.projected_member_count?.toString() || "",
    notes: exercise?.notes || "",
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Nome do exercício é obrigatório");
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error("Datas de início e fim são obrigatórias");
      return;
    }

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      fiscal_year_start_month: parseInt(formData.fiscal_year_start_month),
      fiscal_year_start_day: parseInt(formData.fiscal_year_start_day),
      start_date: formData.start_date,
      end_date: formData.end_date,
      base_year: formData.base_year ? parseInt(formData.base_year) : null,
      growth_rate_revenue: formData.growth_rate_revenue ? parseFloat(formData.growth_rate_revenue) : 0,
      growth_rate_expense: formData.growth_rate_expense ? parseFloat(formData.growth_rate_expense) : 0,
      inflation_rate: formData.inflation_rate ? parseFloat(formData.inflation_rate) : 0,
      base_member_count: formData.base_member_count ? parseInt(formData.base_member_count) : null,
      projected_member_count: formData.projected_member_count ? parseInt(formData.projected_member_count) : null,
      notes: formData.notes.trim() || null,
    };

    if (isEditing && exercise) {
      updateExercise({ id: exercise.id, ...data }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createExercise(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Exercício Orçamentário" : "Novo Exercício Orçamentário"}
          </DialogTitle>
          <DialogDescription>
            Configure os parâmetros do exercício orçamentário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Exercício *</Label>
              <Input
                id="name"
                placeholder="Ex: Orçamento 2025"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição detalhada do exercício..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          {/* Fiscal Year Config */}
          <div className="space-y-4">
            <h4 className="font-medium">Configuração do Ano Fiscal</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês de Início</Label>
                <Select
                  value={formData.fiscal_year_start_month}
                  onValueChange={(v) => setFormData({ ...formData, fiscal_year_start_month: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscal_day">Dia de Início</Label>
                <Input
                  id="fiscal_day"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.fiscal_year_start_day}
                  onChange={(e) => setFormData({ ...formData, fiscal_year_start_day: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Period */}
          <div className="space-y-4">
            <h4 className="font-medium">Período do Exercício</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data de Início *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Data de Término *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Projection Parameters */}
          <div className="space-y-4">
            <h4 className="font-medium">Parâmetros de Projeção</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_year">Ano Base</Label>
                <Input
                  id="base_year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={formData.base_year}
                  onChange={(e) => setFormData({ ...formData, base_year: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inflation">Taxa de Inflação (%)</Label>
                <Input
                  id="inflation"
                  type="number"
                  step="0.01"
                  value={formData.inflation_rate}
                  onChange={(e) => setFormData({ ...formData, inflation_rate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="growth_revenue">Crescimento Receitas (%)</Label>
                <Input
                  id="growth_revenue"
                  type="number"
                  step="0.01"
                  value={formData.growth_rate_revenue}
                  onChange={(e) => setFormData({ ...formData, growth_rate_revenue: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="growth_expense">Crescimento Despesas (%)</Label>
                <Input
                  id="growth_expense"
                  type="number"
                  step="0.01"
                  value={formData.growth_rate_expense}
                  onChange={(e) => setFormData({ ...formData, growth_rate_expense: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Member Projections */}
          <div className="space-y-4">
            <h4 className="font-medium">Projeção de Sócios</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_members">Quantidade Base</Label>
                <Input
                  id="base_members"
                  type="number"
                  placeholder="Sócios atuais"
                  value={formData.base_member_count}
                  onChange={(e) => setFormData({ ...formData, base_member_count: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projected_members">Quantidade Projetada</Label>
                <Input
                  id="projected_members"
                  type="number"
                  placeholder="Sócios projetados"
                  value={formData.projected_member_count}
                  onChange={(e) => setFormData({ ...formData, projected_member_count: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
            {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Criar Exercício"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
