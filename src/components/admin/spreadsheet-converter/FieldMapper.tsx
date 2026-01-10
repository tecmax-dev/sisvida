import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowRight, Wand2, RotateCcw, ChevronDown, ChevronRight, Asterisk } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
}

interface FieldMapperProps {
  sourceColumns: string[];
  targetFields: { key: string; label: string; required?: boolean }[];
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  autoDetectedMappings?: FieldMapping[];
}

export function FieldMapper({
  sourceColumns,
  targetFields,
  mappings,
  onMappingsChange,
  autoDetectedMappings = [],
}: FieldMapperProps) {
  const [optionalOpen, setOptionalOpen] = useState(false);

  const handleMapping = (targetField: string, sourceColumn: string) => {
    const actualValue = sourceColumn === '__none__' ? '' : sourceColumn;
    const newMappings = mappings.filter(m => m.targetField !== targetField);
    if (actualValue) {
      newMappings.push({ sourceColumn: actualValue, targetField });
    }
    onMappingsChange(newMappings);
  };

  const applyAutoDetection = () => {
    onMappingsChange(autoDetectedMappings);
  };

  const clearMappings = () => {
    onMappingsChange([]);
  };

  const getMappedSource = (targetField: string): string => {
    return mappings.find(m => m.targetField === targetField)?.sourceColumn || '';
  };

  const requiredFields = targetFields.filter(f => f.required);
  const optionalFields = targetFields.filter(f => !f.required);
  const mappedCount = mappings.length;

  const renderFieldRow = (target: { key: string; label: string; required?: boolean }) => {
    const mappedSource = getMappedSource(target.key);
    
    return (
      <div
        key={target.key}
        className={cn(
          "grid grid-cols-[1fr,24px,1fr] gap-3 items-center py-2 px-3 rounded-md transition-colors",
          mappedSource ? "bg-primary/5" : "hover:bg-muted/50"
        )}
      >
        {/* Target Field */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium truncate">{target.label}</span>
          {target.required && (
            <Asterisk className="h-3 w-3 text-destructive flex-shrink-0" />
          )}
        </div>

        {/* Arrow */}
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 justify-self-center" />

        {/* Source Column Selector */}
        <Select
          value={mappedSource || '__none__'}
          onValueChange={(value) => handleMapping(target.key, value)}
        >
          <SelectTrigger 
            className={cn(
              "h-9 text-sm",
              mappedSource && "border-primary/50 bg-primary/5"
            )}
          >
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">Não mapear</span>
            </SelectItem>
            {sourceColumns.map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Compact Toolbar */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={applyAutoDetection}
            disabled={autoDetectedMappings.length === 0}
            className="h-8 text-xs"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Auto ({autoDetectedMappings.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMappings}
            disabled={mappings.length === 0}
            className="h-8 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Limpar
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {mappedCount}/{targetFields.length} mapeados
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr,24px,1fr] gap-3 px-3 pb-2 border-b">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Campo do Sistema
        </span>
        <span></span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Coluna da Planilha
        </span>
      </div>

      {/* Required Fields */}
      {requiredFields.length > 0 && (
        <div className="space-y-1">
          {requiredFields.map(renderFieldRow)}
        </div>
      )}

      {/* Optional Fields - Collapsible */}
      {optionalFields.length > 0 && (
        <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-9 text-muted-foreground hover:text-foreground"
            >
              {optionalOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="text-sm">
                Campos opcionais ({optionalFields.length})
              </span>
              {optionalFields.filter(f => getMappedSource(f.key)).length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {optionalFields.filter(f => getMappedSource(f.key)).length} mapeados
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pt-2">
            {optionalFields.map(renderFieldRow)}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
