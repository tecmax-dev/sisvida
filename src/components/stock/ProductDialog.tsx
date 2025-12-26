import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  clinicId: string;
  onSuccess: () => void;
}

const UNITS = [
  { value: "un", label: "Unidade" },
  { value: "cx", label: "Caixa" },
  { value: "pct", label: "Pacote" },
  { value: "kg", label: "Quilograma" },
  { value: "g", label: "Grama" },
  { value: "l", label: "Litro" },
  { value: "ml", label: "Mililitro" },
  { value: "m", label: "Metro" },
  { value: "cm", label: "Centímetro" },
  { value: "par", label: "Par" },
  { value: "amp", label: "Ampola" },
  { value: "fr", label: "Frasco" },
  { value: "tb", label: "Tubo" },
  { value: "env", label: "Envelope" },
];

export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
  suppliers,
  clinicId,
  onSuccess,
}: ProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    unit: "un",
    current_stock: 0,
    min_stock: 0,
    max_stock: "",
    cost_price: 0,
    sale_price: 0,
    location: "",
    expiry_date: "",
    batch_number: "",
    category_id: "",
    supplier_id: "",
    is_active: true,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        description: product.description || "",
        unit: product.unit || "un",
        current_stock: product.current_stock || 0,
        min_stock: product.min_stock || 0,
        max_stock: product.max_stock?.toString() || "",
        cost_price: product.cost_price || 0,
        sale_price: product.sale_price || 0,
        location: product.location || "",
        expiry_date: product.expiry_date || "",
        batch_number: product.batch_number || "",
        category_id: product.category?.id || "",
        supplier_id: product.supplier?.id || "",
        is_active: product.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        description: "",
        unit: "un",
        current_stock: 0,
        min_stock: 0,
        max_stock: "",
        cost_price: 0,
        sale_price: 0,
        location: "",
        expiry_date: "",
        batch_number: "",
        category_id: "",
        supplier_id: "",
        is_active: true,
      });
    }
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;

    setLoading(true);
    try {
      const data = {
        clinic_id: clinicId,
        name: formData.name,
        sku: formData.sku || null,
        description: formData.description || null,
        unit: formData.unit,
        current_stock: formData.current_stock,
        min_stock: formData.min_stock,
        max_stock: formData.max_stock ? parseFloat(formData.max_stock) : null,
        cost_price: formData.cost_price,
        sale_price: formData.sale_price,
        location: formData.location || null,
        expiry_date: formData.expiry_date || null,
        batch_number: formData.batch_number || null,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        is_active: formData.is_active,
      };

      if (product) {
        const { error } = await supabase
          .from("stock_products")
          .update(data)
          .eq("id", product.id);
        if (error) throw error;
        toast.success("Produto atualizado com sucesso");
      } else {
        const { error } = await supabase.from("stock_products").insert(data);
        if (error) throw error;
        toast.success("Produto criado com sucesso");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar produto");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="sku">SKU / Código</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="unit">Unidade</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Label htmlFor="current_stock">Estoque Atual</Label>
              <Input
                id="current_stock"
                type="number"
                step="0.01"
                value={formData.current_stock}
                onChange={(e) =>
                  setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label htmlFor="min_stock">Estoque Mínimo</Label>
              <Input
                id="min_stock"
                type="number"
                step="0.01"
                value={formData.min_stock}
                onChange={(e) =>
                  setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label htmlFor="max_stock">Estoque Máximo</Label>
              <Input
                id="max_stock"
                type="number"
                step="0.01"
                value={formData.max_stock}
                onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div>
              <Label htmlFor="cost_price">Preço de Custo (R$)</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) =>
                  setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label htmlFor="sale_price">Preço de Venda (R$)</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.sale_price}
                onChange={(e) =>
                  setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: Armário A, Prateleira 2"
              />
            </div>

            <div>
              <Label htmlFor="expiry_date">Data de Validade</Label>
              <Input
                id="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="batch_number">Lote</Label>
              <Input
                id="batch_number"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Produto ativo</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
