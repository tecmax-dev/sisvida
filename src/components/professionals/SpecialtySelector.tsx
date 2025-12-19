import { useState, useCallback } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Specialty,
  SpecialtyCategory,
  GroupedSpecialties,
} from "@/hooks/useSpecialties";
import { cn } from "@/lib/utils";

interface SpecialtySelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  groupedSpecialties: GroupedSpecialties[];
  loading: boolean;
  getSpecialtyById: (id: string) => Specialty | undefined;
  disabled?: boolean;
}

const CATEGORY_COLORS: Record<SpecialtyCategory, string> = {
  medical: "bg-blue-100 text-blue-800 border-blue-200",
  dental: "bg-emerald-100 text-emerald-800 border-emerald-200",
  aesthetic: "bg-pink-100 text-pink-800 border-pink-200",
  therapy: "bg-purple-100 text-purple-800 border-purple-200",
  massage: "bg-amber-100 text-amber-800 border-amber-200",
};

export function SpecialtySelector({
  selectedIds,
  onChange,
  groupedSpecialties,
  loading,
  getSpecialtyById,
  disabled = false,
}: SpecialtySelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<SpecialtyCategory[]>([]);

  const handleToggle = useCallback((specialtyId: string) => {
    if (disabled) return;

    if (selectedIds.includes(specialtyId)) {
      onChange(selectedIds.filter((id) => id !== specialtyId));
    } else {
      onChange([...selectedIds, specialtyId]);
    }
  }, [disabled, selectedIds, onChange]);

  const toggleCategory = useCallback((category: SpecialtyCategory) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const getSelectedSpecialties = useCallback(() => {
    return selectedIds
      .map((id) => getSpecialtyById(id))
      .filter((s): s is Specialty => !!s && !!s.category);
  }, [selectedIds, getSpecialtyById]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-3">
        <Label>Especialidades</Label>
        <div className="flex items-center justify-center py-4 border rounded-md">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Defensive check: if groupedSpecialties is not valid, show error state
  if (!groupedSpecialties || !Array.isArray(groupedSpecialties)) {
    return (
      <div className="space-y-3">
        <Label>Especialidades</Label>
        <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
          Erro ao carregar especialidades. Tente recarregar a página.
        </div>
      </div>
    );
  }

  // Check if there are any specialties at all
  const totalSpecialties = groupedSpecialties.reduce(
    (acc, group) => acc + (group.specialties?.length || 0),
    0
  );

  if (totalSpecialties === 0) {
    return (
      <div className="space-y-3">
        <Label>Especialidades</Label>
        <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
          Nenhuma especialidade disponível
        </div>
      </div>
    );
  }

  const selectedSpecialties = getSelectedSpecialties();

  return (
    <div className="space-y-3">
      <Label>Especialidades</Label>

      {selectedIds.length > 0 && selectedSpecialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-md">
          {selectedSpecialties.map((specialty) => {
            const categoryColor = specialty.category ? CATEGORY_COLORS[specialty.category] : "";
            return (
              <Badge
                key={specialty.id}
                variant="outline"
                className={cn("text-xs cursor-pointer hover:opacity-80", categoryColor)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(specialty.id);
                }}
              >
                {specialty.name}
                {!disabled && <span className="ml-1">×</span>}
              </Badge>
            );
          })}
        </div>
      )}

      <ScrollArea className="h-[200px] border rounded-md p-2">
        <div className="space-y-1">
          {groupedSpecialties.map(({ category, label, specialties: catSpecialties }) => {
            // Skip categories with no specialties
            if (!catSpecialties || catSpecialties.length === 0) return null;

            const isExpanded = expandedCategories.includes(category);
            const selectedCount = catSpecialties.filter((s) => selectedIds.includes(s.id)).length;

            return (
              <Collapsible
                key={category}
                open={isExpanded}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger
                  disabled={disabled}
                  className={cn(
                    "w-full",
                    "flex items-center justify-between gap-2 rounded-md px-2 h-8",
                    "text-sm text-foreground",
                    "transition-colors hover:bg-muted",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {label}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {selectedCount}/{catSpecialties.length}
                  </Badge>
                </CollapsibleTrigger>

                <CollapsibleContent className="pl-6 space-y-1 mt-1">
                  {catSpecialties.map((specialty) => {
                    const isSelected = selectedIds.includes(specialty.id);
                    
                    return (
                      <div
                        key={specialty.id}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded-md hover:bg-muted transition-colors",
                          isSelected && "bg-muted",
                          disabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <Checkbox
                          id={specialty.id}
                          checked={isSelected}
                          disabled={disabled}
                          onCheckedChange={() => {
                            handleToggle(specialty.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span 
                          className="flex-1 text-sm cursor-pointer select-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(specialty.id);
                          }}
                        >
                          {specialty.name}
                        </span>
                        {specialty.registration_prefix && (
                          <span className="text-xs text-muted-foreground">
                            {specialty.registration_prefix}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
