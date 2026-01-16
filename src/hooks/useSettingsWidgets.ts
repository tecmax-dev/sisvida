import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { arrayMove } from "@dnd-kit/sortable";

export type WidgetColumn = "left" | "right";

export interface WidgetPlacement {
  id: string;
  column: WidgetColumn;
  order: number;
}

// Default widget placements - two columns
const DEFAULT_PLACEMENTS: WidgetPlacement[] = [
  // Left column
  { id: "profile", column: "left", order: 0 },
  { id: "clinic-info", column: "left", order: 1 },
  { id: "whatsapp-reminders", column: "left", order: 2 },
  { id: "whatsapp-header", column: "left", order: 3 },
  { id: "working-hours", column: "left", order: 4 },
  { id: "schedule-validation", column: "left", order: 5 },
  { id: "cpf-limit", column: "left", order: 6 },
  { id: "whatsapp-provider", column: "left", order: 7 },
  { id: "evolution-api", column: "left", order: 8 },
  { id: "twilio-config", column: "left", order: 9 },
  { id: "hide-pending-contributions", column: "left", order: 10 },
  // Right column
  { id: "map-view", column: "right", order: 0 },
  { id: "online-booking", column: "right", order: 1 },
  { id: "message-history", column: "right", order: 2 },
  { id: "api-keys", column: "right", order: 3 },
  { id: "webhooks", column: "right", order: 4 },
  { id: "ai-assistant", column: "right", order: 5 },
  { id: "password-change", column: "right", order: 6 },
  { id: "whatsapp-delay", column: "right", order: 7 },
  { id: "entity-nomenclature", column: "right", order: 8 },
];

