import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface LytexReportCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  color?: string;
  count?: number;
  value?: string;
  isLoading?: boolean;
  onView?: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  disabled?: boolean;
}

export function LytexReportCard({
  title,
  description,
  icon,
  color = "bg-blue-500",
  count,
  value,
  isLoading = false,
  onView,
  onExportPDF,
  onExportExcel,
  disabled = false,
}: LytexReportCardProps) {
  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      disabled && "opacity-60"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center text-white",
            color
          )}>
            {icon}
          </div>
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {count} registros
            </Badge>
          )}
        </div>
        <CardTitle className="text-base mt-3">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {value && (
          <p className="text-lg font-semibold text-foreground mb-3">{value}</p>
        )}
        
        <div className="flex flex-wrap gap-2">
          {onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              disabled={disabled || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5 mr-1.5" />
              )}
              Visualizar
            </Button>
          )}
          
          {onExportPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPDF}
              disabled={disabled || isLoading}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
              PDF
            </Button>
          )}
          
          {onExportExcel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              disabled={disabled || isLoading}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Excel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
