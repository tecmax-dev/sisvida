import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BankStatementImport {
  id: string;
  clinic_id: string;
  cash_register_id: string;
  file_name: string;
  file_hash: string;
  bank_code: string | null;
  bank_name: string | null;
  account_number: string | null;
  agency: string | null;
  statement_start_date: string | null;
  statement_end_date: string | null;
  total_transactions: number;
  total_credits: number;
  total_debits: number;
  transactions_reconciled: number;
  status: "pending" | "processing" | "completed" | "failed";
  imported_by: string | null;
  imported_at: string;
  created_at: string;
  cash_register?: { id: string; name: string };
}

export interface BankStatementTransaction {
  id: string;
  import_id: string;
  clinic_id: string;
  cash_register_id: string;
  fitid: string | null;
  transaction_date: string;
  amount: number;
  transaction_type: "credit" | "debit";
  description: string | null;
  check_number: string | null;
  document_number: string | null;
  reconciliation_status: "auto_reconciled" | "manual_reconciled" | "pending_review" | "not_identified" | "ignored";
  matched_transaction_id: string | null;
  reconciled_by: string | null;
  reconciled_at: string | null;
  reconciliation_notes: string | null;
  created_at: string;
  matched_transaction?: {
    id: string;
    description: string;
    amount: number;
    status: string;
    check_number: string | null;
  };
}

export interface OFXTransaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  type: "credit" | "debit";
  fitid: string;
  checkNumber: string | null;
}

// Hash function for file deduplication
async function hashFile(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// OFX Parser
function extractField(block: string, fieldName: string): string | null {
  const regex = new RegExp(`<${fieldName}>([^<\\n\\r]+)`, "i");
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

export function parseOFX(content: string): {
  transactions: OFXTransaction[];
  bankInfo: {
    bankCode: string | null;
    bankName: string | null;
    accountNumber: string | null;
    agency: string | null;
    startDate: Date | null;
    endDate: Date | null;
  };
} {
  const transactions: OFXTransaction[] = [];

  const ofxStart = content.indexOf("<OFX>");
  if (ofxStart === -1) {
    throw new Error("Arquivo OFX inválido: tag <OFX> não encontrada");
  }

  const ofxContent = content.substring(ofxStart);

  // Extract bank info
  const bankId = extractField(ofxContent, "BANKID");
  const acctId = extractField(ofxContent, "ACCTID");
  const branchId = extractField(ofxContent, "BRANCHID");
  const org = extractField(ofxContent, "ORG");

  // Extract date range
  const dtStart = extractField(ofxContent, "DTSTART");
  const dtEnd = extractField(ofxContent, "DTEND");

  const parseOFXDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    const d = dateStr.substring(0, 8);
    return new Date(
      parseInt(d.substring(0, 4)),
      parseInt(d.substring(4, 6)) - 1,
      parseInt(d.substring(6, 8))
    );
  };

  // Find all STMTTRN blocks
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmttrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];

    const dtposted = extractField(block, "DTPOSTED");
    const trnamt = extractField(block, "TRNAMT");
    const fitid = extractField(block, "FITID");
    const memo = extractField(block, "MEMO") || extractField(block, "NAME") || "";
    const checknum = extractField(block, "CHECKNUM");

    if (dtposted && trnamt) {
      const dateStr = dtposted.substring(0, 8);
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const date = new Date(year, month, day);

      const amount = parseFloat(trnamt.replace(",", "."));

      transactions.push({
        id: fitid || `${dateStr}-${Math.random().toString(36).substr(2, 9)}`,
        date,
        amount: Math.abs(amount),
        description: memo.trim(),
        type: amount >= 0 ? "credit" : "debit",
        fitid: fitid || "",
        checkNumber: checknum,
      });
    }
  }

  return {
    transactions: transactions.sort((a, b) => b.date.getTime() - a.date.getTime()),
    bankInfo: {
      bankCode: bankId,
      bankName: org,
      accountNumber: acctId,
      agency: branchId,
      startDate: parseOFXDate(dtStart),
      endDate: parseOFXDate(dtEnd),
    },
  };
}

