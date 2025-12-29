import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  StopCircle, 
  Users, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportProgressCardProps {
  isImporting: boolean;
  progress: number;
  importType: 'patients' | 'records' | 'combined' | 'contacts' | 'dependents';
  totalItems?: number;
  importedCount?: number;
  errorsCount?: number;
  isCancelled?: boolean;
  onCancel: () => void;
}

export function ImportProgressCard({
  isImporting,
  progress,
  importType,
  totalItems = 0,
  importedCount = 0,
  errorsCount = 0,
  isCancelled = false,
  onCancel,
}: ImportProgressCardProps) {
  if (!isImporting) return null;

  const getTypeInfo = () => {
    switch (importType) {
      case 'patients':
        return { icon: Users, label: 'Pacientes', color: 'text-primary' };
      case 'records':
        return { icon: FileText, label: 'Prontuários', color: 'text-secondary-foreground' };
      case 'combined':
        return { icon: Zap, label: 'Importação Combinada', color: 'text-primary' };
      case 'contacts':
        return { icon: Phone, label: 'Contatos', color: 'text-primary' };
      case 'dependents':
        return { icon: Users, label: 'Dependentes', color: 'text-primary' };
    }
  };

  const typeInfo = getTypeInfo();
  const TypeIcon = typeInfo.icon;
  const roundedProgress = Math.round(progress);
  const estimatedRemaining = totalItems > 0 && progress > 0 
    ? Math.ceil((totalItems - importedCount) * (100 / progress) / 100) 
    : null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg animate-in fade-in duration-300">
      <CardContent className="py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-xl bg-primary/10",
              isCancelled && "bg-warning/10"
            )}>
              {isCancelled ? (
                <StopCircle className="h-6 w-6 text-warning animate-pulse" />
              ) : (
                <TypeIcon className={cn("h-6 w-6", typeInfo.color)} />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {isCancelled ? 'Cancelando...' : `Importando ${typeInfo.label}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isCancelled 
                  ? 'Aguarde a conclusão da operação atual'
                  : 'Processando dados da planilha'
                }
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isCancelled}
            className={cn(
              "gap-2 transition-all",
              !isCancelled && "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
            )}
          >
            <StopCircle className="h-4 w-4" />
            {isCancelled ? 'Cancelando...' : 'Parar'}
          </Button>
        </div>

        {/* Progress Section */}
        <div className="space-y-4">
          {/* Main Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Progresso
              </span>
              <span className="font-bold text-xl text-primary">
                {roundedProgress}%
              </span>
            </div>
            
            <div className="relative">
              <Progress 
                value={progress} 
                className="h-4 bg-muted/50"
              />
              {/* Animated glow effect */}
              <div 
                className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse"
                style={{ 
                  width: `${progress}%`,
                  transition: 'width 0.3s ease-out'
                }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
            {/* Total Items */}
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                <FileText className="h-3.5 w-3.5" />
                Total
              </div>
              <span className="font-semibold text-lg">
                {totalItems > 0 ? totalItems.toLocaleString('pt-BR') : '-'}
              </span>
            </div>

            {/* Imported Count */}
            <div className="text-center p-3 rounded-lg bg-success/10">
              <div className="flex items-center justify-center gap-1.5 text-success text-xs mb-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Importados
              </div>
              <span className="font-semibold text-lg text-success">
                {importedCount > 0 ? importedCount.toLocaleString('pt-BR') : '-'}
              </span>
            </div>

            {/* Errors Count */}
            <div className="text-center p-3 rounded-lg bg-destructive/10">
              <div className="flex items-center justify-center gap-1.5 text-destructive text-xs mb-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Erros
              </div>
              <span className={cn(
                "font-semibold text-lg",
                errorsCount > 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                {errorsCount > 0 ? errorsCount.toLocaleString('pt-BR') : '0'}
              </span>
            </div>
          </div>

          {/* Estimated Time */}
          {estimatedRemaining && estimatedRemaining > 0 && !isCancelled && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <Clock className="h-4 w-4" />
              <span>Tempo estimado: ~{estimatedRemaining} segundos</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
