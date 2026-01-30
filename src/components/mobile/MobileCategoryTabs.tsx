import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  { id: 'dental', label: 'Odontológico', icon: Smile, color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200' },
  { id: 'aesthetic', label: 'Estética', icon: Sparkles, color: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-200' },
  { id: 'therapy', label: 'Terapias', icon: Heart, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  { id: 'massage', label: 'Massoterapia', icon: Hand, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
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
  const activeConfig = MOBILE_CATEGORIES.find(c => c.id === activeCategory);
  const ActiveIcon = activeConfig?.icon || Stethoscope;

  return (
    <Select value={activeCategory} onValueChange={(v) => onCategoryChange(v as SpecialtyCategory)}>
      <SelectTrigger className={cn(
        "w-full h-11 text-sm font-medium",
        activeConfig?.bgColor,
        activeConfig?.color
      )}>
        <div className="flex items-center gap-2">
          <ActiveIcon className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {MOBILE_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = categoryCounts[category.id] || 0;
          
          return (
            <SelectItem 
              key={category.id} 
              value={category.id}
              className="py-2.5"
            >
              <div className="flex items-center gap-2 w-full">
                <Icon className={cn("h-4 w-4", category.color)} />
                <span className="flex-1">{category.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs justify-center ml-2">
                    {count}
                  </Badge>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
