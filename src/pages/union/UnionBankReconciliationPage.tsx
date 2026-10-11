import { useState, useMemo} from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionReconciliation, BankStatementTransaction } from "@/hooks/useUnionReconciliation";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnionOFXImportDialog } from "@/components/union/financials/UnionOFXImportDialog";
import { UnionReconciliationTable } from "@/components/union/financials/UnionReconciliationTable";
import { UnionTransactionDetailsDialog } from "@/components/union/financials/UnionTransactionDetailsDialog";
import { UnionManualReconcileDialog } from "@/components/union/financials/UnionManualReconcileDialog";
import { UnionGenerateEntryDialog } from "@/components/union/financials/UnionGenerateEntryDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
  Trash2,
} from "lucide-react";

export default function UnionBankReconciliationPage() {
  const { currentClinic, session, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const clinicId = resolvedClinic?.id;
  const userId = session?.user?.id || "";

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("imports");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importToDelete, setImportToDelete] = useState<{ id: string; name: string } | null>(null);
  const [detailsTx, setDetailsTx] = useState<BankStatementTransaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reconcileTx, setReconcileTx] = useState<BankStatementTransaction | null>(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [generateEntryTxs, setGenerateEntryTxs] = useState<BankStatementTransaction[]>([]);
  const [generateEntryOpen, setGenerateEntryOpen] = useState(false);

  const {
    imports,
    loadingImports,
    importOFX,
    isImporting,
    fetchImportTransactions,
    reconcile,
    isReconciling,
    unreconcile,
    isUnreconciling,
    pendingExpenses,
    pendingIncomes,
    pendingTransfers,
    markVerified,
    isMarkingVerified,
    deleteImport,
    isDeletingImport,
    generateEntryFromOFX,
    isGeneratingEntry,
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

  const {
    data: selectedImportTransactions = [],
    isLoading: loadingSelectedImportTransactions,
  } = useQuery({
    queryKey: ["union-bank-statement-transactions", selectedImportId],
    queryFn: () => fetchImportTransactions(selectedImportId!),
    enabled: !!selectedImportId,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const stats = {
    totalImports: imports?.length || 0,
    totalTransactions: imports?.reduce((sum, i) => sum + i.total_transactions, 0) || 0,
    totalReconciled: imports?.reduce((sum, i) => sum + i.transactions_reconciled, 0) || 0,
  };

  if (!clinicId) return null;

  if (loadingImports) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground">Conciliação Bancária</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Importe extratos OFX, concilie e gere lançamentos financeiros automaticamente
          </p>
        </div>
        <Button onClick={() => setImportDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Importar Extrato OFX
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Extratos Importados</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalImports}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Total de Transações</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalTransactions}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Conciliadas</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.totalReconciled}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                  onClick={() => { setSelectedImportId(imp.id); setActiveTab("transactions"); }}
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
                        {imp.transactions_reconciled === 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImportToDelete({ id: imp.id, name: imp.file_name });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          {loadingSelectedImportTransactions ? (
            <Skeleton className="h-96" />
          ) : (
            <UnionReconciliationTable
              transactions={selectedImportTransactions}
              onManualReconcile={(txId) => {
                const tx = selectedImportTransactions.find((t) => t.id === txId) || null;
                setReconcileTx(tx);
                setReconcileOpen(true);
              }}
              onUndoReconciliation={(txIds) => {
                unreconcile({ statementTransactionIds: txIds, reason: "Desfeito manualmente", userId });
              }}
              isUndoing={isUnreconciling}
              onViewDetails={(tx) => {
                setDetailsTx(tx);
                setDetailsOpen(true);
              }}
              onMarkVerified={(txId) => {
                markVerified({ statementTransactionId: txId, userId });
              }}
              onGenerateEntry={(tx) => {
                setGenerateEntryTxs([tx]);
                setGenerateEntryOpen(true);
              }}
              onBatchGenerateEntry={(txs) => {
                setGenerateEntryTxs(txs);
                setGenerateEntryOpen(true);
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Extrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o extrato <strong>{importToDelete?.name}</strong>? 
              Todas as transações importadas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingImport}
              onClick={async () => {
                if (importToDelete) {
                  await deleteImport({ importId: importToDelete.id });
                  if (selectedImportId === importToDelete.id) {
                    setSelectedImportId(null);
                    setActiveTab("imports");
                  }
                  setImportToDelete(null);
                }
              }}
            >
              {isDeletingImport ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnionTransactionDetailsDialog
        transaction={detailsTx}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <UnionManualReconcileDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        statementTransaction={reconcileTx}
        pendingExpenses={
          reconcileTx?.transaction_type === "credit"
            ? (pendingIncomes || [])
            : (pendingExpenses || [])
        }
        pendingTransfers={pendingTransfers || []}
        cashRegisterName={
          reconcileTx
            ? cashRegisters?.find((cr) => cr.id === reconcileTx.cash_register_id)?.name
            : undefined
        }
        cashRegisters={cashRegisters || []}
        onReconcile={async (stmtId, finIds, notes) => {
          await reconcile({
            statementTransactionId: stmtId,
            financialTransactionIds: finIds,
            userId,
            notes,
          });
          setReconcileOpen(false);
        }}
        isReconciling={isReconciling}
      />

      {clinicId && (
        <UnionGenerateEntryDialog
          open={generateEntryOpen}
          onOpenChange={setGenerateEntryOpen}
          transactions={generateEntryTxs}
          clinicId={clinicId}
          onGenerate={async (entries) => {
            await generateEntryFromOFX({ entries, userId });
          }}
          isGenerating={isGeneratingEntry}
        />
      )}
    </div>
  );
}
