import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { UnionSupplierCombobox } from "./UnionSupplierCombobox";
import { UnionSupplierDialog } from "./UnionSupplierDialog";

interface UnionTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: any | null;
  clinicId: string;
  defaultType?: "income" | "expense";
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "check", label: "Cheque" },
  { value: "boleto", label: "Boleto" },
];

export function UnionTransactionDialog({
  open,
  onOpenChange,
  transaction,
  clinicId,
  defaultType = "expense",
  onSuccess,
}: UnionTransactionDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [paidDate, setPaidDate] = useState<Date | undefined>();
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category_id: "",
    cash_register_id: "",
    supplier_id: "",
    payment_method: "pix",
    status: "pending",
    notes: "",
    document_number: "",
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["union-financial-categories", clinicId, type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_categories")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("type", type)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: open && !!clinicId,
  });

  // Fetch cash registers
  const { data: cashRegisters } = useQuery({
    queryKey: ["union-cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: open && !!clinicId,
  });

  // Supplier refresh handler
  const handleSupplierCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["union-suppliers", clinicId] });
    setSupplierDialogOpen(false);
  };

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setFormData({
        description: transaction.description || "",
        amount: transaction.amount?.toString() || "",
        category_id: transaction.category_id || "",
        cash_register_id: transaction.cash_register_id || "",
        supplier_id: transaction.supplier_id || "",
        payment_method: transaction.payment_method || "pix",
        status: transaction.status || "pending",
        notes: transaction.notes || "",
        document_number: transaction.document_number || "",
      });
      setDueDate(transaction.due_date ? new Date(transaction.due_date) : new Date());
      setPaidDate(transaction.paid_date ? new Date(transaction.paid_date) : undefined);
    } else {
      setType(defaultType);
      setFormData({
        description: "",
        amount: "",
        category_id: "",
        cash_register_id: "",
        supplier_id: "",
        payment_method: "pix",
        status: "pending",
        notes: "",
        document_number: "",
      });
      setDueDate(new Date());
      setPaidDate(undefined);
    }
  }, [transaction, open, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;

    if (!formData.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    const amount = parseFloat(formData.amount.replace(",", ".") || "0");
    if (amount <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);
    try {
      const data = {
        clinic_id: clinicId,
        type,
        description: formData.description,
        amount,
        category_id: formData.category_id || null,
        cash_register_id: formData.cash_register_id || null,
        supplier_id: type === "expense" ? (formData.supplier_id || null) : null,
        payment_method: formData.payment_method,
        status: formData.status,
        notes: formData.notes || null,
        document_number: formData.document_number || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        paid_date: paidDate ? format(paidDate, "yyyy-MM-dd") : null,
      };

      if (transaction) {
        const { error } = await supabase
          .from("union_financial_transactions")
          .update(data)
          .eq("id", transaction.id);
        if (error) throw error;
        toast.success("Transação atualizada!");
      } else {
        const { error } = await supabase.from("union_financial_transactions").insert(data);
        if (error) throw error;
        toast.success(type === "income" ? "Receita lançada!" : "Despesa lançada!");
      }

      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar transação");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar Transação" : type === "income" ? "Nova Receita" : "Nova Despesa"}
          </DialogTitle>
          <DialogDescription>
            Lance {type === "income" ? "receitas" : "despesas"} do módulo sindical
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!transaction && (
            <Tabs value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="income" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Receita
                </TabsTrigger>
                <TabsTrigger value="expense" className="gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Despesa
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={type === "income" ? "Ex: Mensalidade Sindical" : "Ex: Material de Escritório"}
                required
              />
            </div>

            <div>
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <Label>Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Categoria</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color || "#6b7280" }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Conta Bancária</Label>
              <Select
                value={formData.cash_register_id}
                onValueChange={(value) => setFormData({ ...formData, cash_register_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {cashRegisters?.map((register) => (
                    <SelectItem key={register.id} value={register.id}>
                      {register.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === "expense" && (
              <div>
                <Label>Fornecedor</Label>
                <UnionSupplierCombobox
                  value={formData.supplier_id}
                  onChange={(value) => setFormData({ ...formData, supplier_id: value })}
                  clinicId={clinicId}
                  placeholder="Buscar fornecedor..."
                  onAddNew={() => setSupplierDialogOpen(true)}
                />
              </div>
            )}

            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.status === "paid" && (
              <div>
                <Label>Data do Pagamento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !paidDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paidDate ? format(paidDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paidDate}
                      onSelect={setPaidDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div>
              <Label htmlFor="document_number">Nº do Documento</Label>
              <Input
                id="document_number"
                value={formData.document_number}
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
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

    {/* Dialog para novo fornecedor */}
    <UnionSupplierDialog
      open={supplierDialogOpen}
      onOpenChange={setSupplierDialogOpen}
      supplier={null}
      clinicId={clinicId}
      onSuccess={handleSupplierCreated}
    />
  </>
  );
}
