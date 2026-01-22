import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  type: "entry" | "exit";
  suppliers: { id: string; name: string }[];
  clinicId: string;
  onSuccess: () => void;
}

const ENTRY_REASONS = [
  { value: "purchase", label: "Compra" },
  { value: "return", label: "Devolução" },
  { value: "donation", label: "Doação" },
  { value: "transfer_in", label: "Transferência (entrada)" },
  { value: "adjustment", label: "Ajuste de inventário" },
  { value: "other", label: "Outro" },
];

const EXIT_REASONS = [
  { value: "consumption", label: "Consumo" },
  { value: "sale", label: "Venda" },
  { value: "loss", label: "Perda / Avaria" },
  { value: "expired", label: "Vencido" },
  { value: "transfer_out", label: "Transferência (saída)" },
  { value: "adjustment", label: "Ajuste de inventário" },
  { value: "other", label: "Outro" },
];

export function MovementDialog({
  open,
  onOpenChange,
  product,
  type,
  suppliers,
  clinicId,
  onSuccess,
}: MovementDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: 1,
    reason: "",
    supplier_id: "",
    unit_cost: 0,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        quantity: 1,
        reason: type === "entry" ? "purchase" : "consumption",
        supplier_id: product?.supplier?.id || "",
        unit_cost: product?.cost_price || 0,
        notes: "",
      });
    }
  }, [open, type, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !product) return;

    if (formData.quantity <= 0) {
      toast.error("A quantidade deve ser maior que zero");
      return;
    }

    if (type === "exit" && formData.quantity > product.current_stock) {
      toast.error("Quantidade maior que o estoque disponível");
      return;
    }

    setLoading(true);
    try {
      const newStock =
        type === "entry"
          ? product.current_stock + formData.quantity
          : product.current_stock - formData.quantity;

      // Insert movement
      const movementData = {
        clinic_id: clinicId,
        product_id: product.id,
        type: type === "entry" ? "entry" : "exit",
        quantity: formData.quantity,
        previous_stock: product.current_stock,
        new_stock: newStock,
        unit_cost: type === "entry" ? formData.unit_cost : product.cost_price,
        total_cost: formData.quantity * (type === "entry" ? formData.unit_cost : product.cost_price),
        reason: formData.reason,
        supplier_id: formData.supplier_id || null,
        notes: formData.notes || null,
        created_by: user?.id || null,
      };

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert(movementData);

      if (movementError) throw movementError;

      // Update product stock
      const updateData: any = { current_stock: newStock };
      
      // Update cost price on entry if provided
      if (type === "entry" && formData.unit_cost > 0) {
        updateData.cost_price = formData.unit_cost;
      }

      const { error: updateError } = await supabase
        .from("stock_products")
        .update(updateData)
        .eq("id", product.id);

      if (updateError) throw updateError;

      toast.success(
        type === "entry" ? "Entrada registrada com sucesso" : "Saída registrada com sucesso"
      );
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao registrar movimentação");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const reasons = type === "entry" ? ENTRY_REASONS : EXIT_REASONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "entry" ? (
              <>
                <ArrowDownCircle className="h-5 w-5 text-green-600" />
                Entrada de Estoque
              </>
            ) : (
              <>
                <ArrowUpCircle className="h-5 w-5 text-red-600" />
                Saída de Estoque
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {product && (
          <div className="bg-muted rounded-lg p-3 mb-4">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              Estoque atual: {product.current_stock} {product.unit}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="quantity">Quantidade *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="reason">Motivo *</Label>
            <Select
              value={formData.reason}
              onValueChange={(value) => setFormData({ ...formData, reason: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "entry" && (
            <>
              <div>
                <Label htmlFor="supplier">Fornecedor</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit_cost">Custo Unitário (R$)</Label>
                <Input
                  id="unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={type === "entry" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {loading ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
