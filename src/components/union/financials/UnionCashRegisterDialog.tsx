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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Building2, CreditCard, TrendingUp } from "lucide-react";

interface UnionCashRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register: any | null;
  clinicId: string;
  onSuccess: () => void;
}

const TYPE_OPTIONS = [
  { value: "cash", label: "Dinheiro", icon: Wallet },
  { value: "bank", label: "Conta Bancária", icon: Building2 },
  { value: "credit_card", label: "Cartão de Crédito", icon: CreditCard },
  { value: "investment", label: "Aplicação", icon: TrendingUp },
  { value: "other", label: "Outro", icon: Wallet },
];

export function UnionCashRegisterDialog({
  open,
  onOpenChange,
  register,
  clinicId,
  onSuccess,
}: UnionCashRegisterDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "bank",
    initial_balance: "0",
    bank_name: "",
    agency: "",
    account_number: "",
  });

  useEffect(() => {
    if (register) {
      setFormData({
        name: register.name || "",
        type: register.type || "bank",
        initial_balance: register.initial_balance?.toString() || "0",
        bank_name: register.bank_name || "",
        agency: register.agency || "",
        account_number: register.account_number || "",
      });
    } else {
      setFormData({
        name: "",
        type: "bank",
        initial_balance: "0",
        bank_name: "",
        agency: "",
        account_number: "",
      });
    }
  }, [register, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;

    setLoading(true);
    try {
      const balance = parseFloat(formData.initial_balance.replace(",", ".") || "0");
      
      const data = {
        clinic_id: clinicId,
        name: formData.name,
        type: formData.type,
        initial_balance: balance,
        current_balance: register ? undefined : balance,
        bank_name: formData.bank_name || null,
        agency: formData.agency || null,
        account_number: formData.account_number || null,
      };

      if (register) {
        const { error } = await supabase
          .from("union_cash_registers")
          .update(data)
          .eq("id", register.id);
        if (error) throw error;
        toast.success("Conta atualizada com sucesso");
      } else {
        const { error } = await supabase
          .from("union_cash_registers")
          .insert({ ...data, current_balance: balance });
        if (error) throw error;
        toast.success("Conta criada com sucesso");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar conta");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {register ? "Editar Conta Bancária" : "Nova Conta Bancária"}
          </DialogTitle>
          <DialogDescription>
            Cadastre contas bancárias e caixas para controle financeiro sindical
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Conta *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Conta Principal Sindical"
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type === "bank" && (
              <>
                <div>
                  <Label htmlFor="bank_name">Nome do Banco</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="agency">Agência</Label>
                    <Input
                      id="agency"
                      value={formData.agency}
                      onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                      placeholder="0000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_number">Conta</Label>
                    <Input
                      id="account_number"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder="00000-0"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="initial_balance">Saldo Inicial (R$)</Label>
              <Input
                id="initial_balance"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                placeholder="0,00"
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
  );
}
