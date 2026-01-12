import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

/**
 * Hook para carregar dados financeiros do módulo sindical com fallback para dados da clínica vinculada.
 * Se as tabelas union_* estiverem vazias, carrega automaticamente da clínica e oferece migração.
 */
export function useUnionFinancialData(clinicId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch union categories with clinic fallback
  const { data: categories, isLoading: loadingCategories, refetch: refetchCategories } = useQuery({
    queryKey: ["union-financial-categories-with-fallback", clinicId],
    queryFn: async () => {
      if (!clinicId) return { unionCategories: [], clinicCategories: [], hasUnionData: false };

      // First try to get union categories
      const { data: unionData, error: unionError } = await supabase
        .from("union_financial_categories")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (unionError) throw unionError;

      // If we have union data, use it
      if (unionData && unionData.length > 0) {
        return { 
          categories: unionData, 
          source: "union" as const,
          hasUnionData: true 
        };
      }

      // Fallback: get clinic categories
      const { data: clinicData, error: clinicError } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (clinicError) throw clinicError;

      return { 
        categories: clinicData || [], 
        source: "clinic" as const,
        hasUnionData: false 
      };
    },
    enabled: !!clinicId,
  });

  // Fetch union chart of accounts with clinic fallback
  const { data: chartOfAccounts, isLoading: loadingChartOfAccounts, refetch: refetchChartOfAccounts } = useQuery({
    queryKey: ["union-chart-of-accounts-with-fallback", clinicId],
    queryFn: async () => {
      if (!clinicId) return { accounts: [], source: "union" as const, hasUnionData: false };

      // First try to get union chart of accounts
      const { data: unionData, error: unionError } = await supabase
        .from("union_chart_of_accounts")
        .select("*")
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .order("account_code");

      if (unionError) throw unionError;

      // If we have union data, use it
      if (unionData && unionData.length > 0) {
        return { 
          accounts: unionData, 
          source: "union" as const,
          hasUnionData: true 
        };
      }

      // Fallback: get clinic chart of accounts
      const { data: clinicData, error: clinicError } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("account_code");

      if (clinicError) throw clinicError;

      return { 
        accounts: clinicData || [], 
        source: "clinic" as const,
        hasUnionData: false 
      };
    },
    enabled: !!clinicId,
  });

  // Fetch union cash registers with clinic fallback
  const { data: cashRegisters, isLoading: loadingCashRegisters, refetch: refetchCashRegisters } = useQuery({
    queryKey: ["union-cash-registers-with-fallback", clinicId],
    queryFn: async () => {
      if (!clinicId) return { registers: [], source: "union" as const, hasUnionData: false };

      // First try to get union cash registers
      const { data: unionData, error: unionError } = await supabase
        .from("union_cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (unionError) throw unionError;

      // If we have union data, use it
      if (unionData && unionData.length > 0) {
        return { 
          registers: unionData, 
          source: "union" as const,
          hasUnionData: true 
        };
      }

      // Fallback: get clinic cash registers
      const { data: clinicData, error: clinicError } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (clinicError) throw clinicError;

      return { 
        registers: clinicData || [], 
        source: "clinic" as const,
        hasUnionData: false 
      };
    },
    enabled: !!clinicId,
  });

  // Migrate data from clinic to union tables
  const migrateData = useCallback(async (entityId?: string) => {
    if (!clinicId) return false;

    try {
      const { data, error } = await supabase.functions.invoke("migrate-union-financial-data", {
        body: { clinic_id: clinicId, entity_id: entityId || clinicId },
      });

      if (error) throw error;

      toast.success(`Migração concluída: ${data.message}`);
      
      // Refresh all queries
      await Promise.all([
        refetchCategories(),
        refetchChartOfAccounts(),
        refetchCashRegisters(),
      ]);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["union-financial-categories"] });
      queryClient.invalidateQueries({ queryKey: ["union-chart-of-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });

      return true;
    } catch (error: any) {
      console.error("Migration error:", error);
      toast.error("Erro na migração: " + error.message);
      return false;
    }
  }, [clinicId, refetchCategories, refetchChartOfAccounts, refetchCashRegisters, queryClient]);

  // Check if migration is needed
  const needsMigration = 
    (categories && !categories.hasUnionData && categories.categories.length > 0) ||
    (chartOfAccounts && !chartOfAccounts.hasUnionData && chartOfAccounts.accounts.length > 0) ||
    (cashRegisters && !cashRegisters.hasUnionData && cashRegisters.registers.length > 0);

  return {
    // Categories
    categories: categories?.categories || [],
    categoriesSource: categories?.source || "union",
    loadingCategories,
    
    // Chart of Accounts
    chartOfAccounts: chartOfAccounts?.accounts || [],
    chartOfAccountsSource: chartOfAccounts?.source || "union",
    loadingChartOfAccounts,
    
    // Cash Registers
    cashRegisters: cashRegisters?.registers || [],
    cashRegistersSource: cashRegisters?.source || "union",
    loadingCashRegisters,
    
    // Migration
    needsMigration,
    migrateData,
    
    // Refetch
    refetch: async () => {
      await Promise.all([
        refetchCategories(),
        refetchChartOfAccounts(),
        refetchCashRegisters(),
      ]);
    },
  };
}
