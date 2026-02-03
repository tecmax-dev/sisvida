import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageCircle,
  Mail,
  Printer,
  ChevronDown,
  Plus,
  Receipt,
  Link2,
  FileStack,
  CheckSquare,
  RefreshCw,
  Handshake,
  Loader2,
  Zap,
} from "lucide-react";

interface UnionContributionsBatchActionsProps {
  selectedCount: number;
  totalEligible: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onPrint: () => void;
  onSync: () => void;
  syncing: boolean;
  onCreatePJ: () => void;
  onCreateWithoutValue?: () => void;
  onBulkGenerate: () => void;
  onNegotiate?: () => void;
  onBatchGenerateLytex?: () => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  documentType: "pj" | "pf" | "awaiting";
  onCreatePF?: () => void;
}

export default function UnionContributionsBatchActions({
  selectedCount,
  totalEligible,
  allSelected,
  onSelectAll,
  onWhatsApp,
  onEmail,
  onPrint,
  onSync,
  syncing,
  onCreatePJ,
  onCreateWithoutValue,
  onBulkGenerate,
  onNegotiate,
  onBatchGenerateLytex,
  itemsPerPage,
  onItemsPerPageChange,
  documentType,
  onCreatePF,
}: UnionContributionsBatchActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 bg-muted/30 rounded-lg border border-border/50">
      {/* Left side: Items per page and selection */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Exibir:</span>
          <Select 
            value={String(itemsPerPage)} 
            onValueChange={(v) => onItemsPerPageChange(Number(v))}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {totalEligible > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={allSelected ? "secondary" : "outline"}
                  size="sm"
                  onClick={onSelectAll}
                  className={allSelected ? "bg-primary/10 text-primary border-primary/30" : ""}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {allSelected ? "Desmarcar" : "Selecionar"} Todos
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {totalEligible}
                  </Badge>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {allSelected
                  ? "Desmarcar todas as contribuições"
                  : `Selecionar ${totalEligible} contribuições elegíveis`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-2">
        {/* Sync */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                Sincronizar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sincronizar status com Lytex</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* WhatsApp */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onWhatsApp}
                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {selectedCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar boletos via WhatsApp</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Email */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onEmail}
                className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    {selectedCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar boletos por Email</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Print */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onPrint}
                disabled={selectedCount === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {selectedCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gerar PDF dos boletos selecionados</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Negotiate - only for PJ */}
        {documentType === "pj" && onNegotiate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNegotiate}
                  className="text-indigo-600 border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                >
                  <Handshake className="h-4 w-4 mr-2" />
                  Negociar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Criar negociação de débitos</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Generate Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Gerar
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {documentType === "pf" && onCreatePF ? (
              <DropdownMenuItem onClick={onCreatePF}>
                <Receipt className="h-4 w-4 mr-2" />
                Nova Contribuição PF
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={onCreatePJ}>
                  <Receipt className="h-4 w-4 mr-2" />
                  Nova Contribuição (com valor)
                </DropdownMenuItem>
                {onCreateWithoutValue && (
                  <DropdownMenuItem onClick={onCreateWithoutValue}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Nova Contribuição (sem valor)
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onBulkGenerate}>
              <FileStack className="h-4 w-4 mr-2" />
              Gerar em Lote
            </DropdownMenuItem>
            {onBatchGenerateLytex && (
              <DropdownMenuItem onClick={onBatchGenerateLytex} className="text-amber-600">
                <Zap className="h-4 w-4 mr-2" />
                Gerar Boletos Pendentes
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
