import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionLegalExpenses } from "@/hooks/useUnionLegal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { Plus, Search, DollarSign, Filter, Loader2, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { expenseTypeLabels } from "@/types/unionLegal";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function UnionLegalExpensesPage() {
  const { currentClinic } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [paidFilter, setPaidFilter] = useState<string>("all");

  const { expenses, isLoading } = useUnionLegalExpenses(currentClinic?.id);

  const filteredExpenses = (expenses || []).filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || e.expense_type === typeFilter;
    const matchesPaid = paidFilter === "all" || 
      (paidFilter === "paid" && e.is_paid) || 
      (paidFilter === "pending" && !e.is_paid);

    return matchesSearch && matchesType && matchesPaid;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  // Stats
  const totalExpenses = (expenses || []).reduce((sum, e) => sum + e.amount, 0);
  const paidExpenses = (expenses || []).filter((e) => e.is_paid).reduce((sum, e) => sum + e.amount, 0);
  const pendingExpenses = totalExpenses - paidExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-emerald-500" />
            Despesas Jurídicas
          </h1>
          <p className="text-muted-foreground">
            Custas, honorários e despesas processuais
          </p>
        </div>
        <Button asChild>
          <Link to="/union/juridico/despesas/nova">
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Despesas</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pagas</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(paidExpenses)}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(pendingExpenses)}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <XCircle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.entries(expenseTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={paidFilter} onValueChange={setPaidFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma despesa encontrada</p>
              <Button asChild className="mt-4">
                <Link to="/union/juridico/despesas/nova">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeira Despesa
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium max-w-[250px]">
                        <span className="truncate block">{expense.description}</span>
                      </TableCell>
                      <TableCell>
                        {expense.legal_case ? (
                          <Link
                            to={`/union/juridico/casos/${expense.legal_case_id}`}
                            className="text-blue-600 hover:underline font-mono text-sm"
                          >
                            {expense.legal_case.case_number}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {expenseTypeLabels[expense.expense_type] || expense.expense_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(expense.expense_date)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={expense.is_paid ? "default" : "secondary"}>
                          {expense.is_paid ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
