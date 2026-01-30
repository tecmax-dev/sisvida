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
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export const MOBILE_CATEGORIES: CategoryConfig[] = [
  { id: 'medical', label: 'Médico', icon: Stethoscope, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  { id: 'dental', label: 'Odonto', icon: Smile, color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200' },
  { id: 'aesthetic', label: 'Estética', icon: Sparkles, color: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-200' },
  { id: 'therapy', label: 'Terapias', icon: Heart, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  { id: 'massage', label: 'Massagem', icon: Hand, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
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
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {MOBILE_CATEGORIES.map((category) => {
        const Icon = category.icon;
        const count = categoryCounts[category.id] || 0;
        const isActive = activeCategory === category.id;
        
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all whitespace-nowrap",
              "text-sm font-medium flex-shrink-0",
              isActive
                ? `${category.bgColor} ${category.color} shadow-sm`
                : "bg-card text-muted-foreground border-border"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{category.label}</span>
            {count > 0 && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-0.5 h-5 min-w-5 px-1 text-xs justify-center",
                  isActive ? "bg-white/60" : ""
                )}
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
