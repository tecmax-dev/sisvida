import { useState, useMemo} from "react";
import { formatDateBR } from "@/lib/date";
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
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
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
  Landmark,
  MoreVertical,
} from "lucide-react";
import { KpiCard, StatusBadge } from "@/components/design-system";

const typeLabels: Record<string, string> = {
  cash: "Dinheiro",
  bank: "Conta Bancária",
  bank_account: "Conta Bancária",
  credit_card: "Cartão de Crédito",
  investment: "Aplicação",
  other: "Outro",
};

const typeIcons: Record<string, React.ReactNode> = {
  cash: <Wallet className="h-5 w-5" />,
  bank: <Building2 className="h-5 w-5" />,
  bank_account: <Building2 className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  investment: <TrendingUp className="h-5 w-5" />,
  other: <Wallet className="h-5 w-5" />,
};

export default function UnionCashRegistersPage() {
  const { currentClinic, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { canManageCashRegisters } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegister, setEditingRegister] = useState<any>(null);

  const clinicId = resolvedClinic?.id;

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

  const countByType = (types: string[]) => registers?.filter((r) => types.includes(r.type)).length || 0;
  const sumByType = (types: string[]) => registers?.filter((r) => types.includes(r.type)).reduce((s, r) => s + Number(r.current_balance || 0), 0) || 0;
  const bankTypes = ["bank", "bank_account"];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Landmark className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Contas Bancárias</h1>
            <p className="text-sm text-muted-foreground">Gerencie as contas e caixas do módulo sindical.</p>
          </div>
        </div>
        {canManageCashRegisters() && (
          <Button size="sm" className="h-9" onClick={() => { setEditingRegister(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Nova Conta
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Saldo total" tone="primary" value={formatCurrency(totalBalance)} hint={`${registers?.length || 0} conta(s) ativa(s)`} icon={DollarSign} />
        <KpiCard label="Contas bancárias" value={formatCurrency(sumByType(bankTypes))} hint={`${countByType(bankTypes)} conta(s)`} icon={Building2} />
        <KpiCard label="Caixa (dinheiro)" tone="success" value={formatCurrency(sumByType(["cash"]))} hint={`${countByType(["cash"])} caixa(s)`} icon={Wallet} />
        <KpiCard label="Aplicações e outros" value={formatCurrency(sumByType(["investment", "credit_card", "other"]))} hint={`${countByType(["investment", "credit_card", "other"])} conta(s)`} icon={TrendingUp} />
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Conta</th>
                <th className="px-3 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5 font-medium">Banco / Agência / Conta</th>
                <th className="px-3 py-2.5 font-medium">Saldo inicial</th>
                <th className="px-3 py-2.5 text-right font-medium">Saldo atual</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {registers?.map((register) => (
                <tr key={register.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:h-4 [&_svg]:w-4">{typeIcons[register.type] ?? <Wallet />}</span>
                      <span className="font-medium text-foreground">{register.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge tone="primary">{typeLabels[register.type] ?? register.type}</StatusBadge></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {register.bank_name ? `${register.bank_name} · Ag ${register.agency || "—"} · CC ${register.account_number || "—"}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {register.initial_balance_date ? `${formatCurrency(Number(register.initial_balance))} em ${formatDateBR(register.initial_balance_date)}` : "—"}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${Number(register.current_balance) < 0 ? "text-destructive" : "text-foreground"}`}>
                    {formatCurrency(Number(register.current_balance))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canManageCashRegisters() && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(register)}><Edit className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(register.id)}><Trash2 className="h-4 w-4 mr-2" />Remover</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
              {(!registers || registers.length === 0) && (
                <tr><td colSpan={6} className="py-14 text-center text-muted-foreground">
                  <Wallet className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="font-medium">Nenhuma conta cadastrada</p>
                  <p className="text-sm">Clique em "Nova Conta" para começar.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
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
