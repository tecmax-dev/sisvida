import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WidgetConfig {
  id: string;
  title: string;
  icon: string;
  isVisible: boolean;
}

interface WidgetSettings {
  widget_order: string[];
  hidden_widgets: string[];
}

// Default widget order
const DEFAULT_WIDGETS = [
  "profile",
  "clinic-info",
  "whatsapp-reminders",
  "whatsapp-header",
  "working-hours",
  "schedule-validation",
  "cpf-limit",
  "map-view",
  "online-booking",
  "whatsapp-provider",
  "evolution-api",
  "twilio-config",
  "message-history",
  "api-keys",
  "webhooks",
  "ai-assistant",
  "password-change",
];

export function useSettingsWidgets() {
  const { user, currentClinic } = useAuth();
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGETS);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load widget settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id || !currentClinic?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("user_settings_widgets")
          .select("widget_order, hidden_widgets")
          .eq("user_id", user.id)
          .eq("clinic_id", currentClinic.id)
          .maybeSingle();

        if (error) {
          console.error("Error loading widget settings:", error);
        }

        if (data) {
          const savedOrder = data.widget_order as string[];
          const savedHidden = data.hidden_widgets as string[];
          
          // Merge saved order with default widgets (in case new widgets were added)
          const mergedOrder = [...savedOrder];
          DEFAULT_WIDGETS.forEach(widgetId => {
            if (!mergedOrder.includes(widgetId)) {
              mergedOrder.push(widgetId);
            }
          });
          
          setWidgetOrder(mergedOrder);
          setHiddenWidgets(savedHidden || []);
        } else {
          setWidgetOrder(DEFAULT_WIDGETS);
          setHiddenWidgets([]);
        }
      } catch (error) {
        console.error("Error loading widget settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.id, currentClinic?.id]);

  // Save widget settings
  const saveSettings = useCallback(async (order: string[], hidden: string[]) => {
    if (!user?.id || !currentClinic?.id) return;

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("user_settings_widgets")
        .upsert({
          user_id: user.id,
          clinic_id: currentClinic.id,
          widget_order: order,
          hidden_widgets: hidden,
        }, {
          onConflict: "user_id,clinic_id",
        });

      if (error) {
        console.error("Error saving widget settings:", error);
      }
    } catch (error) {
      console.error("Error saving widget settings:", error);
    } finally {
      setSaving(false);
    }
  }, [user?.id, currentClinic?.id]);

  // Move widget up
  const moveWidgetUp = useCallback((widgetId: string) => {
    setWidgetOrder(prev => {
      const index = prev.indexOf(widgetId);
      if (index <= 0) return prev;
      
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      saveSettings(newOrder, hiddenWidgets);
      return newOrder;
    });
  }, [hiddenWidgets, saveSettings]);

  // Move widget down
  const moveWidgetDown = useCallback((widgetId: string) => {
    setWidgetOrder(prev => {
      const index = prev.indexOf(widgetId);
      if (index >= prev.length - 1) return prev;
      
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      saveSettings(newOrder, hiddenWidgets);
      return newOrder;
    });
  }, [hiddenWidgets, saveSettings]);

  // Toggle widget visibility
  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setHiddenWidgets(prev => {
      const newHidden = prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId];
      saveSettings(widgetOrder, newHidden);
      return newHidden;
    });
  }, [widgetOrder, saveSettings]);

  // Update order (for drag and drop)
  const updateOrder = useCallback((newOrder: string[]) => {
    setWidgetOrder(newOrder);
    saveSettings(newOrder, hiddenWidgets);
  }, [hiddenWidgets, saveSettings]);

  // Check if widget is visible
  const isWidgetVisible = useCallback((widgetId: string) => {
    return !hiddenWidgets.includes(widgetId);
  }, [hiddenWidgets]);

  // Get sorted widgets
  const getSortedWidgets = useCallback(<T extends { id: string }>(widgets: T[]) => {
    return [...widgets].sort((a, b) => {
      const indexA = widgetOrder.indexOf(a.id);
      const indexB = widgetOrder.indexOf(b.id);
      // If not in order, put at the end
      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      return posA - posB;
    });
  }, [widgetOrder]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    setWidgetOrder(DEFAULT_WIDGETS);
    setHiddenWidgets([]);
    saveSettings(DEFAULT_WIDGETS, []);
  }, [saveSettings]);

  return {
    widgetOrder,
    hiddenWidgets,
    loading,
    saving,
    moveWidgetUp,
    moveWidgetDown,
    toggleWidgetVisibility,
    updateOrder,
    isWidgetVisible,
    getSortedWidgets,
    resetToDefault,
  };
}
