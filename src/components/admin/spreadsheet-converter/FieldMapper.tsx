import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, Wand2, RotateCcw } from "lucide-react";
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
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);

  const handleMapping = (targetField: string, sourceColumn: string) => {
    const newMappings = mappings.filter(m => m.targetField !== targetField);
    if (sourceColumn) {
      newMappings.push({ sourceColumn, targetField });
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

  const isAutoDetected = (targetField: string): boolean => {
    return autoDetectedMappings.some(m => m.targetField === targetField);
  };

  const filteredTargetFields = showOnlyMapped
    ? targetFields.filter(f => getMappedSource(f.key) || f.required)
    : targetFields;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={applyAutoDetection}
            disabled={autoDetectedMappings.length === 0}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Autodetectar ({autoDetectedMappings.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMappings}
            disabled={mappings.length === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {mappings.length} de {targetFields.length} campos mapeados
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOnlyMapped(!showOnlyMapped)}
          >
            {showOnlyMapped ? 'Mostrar todos' : 'Mostrar mapeados'}
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {filteredTargetFields.map((target) => {
            const mappedSource = getMappedSource(target.key);
            const isAuto = isAutoDetected(target.key);

            return (
              <Card
                key={target.key}
                className={cn(
                  "transition-colors",
                  mappedSource && "border-primary/50 bg-primary/5"
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Target Field */}
                    <div className="flex-1 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{target.label}</span>
                        {target.required && (
                          <Badge variant="destructive" className="text-xs">
                            Obrigatório
                          </Badge>
                        )}
                        {isAuto && !mappedSource && (
                          <Badge variant="secondary" className="text-xs">
                            Sugestão
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{target.key}</span>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                    {/* Source Column Selector */}
                    <div className="flex-1 min-w-[200px]">
                      <Select
                        value={mappedSource}
                        onValueChange={(value) => handleMapping(target.key, value)}
                      >
                        <SelectTrigger className={cn(
                          mappedSource && "border-primary"
                        )}>
                          <SelectValue placeholder="Selecione a coluna..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
