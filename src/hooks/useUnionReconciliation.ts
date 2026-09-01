import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GenerateEntryParams } from "@/components/union/financials/UnionGenerateEntryDialog";

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
  supplier_id?: string | null;
  category_id?: string | null;
  generated_transaction_id?: string | null;
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
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
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
  const fetchImportTransactions = useCallback(async (importId: string): Promise<BankStatementTransaction[]> => {
    const { data, error } = await (supabase as any)
      .from("union_bank_statement_transactions")
      .select("*")
      .eq("import_id", importId)
      .order("transaction_date", { ascending: false });

    if (error) {
      console.error("Erro ao buscar transações do extrato:", error);
      throw error;
    }

    return data as BankStatementTransaction[];
  }, []);

  const fetchAllPendingTransactions = useCallback(
    async (transactionType: "expense" | "income") => {
      const allData: any[] = [];
      let offset = 0;
      const batchSize = 500;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("union_financial_transactions")
          .select("id, description, amount, status, check_number, payment_method, due_date, paid_date, cash_register_id, type")
          .eq("clinic_id", clinicId!)
          .eq("type", transactionType)
          .eq("is_conciliated", false)
          .in("status", ["paid", "pending"])
          .order("due_date", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          continue;
        }

        allData.push(...data);
        offset += data.length;
        hasMore = data.length === batchSize;
      }

      return allData;
    },
    [clinicId]
  );

  // Fetch ALL pending (unreconciled) expenses for matching (paginated)
  const { data: pendingExpenses } = useQuery({
    queryKey: ["union-pending-expenses-reconciliation", clinicId],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () => fetchAllPendingTransactions("expense"),
    enabled: !!clinicId,
  });

  // Fetch ALL pending (unreconciled) income for matching credits (paginated)
  const { data: pendingIncomes } = useQuery({
    queryKey: ["union-pending-incomes-reconciliation", clinicId],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () => fetchAllPendingTransactions("income"),
    enabled: !!clinicId,
  });

  // Fetch ALL pending (unreconciled) transfers for matching
  const { data: pendingTransfers } = useQuery({
    queryKey: ["union-pending-transfers-reconciliation", clinicId],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("union_cash_transfers")
        .select("id, amount, transfer_date, description, check_number, from_register_id, to_register_id, is_conciliated_from, is_conciliated_to")
        .eq("clinic_id", clinicId)
        .or("is_conciliated_from.eq.false,is_conciliated_to.eq.false");
      if (error) throw error;
      return data || [];
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
          } else if (tx.checkNumber && tx.type === "credit") {
            // Match credits with check number against pending incomes (e.g. transfer deposits via check)
            const normalizedCheckNum = normalizeCheckNumber(tx.checkNumber);
            const matchedIncome = pendingIncomes?.find((inc) => {
              const incCheckNum = normalizeCheckNumber(inc.check_number);
              return (
                incCheckNum === normalizedCheckNum &&
                inc.cash_register_id === cashRegisterId &&
                Math.abs(inc.amount - tx.amount) < 0.01 &&
                inc.status !== "reversed" &&
                inc.status !== "cancelled"
              );
            });

            if (matchedIncome) {
              reconciliationStatus = "auto_reconciled";
              matchedTransactionId = matchedIncome.id;
              autoReconciled++;
            } else {
              reconciliationStatus = "pending_review";
            }
          } else if (tx.type === "credit") {
            // Match credits without check number by amount and date
            const txDateStr = tx.date.toISOString().split("T")[0];
            const matchedIncome = pendingIncomes?.find((inc) => {
              const incDate = inc.paid_date || inc.due_date;
              return (
                Math.abs(inc.amount - tx.amount) < 0.01 &&
                inc.cash_register_id === cashRegisterId &&
                incDate === txDateStr &&
                inc.status === "paid" &&
                !inc.check_number
              );
            });

            if (matchedIncome) {
              reconciliationStatus = "auto_reconciled";
              matchedTransactionId = matchedIncome.id;
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

          // If still not matched, try matching against transfers between accounts
          if (reconciliationStatus !== "auto_reconciled" && pendingTransfers) {
            const txDateStr = tx.date.toISOString().split("T")[0];
            const matchedTransfer = pendingTransfers.find((tr) => {
              if (Math.abs(tr.amount - tx.amount) >= 0.01) return false;
              if (tr.transfer_date !== txDateStr) return false;
              // Debit on OFX = outflow from this account (from_register_id)
              if (tx.type === "debit" && tr.from_register_id === cashRegisterId && !tr.is_conciliated_from) {
                // Check number match if available
                if (tx.checkNumber && tr.check_number) {
                  return normalizeCheckNumber(tx.checkNumber) === normalizeCheckNumber(tr.check_number);
                }
                return true;
              }
              // Credit on OFX = inflow to this account (to_register_id)
              if (tx.type === "credit" && tr.to_register_id === cashRegisterId && !tr.is_conciliated_to) {
                if (tx.checkNumber && tr.check_number) {
                  return normalizeCheckNumber(tx.checkNumber) === normalizeCheckNumber(tr.check_number);
                }
                return true;
              }
              return false;
            });

            if (matchedTransfer) {
              reconciliationStatus = "auto_reconciled";
              // Store transfer info separately — will be set after insert
              matchedTransactionId = null;
              autoReconciled++;
              // Tag this record so we can update it after insert
              (tx as any)._matchedTransferId = matchedTransfer.id;
              (tx as any)._matchedTransferSide = tx.type === "debit" ? "from" : "to";
            }
          }

          const hasMatch = matchedTransactionId || (tx as any)._matchedTransferId;
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
            matched_transfer_id: (tx as any)._matchedTransferId || null,
            matched_type: (tx as any)._matchedTransferId ? "transfer" : "transaction",
            reconciled_at: hasMatch ? new Date().toISOString() : null,
          };
        })
      );

      // Insert all transactions
      const { error: txError } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .insert(transactionRecords);

      if (txError) throw txError;

      // Update auto-reconciled financial transactions and transfers
      for (const rec of transactionRecords) {
        if (rec.reconciliation_status === "auto_reconciled" && rec.matched_transfer_id) {
          // Handle transfer auto-reconciliation
          const transferId = rec.matched_transfer_id;
          const side = rec.transaction_type === "debit" ? "from" : "to";
          const now = new Date().toISOString();

          const updatePayload: Record<string, any> = side === "from"
            ? { is_conciliated_from: true, conciliated_from_at: now, conciliated_from_by: userId, source_statement_tx_id_from: null }
            : { is_conciliated_to: true, conciliated_to_at: now, conciliated_to_by: userId, source_statement_tx_id_to: null };

          await supabase
            .from("union_cash_transfers")
            .update(updatePayload as any)
            .eq("id", transferId);

          continue;
        } else if (rec.reconciliation_status === "auto_reconciled" && rec.matched_transaction_id) {

          // Look in both expenses and incomes
          const matchedTx = pendingExpenses?.find((e) => e.id === rec.matched_transaction_id)
            || pendingIncomes?.find((i) => i.id === rec.matched_transaction_id);
          if (!matchedTx) continue;

          const wasPending = matchedTx.status === "pending";
          const compensationDate = rec.transaction_date;

          const updatePayload: Record<string, any> = {
            is_conciliated: true,
            conciliated_at: new Date().toISOString(),
            conciliated_by: userId,
            source_statement_tx_id: null,
          };

          if (wasPending) {
            updatePayload.status = "paid";
            updatePayload.paid_date = compensationDate;
          }

          // Auto-fill check_number from OFX if financial transaction has none
          if ((!matchedTx.check_number || matchedTx.check_number.trim() === "") && rec.check_number) {
            updatePayload.check_number = rec.check_number;
          }

          const { error: finError } = await supabase
            .from("union_financial_transactions")
            .update(updatePayload as any)
            .eq("id", rec.matched_transaction_id);

          if (finError) {
            console.error("Error updating auto-reconciled transaction:", finError);
            continue;
          }

          // If was pending, update cash register balance
          if (wasPending) {
            const balanceChange = matchedTx.type === "income"
              ? Number(matchedTx.amount)
              : -Number(matchedTx.amount);

            const { data: register } = await supabase
              .from("union_cash_registers")
              .select("current_balance")
              .eq("id", cashRegisterId)
              .single();

            if (register) {
              await supabase
                .from("union_cash_registers")
                .update({
                  current_balance: Number(register.current_balance || 0) + balanceChange,
                })
                .eq("id", cashRegisterId);
            }
          }
        }
      }

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
      queryClient.invalidateQueries({ queryKey: ["union-pending-incomes-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-transfers-reconciliation"] });
      toast.success(
        `Extrato importado! ${data.autoReconciled} de ${data.total} transações conciliadas automaticamente.`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao importar extrato");
    },
  });

  // Manual reconcile mutation (1:N — one statement tx to multiple expenses/transfers)
  const reconcileMutation = useMutation({
    mutationFn: async ({
      statementTransactionId,
      financialTransactionIds,
      userId,
      notes,
    }: {
      statementTransactionId: string;
      financialTransactionIds: string[];
      userId: string;
      notes?: string;
    }) => {
      // Separate transfer IDs from financial transaction IDs
      const transferIds = financialTransactionIds.filter((id) => id.startsWith("transfer:"));
      const finTxIds = financialTransactionIds.filter((id) => !id.startsWith("transfer:"));

      // --- Backend validation: ensure all expenses belong to the same cash register as the statement tx ---
      const { data: stmtTx, error: stmtFetchError } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .select("cash_register_id, transaction_date, check_number, transaction_type")
        .eq("id", statementTransactionId)
        .single();

      if (stmtFetchError) throw stmtFetchError;

      const compensationDate = stmtTx.transaction_date;

      // Handle transfer reconciliation
      for (const transferRef of transferIds) {
        const parts = transferRef.split(":");
        const transferId = parts[1];
        const side = parts[2]; // "from" or "to"
        const now = new Date().toISOString();

        const updatePayload: Record<string, any> = side === "from"
          ? { is_conciliated_from: true, conciliated_from_at: now, conciliated_from_by: userId, source_statement_tx_id_from: statementTransactionId }
          : { is_conciliated_to: true, conciliated_to_at: now, conciliated_to_by: userId, source_statement_tx_id_to: statementTransactionId };

        await supabase
          .from("union_cash_transfers")
          .update(updatePayload as any)
          .eq("id", transferId);
      }

      // If only transfers (no financial txs), update statement and return
      if (finTxIds.length === 0 && transferIds.length > 0) {
        const firstTransferId = transferIds[0].split(":")[1];
        const { error: stmtError } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .update({
            reconciliation_status: "manual_reconciled",
            matched_transaction_id: null,
            matched_transfer_id: firstTransferId,
            matched_type: "transfer",
            reconciled_by: userId,
            reconciled_at: new Date().toISOString(),
            reconciliation_notes: notes || "Conciliado com transferência entre contas",
          })
          .eq("id", statementTransactionId);

        if (stmtError) throw stmtError;

        // Recalculate reconciled count
        const { data: stmtRow } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .select("import_id")
          .eq("id", statementTransactionId)
          .single();

        if (stmtRow?.import_id) {
          const { count } = await (supabase as any)
            .from("union_bank_statement_transactions")
            .select("id", { count: "exact", head: true })
            .eq("import_id", stmtRow.import_id)
            .in("reconciliation_status", ["auto_reconciled", "manual_reconciled"]);

          await (supabase as any)
            .from("union_bank_statement_imports")
            .update({ transactions_reconciled: count || 0 })
            .eq("id", stmtRow.import_id);
        }

        // Log audit
        await (supabase as any).rpc("log_reconciliation_action", {
          p_clinic_id: clinicId,
          p_transaction_id: null,
          p_statement_transaction_id: statementTransactionId,
          p_action: "manual_reconcile_transfer",
          p_origin: "user",
          p_previous_status: "pending",
          p_new_status: "reconciled",
          p_details: { notes, transfer_ids: transferIds, count: transferIds.length },
          p_performed_by: userId,
        });

        return;
      }

      // Handle financial transactions (existing logic)
      if (finTxIds.length === 0) return;

      const { data: expenseRows, error: expFetchError } = await supabase
        .from("union_financial_transactions")
        .select("id, cash_register_id, status, amount, type, check_number")
        .in("id", finTxIds);

      if (expFetchError) throw expFetchError;

      const mismatch = (expenseRows || []).find(
        (e) => e.cash_register_id !== stmtTx.cash_register_id
      );
      if (mismatch) {
        throw new Error("Não é permitido conciliar lançamentos de outro portador.");
      }

      // Update statement transaction — store first matched id for backward compat
      const { error: stmtError } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .update({
          reconciliation_status: "manual_reconciled",
          matched_transaction_id: finTxIds[0],
          reconciled_by: userId,
          reconciled_at: new Date().toISOString(),
          reconciliation_notes: notes || null,
        })
        .eq("id", statementTransactionId);

      if (stmtError) throw stmtError;

      // Update ALL linked financial transactions — mark as paid with compensation date and update balance
      for (const finId of finTxIds) {
        const expense = (expenseRows || []).find((e) => e.id === finId);
        const wasPending = expense && expense.status === "pending";

        const updatePayload: Record<string, any> = {
          is_conciliated: true,
          conciliated_at: new Date().toISOString(),
          conciliated_by: userId,
          source_statement_tx_id: statementTransactionId,
        };

        // If expense was pending, mark as paid with compensation date
        if (wasPending) {
          updatePayload.status = "paid";
          updatePayload.paid_date = compensationDate;
        }

        // Auto-fill check_number from OFX if financial transaction has none
        if ((!expense?.check_number || expense.check_number.trim() === "") && stmtTx.check_number) {
          updatePayload.check_number = stmtTx.check_number;
        }

        const { error: finError } = await supabase
          .from("union_financial_transactions")
          .update(updatePayload as any)
          .eq("id", finId);

        if (finError) throw finError;

        // If was pending, update cash register balance (newly paid = cash flow impact)
        if (wasPending && expense) {
          const balanceChange = expense.type === "income"
            ? Number(expense.amount)
            : -Number(expense.amount);

          const { data: register } = await supabase
            .from("union_cash_registers")
            .select("current_balance")
            .eq("id", stmtTx.cash_register_id)
            .single();

          if (register) {
            await supabase
              .from("union_cash_registers")
              .update({
                current_balance: Number(register.current_balance || 0) + balanceChange,
              })
              .eq("id", stmtTx.cash_register_id);
          }
        }
      }

      // Log audit
      await (supabase as any).rpc("log_reconciliation_action", {
        p_clinic_id: clinicId,
        p_transaction_id: finTxIds[0],
        p_statement_transaction_id: statementTransactionId,
        p_action: "manual_reconcile",
        p_origin: "user",
        p_previous_status: "pending",
        p_new_status: "reconciled",
        p_details: { notes, financial_transaction_ids: finTxIds, transfer_ids: transferIds, count: finTxIds.length },
        p_performed_by: userId,
      });

      // Recalculate transactions_reconciled for the import
      const { data: stmtRow } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .select("import_id")
        .eq("id", statementTransactionId)
        .single();

      if (stmtRow?.import_id) {
        const { count } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .select("id", { count: "exact", head: true })
          .eq("import_id", stmtRow.import_id)
          .in("reconciliation_status", ["auto_reconciled", "manual_reconciled"]);

        await (supabase as any)
          .from("union_bank_statement_imports")
          .update({ transactions_reconciled: count || 0 })
          .eq("id", stmtRow.import_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-expenses-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-incomes-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-transfers-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers-statement"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-previous-balance"] });
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
      queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
      toast.success(`${count} despesa(s) conciliada(s) pelo cheque!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao conciliar por cheque");
    },
  });

  // Delete import mutation (only if no reconciled transactions)
  const deleteImportMutation = useMutation({
    mutationFn: async ({ importId }: { importId: string }) => {
      // Check if any transactions are reconciled
      const { data: reconciled, error: checkError } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .select("id")
        .eq("import_id", importId)
        .in("reconciliation_status", ["auto_reconciled", "manual_reconciled"])
        .limit(1);

      if (checkError) throw checkError;

      if (reconciled && reconciled.length > 0) {
        throw new Error("Não é possível excluir: existem transações conciliadas neste extrato.");
      }

      // Delete transactions first
      const { error: txDelError } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .delete()
        .eq("import_id", importId);

      if (txDelError) throw txDelError;

      // Delete import record
      const { error: impDelError } = await (supabase as any)
        .from("union_bank_statement_imports")
        .delete()
        .eq("id", importId);

      if (impDelError) throw impDelError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-imports"] });
      toast.success("Extrato excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao excluir extrato");
    },
  });

  // Mark statement transaction as verified (without linking to a financial transaction)
  const markVerifiedMutation = useMutation({
    mutationFn: async ({
      statementTransactionId,
      userId,
      notes,
    }: {
      statementTransactionId: string;
      userId: string;
      notes?: string;
    }) => {
      const { error } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .update({
          reconciliation_status: "manual_reconciled",
          reconciled_by: userId,
          reconciled_at: new Date().toISOString(),
          reconciliation_notes: notes || "Marcado como conferido manualmente",
        })
        .eq("id", statementTransactionId);

      if (error) throw error;

      // Recalculate transactions_reconciled for the import
      const { data: stmtRow } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .select("import_id")
        .eq("id", statementTransactionId)
        .single();

      if (stmtRow?.import_id) {
        const { count } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .select("id", { count: "exact", head: true })
          .eq("import_id", stmtRow.import_id)
          .in("reconciliation_status", ["auto_reconciled", "manual_reconciled"]);

        await (supabase as any)
          .from("union_bank_statement_imports")
          .update({ transactions_reconciled: count || 0 })
          .eq("id", stmtRow.import_id);
      }

      // Log audit
      await (supabase as any).rpc("log_reconciliation_action", {
        p_clinic_id: clinicId,
        p_transaction_id: null,
        p_statement_transaction_id: statementTransactionId,
        p_action: "mark_verified",
        p_origin: "user",
        p_previous_status: "pending",
        p_new_status: "reconciled",
        p_details: { notes },
        p_performed_by: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
      toast.success("Transação marcada como conferida!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao marcar como conferida");
    },
  });

  // Unreconcile mutation — resets statement tx AND removes linked financial tx if generated
  const unreconciledMutation = useMutation({
    mutationFn: async ({
      statementTransactionIds,
      reason,
      userId,
    }: {
      statementTransactionIds: string[];
      reason: string;
      userId: string;
    }) => {
      let deletedFinCount = 0;

      for (const stmtId of statementTransactionIds) {
        // Fetch the statement transaction
        const { data: stmtTx, error: fetchErr } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .select("id, matched_transaction_id, matched_transfer_id, matched_type, generated_transaction_id, import_id, cash_register_id, amount, transaction_type")
          .eq("id", stmtId)
          .single();

        if (fetchErr) throw fetchErr;

        const generatedId = stmtTx.generated_transaction_id;
        const matchedId = stmtTx.matched_transaction_id;

        // If a financial transaction was generated from OFX, find ALL generated txs (split support)
        if (generatedId) {
          // Find all financial transactions generated from this statement tx (split entries)
          const { data: allGenerated } = await (supabase as any)
            .from("union_financial_transactions")
            .select("id, amount, type")
            .eq("source_statement_tx_id", stmtId);

          // If split entries found, delete all of them; otherwise fallback to single generated ID
          const txsToDelete = (allGenerated && allGenerated.length > 0)
            ? allGenerated
            : [{ id: generatedId, amount: stmtTx.amount, type: stmtTx.transaction_type === "credit" ? "income" : "expense" }];

          for (const genTx of txsToDelete) {
            // Reverse balance change per entry
            const balanceChange = genTx.type === "income" ? -genTx.amount : genTx.amount;
            const { data: register } = await supabase
              .from("union_cash_registers")
              .select("current_balance")
              .eq("id", stmtTx.cash_register_id)
              .single();

            if (register) {
              await supabase
                .from("union_cash_registers")
                .update({ current_balance: Number(register.current_balance || 0) + balanceChange })
                .eq("id", stmtTx.cash_register_id);
            }

            // Cancel then delete (trigger blocks deleting paid txs)
            await supabase
              .from("union_financial_transactions")
              .update({ status: "cancelled" as any })
              .eq("id", genTx.id);

            await supabase
              .from("union_financial_transactions")
              .delete()
              .eq("id", genTx.id);

            deletedFinCount++;
          }
        } else if (stmtTx.matched_transfer_id || stmtTx.matched_type === "transfer") {
          // Undo transfer reconciliation
          const transferId = stmtTx.matched_transfer_id;
          const side = stmtTx.transaction_type === "debit" ? "from" : "to";
          const revertPayload: Record<string, any> = side === "from"
            ? { is_conciliated_from: false, conciliated_from_at: null, conciliated_from_by: null, source_statement_tx_id_from: null }
            : { is_conciliated_to: false, conciliated_to_at: null, conciliated_to_by: null, source_statement_tx_id_to: null };

          if (transferId) {
            await supabase
              .from("union_cash_transfers")
              .update(revertPayload as any)
              .eq("id", transferId);
          }
        } else if (matchedId) {
          // If matched to existing financial transaction(s), find ALL linked via source_statement_tx_id
          const { data: allLinked } = await supabase
            .from("union_financial_transactions")
            .select("id, amount, type, status, conciliated_at")
            .eq("source_statement_tx_id", stmtId);

          // Fallback: if no linked found via source_statement_tx_id, use the single matchedId
          const linkedTxs = (allLinked && allLinked.length > 0)
            ? allLinked
            : [];

          if (linkedTxs.length === 0) {
            // Legacy fallback: just the single matchedId
            const { data: singleTx } = await supabase
              .from("union_financial_transactions")
              .select("id, amount, type, status, conciliated_at")
              .eq("id", matchedId)
              .single();
            if (singleTx) linkedTxs.push(singleTx);
          }

          for (const linkedTx of linkedTxs) {
            // If this transaction was marked as paid during reconciliation (has conciliated_at),
            // revert it to pending and reverse the balance
            const wasPaidDuringReconciliation = linkedTx.status === "paid" && linkedTx.conciliated_at;

            const revertPayload: Record<string, any> = {
              is_conciliated: false,
              conciliated_at: null,
              conciliated_by: null,
              source_statement_tx_id: null,
            };

            if (wasPaidDuringReconciliation) {
              revertPayload.status = "pending";
              revertPayload.paid_date = null;
            }

            await supabase
              .from("union_financial_transactions")
              .update(revertPayload as any)
              .eq("id", linkedTx.id);

            // Reverse balance if the transaction was paid during reconciliation
            if (wasPaidDuringReconciliation) {
              const balanceChange = linkedTx.type === "income"
                ? -Number(linkedTx.amount)
                : Number(linkedTx.amount);

              const { data: register } = await supabase
                .from("union_cash_registers")
                .select("current_balance")
                .eq("id", stmtTx.cash_register_id)
                .single();

              if (register) {
                await supabase
                  .from("union_cash_registers")
                  .update({
                    current_balance: Number(register.current_balance || 0) + balanceChange,
                  })
                  .eq("id", stmtTx.cash_register_id);
              }
            }
          }
        }

        // Reset statement transaction
        await (supabase as any)
          .from("union_bank_statement_transactions")
          .update({
            reconciliation_status: "pending_review",
            matched_transaction_id: null,
            matched_transfer_id: null,
            matched_type: "transaction",
            generated_transaction_id: null,
            reconciled_by: null,
            reconciled_at: null,
            reconciliation_notes: null,
            supplier_id: null,
            category_id: null,
          })
          .eq("id", stmtId);

        // Log audit
        await (supabase as any).rpc("log_reconciliation_action", {
          p_clinic_id: clinicId,
          p_transaction_id: matchedId || generatedId,
          p_statement_transaction_id: stmtId,
          p_action: "undo_reconciliation",
          p_origin: "user",
          p_previous_status: "reconciled",
          p_new_status: "pending_review",
          p_details: { reason, had_generated: !!generatedId },
          p_performed_by: userId,
        });
      }

      // Recalculate reconciled count for affected imports
      const { data: stmtRow } = await (supabase as any)
        .from("union_bank_statement_transactions")
        .select("import_id")
        .eq("id", statementTransactionIds[0])
        .single();

      if (stmtRow?.import_id) {
        const { count } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .select("id", { count: "exact", head: true })
          .eq("import_id", stmtRow.import_id)
          .in("reconciliation_status", ["auto_reconciled", "manual_reconciled"]);

        await (supabase as any)
          .from("union_bank_statement_imports")
          .update({ transactions_reconciled: count || 0 })
          .eq("id", stmtRow.import_id);
      }

      return { count: statementTransactionIds.length, deletedFinCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-expenses-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["union-pending-incomes-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers-statement"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-previous-balance"] });
      const msg = result.count === 1
        ? "Conciliação desfeita com sucesso!"
        : `${result.count} conciliações desfeitas com sucesso!`;
      toast.success(msg);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao desfazer conciliação");
    },
  });

  // Generate financial entries from OFX statement transactions
  // Supports split mode: multiple entries sharing the same statementTransactionId
  const generateEntryMutation = useMutation({
    mutationFn: async ({
      entries,
      userId,
    }: {
      entries: GenerateEntryParams[];
      userId: string;
    }) => {
      const results: string[] = [];

      // Group entries by statementTransactionId to detect split mode
      const groupedByStmt = new Map<string, GenerateEntryParams[]>();
      for (const entry of entries) {
        const existing = groupedByStmt.get(entry.statementTransactionId) || [];
        existing.push(entry);
        groupedByStmt.set(entry.statementTransactionId, existing);
      }

      for (const [stmtTxId, stmtEntries] of groupedByStmt) {
        const generatedIds: string[] = [];

        for (const entry of stmtEntries) {
          // Create financial transaction with source_statement_tx_id for tracking
          const { data: finTx, error: finError } = await supabase
            .from("union_financial_transactions")
            .insert({
              clinic_id: clinicId!,
              type: entry.type,
              description: entry.description,
              amount: entry.amount,
              cash_register_id: entry.cashRegisterId,
              status: "paid",
              paid_date: entry.transactionDate,
              due_date: entry.transactionDate,
              payment_method: "other",
              supplier_id: entry.supplierId,
              category_id: entry.categoryId,
              is_conciliated: true,
              conciliated_at: new Date().toISOString(),
              conciliated_by: userId,
              notes: entry.notes || "Gerado a partir do OFX",
              source_statement_tx_id: stmtTxId,
            })
            .select("id")
            .single();

          if (finError) throw finError;
          generatedIds.push(finTx.id);
          results.push(finTx.id);

          // Update cash register balance
          const balanceChange = entry.type === "income" ? entry.amount : -entry.amount;
          const { data: register } = await supabase
            .from("union_cash_registers")
            .select("current_balance")
            .eq("id", entry.cashRegisterId)
            .single();

          if (register) {
            await supabase
              .from("union_cash_registers")
              .update({ current_balance: Number(register.current_balance || 0) + balanceChange })
              .eq("id", entry.cashRegisterId);
          }
        }

        // Link statement transaction — store first generated ID for backward compat
        const { error: linkError } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .update({
            generated_transaction_id: generatedIds[0],
            matched_transaction_id: generatedIds[0],
            reconciliation_status: "manual_reconciled",
            reconciled_by: userId,
            reconciled_at: new Date().toISOString(),
            reconciliation_notes: generatedIds.length > 1
              ? `Split: ${generatedIds.length} lançamentos gerados do OFX`
              : "Lançamento gerado do OFX",
            supplier_id: stmtEntries[0].supplierId,
            category_id: stmtEntries[0].categoryId,
          })
          .eq("id", stmtTxId);

        if (linkError) throw linkError;
      }

      // Recalculate reconciled count for affected imports
      if (entries.length > 0) {
        const { data: stmtRow } = await (supabase as any)
          .from("union_bank_statement_transactions")
          .select("import_id")
          .eq("id", entries[0].statementTransactionId)
          .single();

        if (stmtRow?.import_id) {
          const { count } = await (supabase as any)
            .from("union_bank_statement_transactions")
            .select("id", { count: "exact", head: true })
            .eq("import_id", stmtRow.import_id)
            .in("reconciliation_status", ["auto_reconciled", "manual_reconciled"]);

          await (supabase as any)
            .from("union_bank_statement_imports")
            .update({ transactions_reconciled: count || 0 })
            .eq("id", stmtRow.import_id);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-imports"] });
      queryClient.invalidateQueries({ queryKey: ["union-bank-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-previous-balance"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers-statement"] });
      toast.success(`${results.length} lançamento(s) gerado(s) com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao gerar lançamentos");
    },
  });

  return {
    imports,
    loadingImports,
    refetchImports,
    pendingExpenses,
    pendingIncomes,
    pendingTransfers,
    fetchImportTransactions,
    importOFX: importOFXMutation.mutateAsync,
    isImporting: importOFXMutation.isPending,
    reconcile: reconcileMutation.mutateAsync,
    isReconciling: reconcileMutation.isPending,
    batchReconcileByCheck: batchReconcileByCheckMutation.mutateAsync,
    isBatchReconciling: batchReconcileByCheckMutation.isPending,
    unreconcile: unreconciledMutation.mutateAsync,
    isUnreconciling: unreconciledMutation.isPending,
    markVerified: markVerifiedMutation.mutateAsync,
    isMarkingVerified: markVerifiedMutation.isPending,
    deleteImport: deleteImportMutation.mutateAsync,
    isDeletingImport: deleteImportMutation.isPending,
    generateEntryFromOFX: generateEntryMutation.mutateAsync,
    isGeneratingEntry: generateEntryMutation.isPending,
  };
}
