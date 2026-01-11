import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  Banknote,
  CreditCard,
  PiggyBank
} from "lucide-react";

interface CashRegisterBalancesPanelProps {
  clinicId: string;
}

const typeIcons: Record<string, React.ElementType> = {
  caixa: Wallet,
  banco: Building2,
  cartao: CreditCard,
  aplicacao: PiggyBank,
};

const typeLabels: Record<string, string> = {
  caixa: "Caixa",
  banco: "Conta Bancária",
  cartao: "Cartão",
  aplicacao: "Aplicação",
};

export function CashRegisterBalancesPanel({ clinicId }: CashRegisterBalancesPanelProps) {
  const { data: registers, isLoading } = useQuery({
    queryKey: ["cash-register-balances", clinicId],
    queryFn: async () => {
      // Fetch cash registers with transaction totals
      const { data: cashRegisters, error: crError } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (crError) throw crError;

      // For each register, get income and expense totals
      const registersWithTotals = await Promise.all(
        (cashRegisters || []).map(async (cr) => {
          const { data: transactions } = await supabase
            .from("financial_transactions")
            .select("type, amount, status")
            .eq("cash_register_id", cr.id)
            .eq("status", "paid");

          const income = transactions
            ?.filter((t) => t.type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          const expense = transactions
            ?.filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          const calculatedBalance = cr.initial_balance + income - expense;

          return {
            ...cr,
            total_income: income,
            total_expense: expense,
            calculated_balance: calculatedBalance,
          };
        })
      );

      return registersWithTotals;
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  // Calculate totals
  const totals = registers?.reduce(
    (acc, r) => ({
      initial: acc.initial + Number(r.initial_balance || 0),
      current: acc.current + Number(r.current_balance || 0),
      income: acc.income + r.total_income,
      expense: acc.expense + r.total_expense,
    }),
    { initial: 0, current: 0, income: 0, expense: 0 }
  ) || { initial: 0, current: 0, income: 0, expense: 0 };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Saldo por Portador</h3>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de todas as contas e caixas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4 text-slate-500" />
              Saldo Inicial Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-600">
              {formatCurrency(totals.initial)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Total Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals.income)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.expense)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Saldo Atual Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totals.current >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(totals.current)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Cash Registers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {registers?.map((register) => {
          const Icon = typeIcons[register.type] || Wallet;
          const percentUsed = register.total_income > 0
            ? (register.total_expense / register.total_income) * 100
            : 0;

          return (
            <Card key={register.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{register.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {typeLabels[register.type] || register.type}
                      </p>
                    </div>
                  </div>
                  {register.bank_name && (
                    <Badge variant="outline" className="text-xs">
                      {register.bank_name}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Balance */}
                <div className="text-center py-2 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Saldo Atual</p>
                  <p className={`text-2xl font-bold ${Number(register.current_balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(register.current_balance)}
                  </p>
                </div>

                {/* Income vs Expense */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Entradas</span>
                    <span className="text-emerald-600 font-medium">
                      {formatCurrency(register.total_income)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saídas</span>
                    <span className="text-red-600 font-medium">
                      {formatCurrency(register.total_expense)}
                    </span>
                  </div>
                  
                  {/* Progress bar showing expense ratio */}
                  {register.total_income > 0 && (
                    <div className="space-y-1">
                      <Progress 
                        value={Math.min(percentUsed, 100)} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {percentUsed.toFixed(1)}% utilizado
                      </p>
                    </div>
                  )}
                </div>

                {/* Initial Balance */}
                <div className="pt-2 border-t text-sm flex justify-between">
                  <span className="text-muted-foreground">Saldo Inicial</span>
                  <span className="font-medium">
                    {formatCurrency(register.initial_balance)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!registers || registers.length === 0) && (
        <Card className="p-8 text-center text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum portador cadastrado.</p>
          <p className="text-sm">Cadastre contas bancárias e caixas para visualizar os saldos.</p>
        </Card>
      )}
    </div>
  );
}