// Normalize check number for comparison
export function normalizeCheckNumber(checkNum: string | null | undefined): string | null {
  if (!checkNum) return null;
  return checkNum.replace(/[^0-9]/g, "").replace(/^0+/, "") || null;
}

export function useUnionReconciliation(clinicId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch all statement imports using raw SQL approach
  const {
    data: imports,
    isLoading: loadingImports,
    refetch: refetchImports,
  } = useQuery({
    queryKey: ["union-bank-statement-imports", clinicId],
    queryFn: async () => {
      // Use from with explicit type casting
      const { data, error } = await (supabase as any)
        .from("union_bank_statement_imports")
        .select(`
          *,
          cash_register:union_cash_registers(id, name)
        `)
        .eq("clinic_id", clinicId!)
        .order("imported_at", { ascending: false });
      if (error) throw error;
      return data as BankStatementImport[];
    },
    enabled: !!clinicId,
  });

  // Fetch statement transactions for a specific import
  const fetchImportTransactions = async (importId: string): Promise<BankStatementTransaction[]> => {
    const { data, error } = await (supabase as any)
      .from("union_bank_statement_transactions")
      .select(`
        *,
        matched_transaction:union_financial_transactions(id, description, amount, status, check_number)
      `)
      .eq("import_id", importId)
      .order("transaction_date", { ascending: false });
    if (error) throw error;
    return data as BankStatementTransaction[];
  };

  // Fetch pending (unreconciled) expenses for matching
  const { data: pendingExpenses } = useQuery({
    queryKey: ["union-pending-expenses-reconciliation", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_transactions")
        .select("id, description, amount, status, check_number, payment_method, due_date, paid_date, cash_register_id, type")
        .eq("clinic_id", clinicId!)
        .eq("type", "expense")
        .eq("is_conciliated", false)
        .in("status", ["paid", "pending"])
        .order("due_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Import OFX file
  const importOFXMutation = useMutation({
    mutationFn: async ({
      fileContent,
      fileName,
      cashRegisterId,
      userId,
    }: {
      fileContent: string;
      fileName: string;
      cashRegisterId: string;
      userId: string;
    }) => {
      // Parse OFX
      const { transactions, bankInfo } = parseOFX(fileContent);

      if (transactions.length === 0) {
        throw new Error("Nenhuma transação encontrada no arquivo OFX");
      }

      // Calculate file hash
      const fileHash = await hashFile(fileContent);

      // Check for duplicate import
      const { data: existing } = await (supabase as any)
        .from("union_bank_statement_imports")
        .select("id")
        .eq("clinic_id", clinicId!)
        .eq("file_hash", fileHash)
        .maybeSingle();

      if (existing) {
        throw new Error("Este extrato já foi importado anteriormente");
      }

      // Calculate totals
      const totalCredits = transactions
        .filter((t) => t.type === "credit")
        .reduce((sum, t) => sum + t.amount, 0);
      const totalDebits = transactions
        .filter((t) => t.type === "debit")
        .reduce((sum, t) => sum + t.amount, 0);

      // Create import record
      const { data: importRecord, error: importError } = await (supabase as any)
        .from("union_bank_statement_imports")
        .insert({
          clinic_id: clinicId,
          cash_register_id: cashRegisterId,
          file_name: fileName,
          file_hash: fileHash,
          bank_code: bankInfo.bankCode,
          bank_name: bankInfo.bankName,
          account_number: bankInfo.accountNumber,
          agency: bankInfo.agency,
          statement_start_date: bankInfo.startDate?.toISOString().split("T")[0],
          statement_end_date: bankInfo.endDate?.toISOString().split("T")[0],
          total_transactions: transactions.length,
          total_credits: totalCredits,
          total_debits: totalDebits,
          status: "processing",
          imported_by: userId,
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert transactions and attempt auto-matching
      let autoReconciled = 0;

      const transactionRecords = await Promise.all(
        transactions.map(async (tx) => {
          let reconciliationStatus: BankStatementTransaction["reconciliation_status"] = "not_identified";
          let matchedTransactionId: string | null = null;

          // Try to auto-match by check number first
          if (tx.checkNumber && tx.type === "debit") {
            const normalizedCheckNum = normalizeCheckNumber(tx.checkNumber);
            const matchedExpense = pendingExpenses?.find((exp) => {
              const expCheckNum = normalizeCheckNumber(exp.check_number);
              return (
                expCheckNum === normalizedCheckNum &&
                exp.cash_register_id === cashRegisterId &&
                Math.abs(exp.amount - tx.amount) < 0.01 &&
                exp.status !== "reversed" &&
                exp.status !== "cancelled"
              );
            });

            if (matchedExpense) {
              reconciliationStatus = "auto_reconciled";
              matchedTransactionId = matchedExpense.id;
              autoReconciled++;
            } else {
              reconciliationStatus = "pending_review";
            }
          } else if (tx.type === "debit") {
            // Try to match by amount and date for debits without check number
            const txDateStr = tx.date.toISOString().split("T")[0];
            const matchedExpense = pendingExpenses?.find((exp) => {
              const expDate = exp.paid_date || exp.due_date;
              return (
                Math.abs(exp.amount - tx.amount) < 0.01 &&
                exp.cash_register_id === cashRegisterId &&
                expDate === txDateStr &&
                exp.status === "paid" &&
                !exp.check_number
              );
            });

            if (matchedExpense) {
              reconciliationStatus = "auto_reconciled";
              matchedTransactionId = matchedExpense.id;
              autoReconciled++;
            } else {
              reconciliationStatus = "pending_review";
            }
          }

          return {
            import_id: importRecord.id,
            clinic_id: clinicId,
            cash_register_id: cashRegisterId,
            fitid: tx.fitid || null,
            transaction_date: tx.date.toISOString().split("T")[0],
            amount: tx.amount,
            transaction_type: tx.type,
            description: tx.description,
            check_number: tx.checkNumber,
            reconciliation_status: reconciliationStatus,
            matched_transaction_id: matchedTransactionId,
            reconciled_at: matchedTransactionId ? new Date().toISOString() : null,
          };
        })
      );

      // Insert all transactions
      const { error: txError } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .insert(transactionRecords);

      if (txError) throw txError;

      // Update import status
      await (supabase as any)
        .from("union_bank_statement_imports")
        .update({
          status: "completed",
          transactions_reconciled: autoReconciled,
        })
        .eq("id", importRecord.id);

      // Log audit
      await (supabase as any).rpc("log_reconciliation_action", {
        p_clinic_id: clinicId,
        p_transaction_id: null,
        p_statement_transaction_id: null,
        p_action: "import_statement",
        p_origin: "user",
        p_previous_status: null,
        p_new_status: "completed",
        p_details: {
          import_id: importRecord.id,
          file_name: fileName,
          total_transactions: transactions.length,
          auto_reconciled: autoReconciled,
        },
        p_performed_by: userId,
      });

      return { importRecord, autoReconciled, total: transactions.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-expenses-reconciliation"] });
      toast.success(
        `Extrato importado! ${data.autoReconciled} de ${data.total} transações conciliadas automaticamente.`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao importar extrato");
    },
  });

  // Manual reconcile mutation
  const reconcileMutation = useMutation({
    mutationFn: async ({
      statementTransactionId,
      financialTransactionId,
      userId,
      notes,
    }: {
      statementTransactionId: string;
      financialTransactionId: string;
      userId: string;
      notes?: string;
    }) => {
      // Update statement transaction
      const { error: stmtError } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .update({
          reconciliation_status: "manual_reconciled",
          matched_transaction_id: financialTransactionId,
          reconciled_by: userId,
          reconciled_at: new Date().toISOString(),
          reconciliation_notes: notes || null,
        })
        .eq("id", statementTransactionId);

      if (stmtError) throw stmtError;

      // Update financial transaction
      const { error: finError } = await supabase
        .from("union_financial_transactions")
        .update({
          is_conciliated: true,
          conciliated_at: new Date().toISOString(),
          conciliated_by: userId,
        })
        .eq("id", financialTransactionId);

      if (finError) throw finError;

      // Log audit
      await (supabase as any).rpc("log_reconciliation_action", {
        p_clinic_id: clinicId,
        p_transaction_id: financialTransactionId,
        p_statement_transaction_id: statementTransactionId,
        p_action: "manual_reconcile",
        p_origin: "user",
        p_previous_status: "pending",
        p_new_status: "reconciled",
        p_details: { notes },
        p_performed_by: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-expenses-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      toast.success("Transação conciliada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao conciliar transação");
    },
  });

  // Batch reconcile by check number
  const batchReconcileByCheckMutation = useMutation({
    mutationFn: async ({
      checkNumber,
      cashRegisterId,
      userId,
    }: {
      checkNumber: string;
      cashRegisterId: string;
      userId: string;
    }) => {
      const normalizedCheck = normalizeCheckNumber(checkNumber);
      if (!normalizedCheck) {
        throw new Error("Número de cheque inválido");
      }

      // Find all transactions with this check number
      const { data: transactions, error: txError } = await supabase
        .from("union_financial_transactions")
        .select("id")
        .eq("clinic_id", clinicId!)
        .eq("cash_register_id", cashRegisterId)
        .eq("check_number", normalizedCheck)
        .eq("is_conciliated", false);

      if (txError) throw txError;

      if (!transactions || transactions.length === 0) {
        throw new Error("Nenhuma despesa encontrada com este número de cheque");
      }

      // Reconcile all
      for (const tx of transactions) {
        await supabase
          .from("union_financial_transactions")
          .update({
            is_conciliated: true,
            conciliated_at: new Date().toISOString(),
            conciliated_by: userId,
            check_status: "reconciled",
          } as any)
          .eq("id", tx.id);
      }

      // Log audit
      await (supabase as any).rpc("log_reconciliation_action", {
        p_clinic_id: clinicId,
        p_transaction_id: null,
        p_statement_transaction_id: null,
        p_action: "check_reconciled",
        p_origin: "user",
        p_previous_status: null,
        p_new_status: "reconciled",
        p_details: {
          check_number: normalizedCheck,
          transactions_count: transactions.length,
        },
        p_performed_by: userId,
      });

      return transactions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-expenses-reconciliation"] });
      toast.success(`${count} despesa(s) conciliada(s) pelo cheque!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao conciliar por cheque");
    },
  });

  // Unreconcile mutation
  const unreconciledMutation = useMutation({
    mutationFn: async ({
      transactionId,
      reason,
      userId,
    }: {
      transactionId: string;
      reason: string;
      userId: string;
    }) => {
      // Remove reconciliation from financial transaction
      const { error } = await supabase
        .from("union_financial_transactions")
        .update({
          is_conciliated: false,
          conciliated_at: null,
          conciliated_by: null,
        })
        .eq("id", transactionId);

      if (error) throw error;

      // Log audit
      await (supabase as any).rpc("log_reconciliation_action", {
        p_clinic_id: clinicId,
        p_transaction_id: transactionId,
        p_statement_transaction_id: null,
        p_action: "unreconcile",
        p_origin: "user",
        p_previous_status: "reconciled",
        p_new_status: "pending",
        p_details: { reason },
        p_performed_by: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-expenses-reconciliation"] });
      toast.success("Conciliação removida!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao remover conciliação");
    },
  });

  return {
    imports,
    loadingImports,
    refetchImports,
    pendingExpenses,
    fetchImportTransactions,
    importOFX: importOFXMutation.mutateAsync,
    isImporting: importOFXMutation.isPending,
    reconcile: reconcileMutation.mutateAsync,
    isReconciling: reconcileMutation.isPending,
    batchReconcileByCheck: batchReconcileByCheckMutation.mutateAsync,
    isBatchReconciling: batchReconcileByCheckMutation.isPending,
    unreconcile: unreconciledMutation.mutateAsync,
    isUnreconciling: unreconciledMutation.isPending,
  };
}
