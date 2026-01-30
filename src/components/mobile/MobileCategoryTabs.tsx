import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  Stethoscope, 
  Smile, 
  Sparkles, 
  Heart, 
  Hand 
} from "lucide-react";

export type SpecialtyCategory = 'medical' | 'dental' | 'aesthetic' | 'therapy' | 'massage';

interface CategoryConfig {
  id: SpecialtyCategory;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export const MOBILE_CATEGORIES: CategoryConfig[] = [
  { id: 'medical', label: 'Médico', shortLabel: 'Médico', icon: Stethoscope, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  { id: 'dental', label: 'Odontológico', shortLabel: 'Odonto', icon: Smile, color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200' },
  { id: 'aesthetic', label: 'Estética', shortLabel: 'Estética', icon: Sparkles, color: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-200' },
  { id: 'therapy', label: 'Terapias', shortLabel: 'Terapia', icon: Heart, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  { id: 'massage', label: 'Massoterapia', shortLabel: 'Massagem', icon: Hand, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
];

interface MobileCategoryTabsProps {
  activeCategory: SpecialtyCategory;
  onCategoryChange: (category: SpecialtyCategory) => void;
  categoryCounts: Record<SpecialtyCategory, number>;
}

export function MobileCategoryTabs({ 
  activeCategory, 
  onCategoryChange,
  categoryCounts 
}: MobileCategoryTabsProps) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {MOBILE_CATEGORIES.map((category) => {
        const Icon = category.icon;
        const count = categoryCounts[category.id] || 0;
        const isActive = activeCategory === category.id;
        
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg border transition-all",
              "text-[10px] font-medium active:scale-95",
              isActive
                ? `${category.bgColor} ${category.color} shadow-sm`
                : "bg-card text-muted-foreground border-border"
            )}
          >
            <div className="relative">
              <Icon className="h-4 w-4" />
              {count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "absolute -top-1.5 -right-2.5 h-3.5 min-w-3.5 px-1 text-[8px] justify-center",
                    isActive ? "bg-white/80" : ""
                  )}
                >
                  {count}
                </Badge>
              )}
            </div>
            <span className="truncate w-full text-center">{category.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
