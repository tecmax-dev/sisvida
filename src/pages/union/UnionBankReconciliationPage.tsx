import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionReconciliation, BankStatementTransaction } from "@/hooks/useUnionReconciliation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnionOFXImportDialog } from "@/components/union/financials/UnionOFXImportDialog";
import { UnionReconciliationTable } from "@/components/union/financials/UnionReconciliationTable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function UnionBankReconciliationPage() {
  const { currentClinic, session } = useAuth();
  const clinicId = currentClinic?.id;
  const userId = session?.user?.id || "";

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [importTransactions, setImportTransactions] = useState<BankStatementTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const {
    imports,
    loadingImports,
    importOFX,
    isImporting,
    fetchImportTransactions,
    reconcile,
    unreconcile,
    batchReconcileByCheck,
  } = useUnionReconciliation(clinicId);

  // Fetch cash registers
  const { data: cashRegisters } = useQuery({
    queryKey: ["union-cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_cash_registers")
        .select("id, name")
        .eq("clinic_id", clinicId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Load transactions when an import is selected
  useEffect(() => {
    if (selectedImportId) {
      setLoadingTransactions(true);
      fetchImportTransactions(selectedImportId)
        .then(setImportTransactions)
        .catch(console.error)
        .finally(() => setLoadingTransactions(false));
    } else {
      setImportTransactions([]);
    }
  }, [selectedImportId, fetchImportTransactions]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Stats
  const stats = {
    totalImports: imports?.length || 0,
    totalTransactions: imports?.reduce((sum, i) => sum + i.total_transactions, 0) || 0,
    totalReconciled: imports?.reduce((sum, i) => sum + i.transactions_reconciled, 0) || 0,
  };

  if (!clinicId) return null;

  if (loadingImports) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conciliação Bancária</h1>
          <p className="text-muted-foreground">
            Importe extratos OFX e concilie automaticamente as despesas por cheque
          </p>
        </div>
        <Button onClick={() => setImportDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Importar Extrato OFX
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Extratos Importados</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalImports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Total de Transações</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalTransactions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Conciliadas</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.totalReconciled}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="imports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="imports">Extratos Importados</TabsTrigger>
          <TabsTrigger value="transactions" disabled={!selectedImportId}>
            Transações do Extrato
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imports" className="space-y-4">
          {imports?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum extrato importado</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setImportDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Primeiro Extrato
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {imports?.map((imp) => (
                <Card
                  key={imp.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedImportId === imp.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedImportId(imp.id)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{imp.file_name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {imp.bank_name && (
                              <>
                                <Building2 className="h-3 w-3" />
                                <span>{imp.bank_name}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{imp.cash_register?.name}</span>
                            <span>•</span>
                            <span>
                              {format(new Date(imp.imported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm text-emerald-600">
                              {formatCurrency(imp.total_credits)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-rose-500" />
                            <span className="text-sm text-rose-600">
                              {formatCurrency(imp.total_debits)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            className={
                              imp.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : imp.status === "failed"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {imp.status === "completed"
                              ? "Concluído"
                              : imp.status === "failed"
                              ? "Falhou"
                              : "Processando"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {imp.transactions_reconciled}/{imp.total_transactions} conciliadas
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          {loadingTransactions ? (
            <Skeleton className="h-96" />
          ) : (
            <UnionReconciliationTable
              transactions={importTransactions}
              onManualReconcile={(txId) => {
                // TODO: Open manual reconcile dialog
                console.log("Manual reconcile:", txId);
              }}
              onUnreconcile={(txId) => {
                unreconcile({ transactionId: txId, reason: "Removido manualmente", userId });
              }}
              onViewDetails={(tx) => {
                console.log("View details:", tx);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <UnionOFXImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        cashRegisters={cashRegisters || []}
        onImport={importOFX}
        isImporting={isImporting}
        userId={userId}
      />
    </div>
  );
}
