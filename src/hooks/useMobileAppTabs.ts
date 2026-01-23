import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MobileAppTab {
  id: string;
  tab_key: string;
  tab_name: string;
  tab_category: string;
  is_active: boolean;
  order_index: number;
}

export function useMobileAppTabs() {
  const [tabs, setTabs] = useState<MobileAppTab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTabs();
  }, []);

  const loadTabs = async () => {
    try {
      const { data, error } = await supabase
        .from("mobile_app_tabs")
        .select("*")
        .order("tab_category")
        .order("order_index");

      if (error) throw error;
      setTabs(data || []);
    } catch (err) {
      console.error("Error loading mobile app tabs:", err);
    } finally {
      setLoading(false);
    }
  };

  const isTabActive = (tabKey: string): boolean => {
    // If tabs haven't loaded yet or failed to load, show all tabs by default
    if (tabs.length === 0) return true;
    const tab = tabs.find((t) => t.tab_key === tabKey);
    // If tab is not found in config, show it by default
    return tab?.is_active ?? true;
  };

  const getActiveTabs = (category: string): MobileAppTab[] => {
    return tabs
      .filter((t) => t.tab_category === category && t.is_active)
      .sort((a, b) => a.order_index - b.order_index);
  };

  const updateTabStatus = async (tabKey: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("mobile_app_tabs")
        .update({ is_active: isActive })
        .eq("tab_key", tabKey);

      if (error) throw error;
      await loadTabs();
      return true;
    } catch (err) {
      console.error("Error updating tab status:", err);
      return false;
    }
  };

  return {
    tabs,
    loading,
    isTabActive,
    getActiveTabs,
    updateTabStatus,
    refetch: loadTabs,
  };
}