export function useSettingsWidgets() {
  const { user, currentClinic } = useAuth();
  const [placements, setPlacements] = useState<WidgetPlacement[]>(DEFAULT_PLACEMENTS);
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
          const savedPlacements = data.widget_order as WidgetPlacement[];
          const savedHidden = data.hidden_widgets as string[];
          
          // Merge saved placements with default (in case new widgets were added)
          if (Array.isArray(savedPlacements) && savedPlacements.length > 0 && savedPlacements[0]?.column) {
            const mergedPlacements = [...savedPlacements];
            DEFAULT_PLACEMENTS.forEach(defaultPlacement => {
              if (!mergedPlacements.find(p => p.id === defaultPlacement.id)) {
                mergedPlacements.push(defaultPlacement);
              }
            });
            setPlacements(mergedPlacements);
          } else {
            setPlacements(DEFAULT_PLACEMENTS);
          }
          
          setHiddenWidgets(savedHidden || []);
        } else {
          setPlacements(DEFAULT_PLACEMENTS);
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
  const saveSettings = useCallback(async (newPlacements: WidgetPlacement[], hidden: string[]) => {
    if (!user?.id || !currentClinic?.id) return;

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("user_settings_widgets")
        .upsert({
          user_id: user.id,
          clinic_id: currentClinic.id,
          widget_order: newPlacements,
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

  // Get widgets for a specific column
  const getWidgetsForColumn = useCallback((column: WidgetColumn) => {
    return placements
      .filter(p => p.column === column)
      .sort((a, b) => a.order - b.order);
  }, [placements]);

  // Handle drag end - reorder within column or move between columns
  const handleDragEnd = useCallback((activeId: string, overId: string | null, overColumn: WidgetColumn | null) => {
    if (!overId && !overColumn) return;

    setPlacements(prev => {
      const activeWidget = prev.find(p => p.id === activeId);
      if (!activeWidget) return prev;

      // If dropped on a column droppable (not on another widget)
      if (overColumn && !overId) {
        // Move to end of target column
        const targetColumnWidgets = prev.filter(p => p.column === overColumn);
        const maxOrder = targetColumnWidgets.length > 0 
          ? Math.max(...targetColumnWidgets.map(p => p.order)) + 1 
          : 0;

        const newPlacements = prev.map(p => {
          if (p.id === activeId) {
            return { ...p, column: overColumn, order: maxOrder };
          }
          return p;
        });

        saveSettings(newPlacements, hiddenWidgets);
        return newPlacements;
      }

      // Dropped on another widget
      const overWidget = prev.find(p => p.id === overId);
      if (!overWidget) return prev;

      // Same column - reorder
      if (activeWidget.column === overWidget.column) {
        const columnWidgets = prev
          .filter(p => p.column === activeWidget.column)
          .sort((a, b) => a.order - b.order);
        
        const activeIndex = columnWidgets.findIndex(p => p.id === activeId);
        const overIndex = columnWidgets.findIndex(p => p.id === overId);
        
        if (activeIndex === overIndex) return prev;

        const reorderedColumn = arrayMove(columnWidgets, activeIndex, overIndex);
        
        const newPlacements = prev.map(p => {
          if (p.column === activeWidget.column) {
            const newIndex = reorderedColumn.findIndex(rp => rp.id === p.id);
            return { ...p, order: newIndex };
          }
          return p;
        });

        saveSettings(newPlacements, hiddenWidgets);
        return newPlacements;
      }

      // Different column - move to position
      const targetColumn = overWidget.column;
      const targetColumnWidgets = prev
        .filter(p => p.column === targetColumn)
        .sort((a, b) => a.order - b.order);
      
      const overIndex = targetColumnWidgets.findIndex(p => p.id === overId);

      // Remove from source column and recalculate orders
      const newPlacements = prev.map(p => {
        if (p.id === activeId) {
          return { ...p, column: targetColumn, order: overIndex };
        }
        // Shift items in target column that are at or after the drop position
        if (p.column === targetColumn && p.order >= overIndex) {
          return { ...p, order: p.order + 1 };
        }
        return p;
      });

      // Recalculate source column orders
      const sourceColumnWidgets = newPlacements
        .filter(p => p.column === activeWidget.column && p.id !== activeId)
        .sort((a, b) => a.order - b.order);
      
      const finalPlacements = newPlacements.map(p => {
        if (p.column === activeWidget.column && p.id !== activeId) {
          const newOrder = sourceColumnWidgets.findIndex(sp => sp.id === p.id);
          return { ...p, order: newOrder };
        }
        return p;
      });

      saveSettings(finalPlacements, hiddenWidgets);
      return finalPlacements;
    });
  }, [hiddenWidgets, saveSettings]);

  // Move widget up within column
  const moveWidgetUp = useCallback((widgetId: string) => {
    setPlacements(prev => {
      const widget = prev.find(p => p.id === widgetId);
      if (!widget || widget.order <= 0) return prev;
      
      const columnWidgets = prev.filter(p => p.column === widget.column).sort((a, b) => a.order - b.order);
      const currentIndex = columnWidgets.findIndex(p => p.id === widgetId);
      if (currentIndex <= 0) return prev;
      
      const newPlacements = prev.map(p => {
        if (p.id === widgetId) {
          return { ...p, order: widget.order - 1 };
        }
        if (p.column === widget.column && p.id === columnWidgets[currentIndex - 1].id) {
          return { ...p, order: p.order + 1 };
        }
        return p;
      });
      
      saveSettings(newPlacements, hiddenWidgets);
      return newPlacements;
    });
  }, [hiddenWidgets, saveSettings]);

  // Move widget down within column
  const moveWidgetDown = useCallback((widgetId: string) => {
    setPlacements(prev => {
      const widget = prev.find(p => p.id === widgetId);
      if (!widget) return prev;
      
      const columnWidgets = prev.filter(p => p.column === widget.column).sort((a, b) => a.order - b.order);
      const currentIndex = columnWidgets.findIndex(p => p.id === widgetId);
      if (currentIndex >= columnWidgets.length - 1) return prev;
      
      const newPlacements = prev.map(p => {
        if (p.id === widgetId) {
          return { ...p, order: widget.order + 1 };
        }
        if (p.column === widget.column && p.id === columnWidgets[currentIndex + 1].id) {
          return { ...p, order: p.order - 1 };
        }
        return p;
      });
      
      saveSettings(newPlacements, hiddenWidgets);
      return newPlacements;
    });
  }, [hiddenWidgets, saveSettings]);

  // Move widget to other column
  const moveWidgetToColumn = useCallback((widgetId: string, targetColumn: WidgetColumn) => {
    setPlacements(prev => {
      const widget = prev.find(p => p.id === widgetId);
      if (!widget || widget.column === targetColumn) return prev;
      
      const targetColumnWidgets = prev.filter(p => p.column === targetColumn);
      const maxOrder = targetColumnWidgets.length > 0 
        ? Math.max(...targetColumnWidgets.map(p => p.order)) + 1 
        : 0;
      
      const newPlacements = prev.map(p => {
        if (p.id === widgetId) {
          return { ...p, column: targetColumn, order: maxOrder };
        }
        return p;
      });
      
      saveSettings(newPlacements, hiddenWidgets);
      return newPlacements;
    });
  }, [hiddenWidgets, saveSettings]);

  // Toggle widget visibility
  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setHiddenWidgets(prev => {
      const newHidden = prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId];
      saveSettings(placements, newHidden);
      return newHidden;
    });
  }, [placements, saveSettings]);

  // Check if widget is visible
  const isWidgetVisible = useCallback((widgetId: string) => {
    return !hiddenWidgets.includes(widgetId);
  }, [hiddenWidgets]);

  // Get widget placement
  const getWidgetPlacement = useCallback((widgetId: string) => {
    return placements.find(p => p.id === widgetId);
  }, [placements]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    setPlacements(DEFAULT_PLACEMENTS);
    setHiddenWidgets([]);
    saveSettings(DEFAULT_PLACEMENTS, []);
  }, [saveSettings]);

  return {
    placements,
    hiddenWidgets,
    loading,
    saving,
    getWidgetsForColumn,
    handleDragEnd,
    moveWidgetUp,
    moveWidgetDown,
    moveWidgetToColumn,
    toggleWidgetVisibility,
    isWidgetVisible,
    getWidgetPlacement,
    resetToDefault,
  };
}
