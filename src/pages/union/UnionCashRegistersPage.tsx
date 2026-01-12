import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { UnionCashRegisterDialog } from "@/components/union/financials/UnionCashRegisterDialog";
import { toast } from "sonner";
import {
  Plus,
  Wallet,
  Building2,
  CreditCard,
  MoreHorizontal,
  Trash2,
  Edit,
  TrendingUp,
  DollarSign,
} from "lucide-react";

const typeLabels: Record<string, string> = {
  cash: "Dinheiro",
  bank: "Conta Bancária",
  credit_card: "Cartão de Crédito",
  investment: "Aplicação",
  other: "Outro",
};

const typeIcons: Record<string, React.ReactNode> = {
  cash: <Wallet className="h-5 w-5" />,
  bank: <Building2 className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  investment: <TrendingUp className="h-5 w-5" />,
  other: <Wallet className="h-5 w-5" />,
};

export default function UnionCashRegistersPage() {
  const { currentClinic } = useAuth();
  const { canManageCashRegisters } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegister, setEditingRegister] = useState<any>(null);

  const clinicId = currentClinic?.id;

  const { data: registers, isLoading } = useQuery({
    queryKey: ["union-cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_cash_registers")
        .select("*")
        .eq("clinic_id", clinicId!)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_cash_registers")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      toast.success("Conta removida!");
    },
    onError: () => {
      toast.error("Erro ao remover conta");
    },
  });

  const handleEdit = (register: any) => {
    setEditingRegister(register);
    setDialogOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const totalBalance = registers?.reduce((sum, r) => sum + Number(r.current_balance || 0), 0) || 0;

  if (!clinicId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contas Bancárias</h1>
        <p className="text-muted-foreground">
          Gerencie as contas e caixas do módulo sindical
        </p>
      </div>

      <div className="flex justify-between items-center">
        <Card className="flex-1 max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Saldo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalBalance)}</p>
            <p className="text-xs text-muted-foreground">{registers?.length || 0} conta(s) ativa(s)</p>
          </CardContent>
        </Card>
        
        {canManageCashRegisters() && (
          <Button onClick={() => {
            setEditingRegister(null);
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {registers?.map((register) => (
          <Card key={register.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                {typeIcons[register.type]}
                <CardTitle className="text-base">{register.name}</CardTitle>
              </div>
              {canManageCashRegisters() && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(register)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(register.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="mb-2">
                {typeLabels[register.type]}
              </Badge>
              {register.bank_name && (
                <p className="text-xs text-muted-foreground">
                  {register.bank_name} - Ag: {register.agency} | CC: {register.account_number}
                </p>
              )}
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(Number(register.current_balance))}
              </p>
            </CardContent>
          </Card>
        ))}

        {(!registers || registers.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma conta cadastrada</p>
              <p className="text-sm">Clique em "Nova Conta" para começar.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <UnionCashRegisterDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingRegister(null);
        }}
        register={editingRegister}
        clinicId={clinicId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
        }}
      />
    </div>
  );
}
