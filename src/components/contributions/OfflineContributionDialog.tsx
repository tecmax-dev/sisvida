import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileX, Building2, CheckCircle2, Tag, AlertTriangle, CalendarIcon, Search } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  category_id?: string | null;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  default_value: number;
  is_active: boolean;
}

interface OfflineContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employers: Employer[];
  contributionTypes: ContributionType[];
  clinicId: string;
  userId: string;
  onRefresh: () => void;
  categories?: Category[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function OfflineContributionDialog({
  open,
  onOpenChange,
  employers,
  contributionTypes,
  clinicId,
  userId,
  onRefresh,
  categories = [],
}: OfflineContributionDialogProps) {
  const [step, setStep] = useState<"config" | "processing" | "result">("config");
  
  // Form state
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [typeId, setTypeId] = useState("");
  
  // Competência inicial e final (para gerar múltiplos meses)
  const defaultStartDate = subMonths(new Date(), 12);
  const [startMonth, setStartMonth] = useState(defaultStartDate.getMonth() + 1);
  const [startYear, setStartYear] = useState(defaultStartDate.getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  
  const [useDefaultValue, setUseDefaultValue] = useState(true);
  const [customValue, setCustomValue] = useState("");
  const [notes, setNotes] = useState("Débito retroativo - Aguardando negociação");
  
  // Substituir contribuições existentes (cancelar anterior)
  const [replaceExisting, setReplaceExisting] = useState(false);
  
  // Modo de data de vencimento: 'lastDay' | 'fixed' | 'sequential'
  const [dueDateMode, setDueDateMode] = useState<'lastDay' | 'fixed' | 'sequential'>('lastDay');
  const [customDueDate, setCustomDueDate] = useState<Date | undefined>(undefined);
  const [sequentialDay, setSequentialDay] = useState(10);
  const [sequentialStartDate, setSequentialStartDate] = useState<Date | undefined>(undefined);
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; failed: number; skipped: number; replaced: number; errors: string[] }>({ 
    success: 0, 
    failed: 0, 
    skipped: 0,
    replaced: 0,
    errors: [] 
  });

  // Filter employers
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      setSearchTerm(value);
    }, 300);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  // Gerar lista de competências
  const competenceList = useMemo(() => {
    const list: { month: number; year: number }[] = [];
    let current = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth - 1, 1);
    
    while (current <= end) {
      list.push({ month: current.getMonth() + 1, year: current.getFullYear() });
      current.setMonth(current.getMonth() + 1);
    }
    
    return list;
  }, [startMonth, startYear, endMonth, endYear]);

  const filteredEmployers = useMemo(() => {
    return employers.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           emp.cnpj.includes(searchTerm.replace(/\D/g, ""));
      const matchesCategory = categoryFilter === "all" || emp.category_id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [employers, searchTerm, categoryFilter]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep("config");
      setSelectedEmployers([]);
      setSelectAll(false);
      setTypeId("");
      const defaultStart = subMonths(new Date(), 12);
      setStartMonth(defaultStart.getMonth() + 1);
      setStartYear(defaultStart.getFullYear());
      setEndMonth(new Date().getMonth() + 1);
      setEndYear(new Date().getFullYear());
      setUseDefaultValue(true);
      setCustomValue("");
      setNotes("Débito retroativo - Aguardando negociação");
      setReplaceExisting(false);
      setDueDateMode('lastDay');
      setCustomDueDate(undefined);
      setSequentialDay(10);
      setSequentialStartDate(undefined);
      setSearchTerm("");
      setCategoryFilter("all");
      setResults({ success: 0, failed: 0, skipped: 0, replaced: 0, errors: [] });
    }
  }, [open]);

  const handleToggleEmployer = (id: string) => {
    setSelectedEmployers(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployers([]);
    } else {
      setSelectedEmployers(filteredEmployers.map(e => e.id));
    }
    setSelectAll(!selectAll);
  };

  const formatCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "");
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const handleGenerate = async () => {
    if (!typeId) {
      toast.error("Selecione o tipo de contribuição");
      return;
    }
    if (selectedEmployers.length === 0) {
      toast.error("Selecione pelo menos uma empresa");
      return;
    }
    if (competenceList.length === 0) {
      toast.error("O período de competência é inválido");
      return;
    }

    const selectedType = contributionTypes.find(t => t.id === typeId);
    let valueInCents: number;
    
    if (useDefaultValue && selectedType) {
      valueInCents = selectedType.default_value;
    } else {
      valueInCents = Math.round(parseFloat(customValue.replace(",", ".")) * 100);
    }

    if (isNaN(valueInCents) || valueInCents <= 0) {
      toast.error("O valor deve ser maior que zero");
      return;
    }

    setStep("processing");
    setProcessing(true);
    
    const totalItems = selectedEmployers.length * competenceList.length;
    setProgress({ current: 0, total: totalItems });
    
    let success = 0;
    let failed = 0;
    let skipped = 0;
    let replaced = 0;
    const errors: string[] = [];

    for (const employerId of selectedEmployers) {
      const employer = employers.find(e => e.id === employerId);
      
      for (let compIndex = 0; compIndex < competenceList.length; compIndex++) {
        const competence = competenceList[compIndex];
        try {
          // Gerar data de vencimento baseado no modo selecionado
          let dueDateStr: string;
          
          // Data mínima válida: primeiro dia do mês de competência
          const competenceStartDate = new Date(competence.year, competence.month - 1, 1);
          
          if (dueDateMode === 'fixed' && customDueDate) {
            // Data fixa para todos
            dueDateStr = format(customDueDate, "yyyy-MM-dd");
          } else if (dueDateMode === 'sequential' && sequentialStartDate) {
            // Data base sequencial: incrementa o mês a partir da data inicial
            const baseDate = new Date(sequentialStartDate);
            baseDate.setMonth(baseDate.getMonth() + compIndex);
            // Garantir que o dia não ultrapasse o último dia do mês
            const maxDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
            baseDate.setDate(Math.min(sequentialDay, maxDay));
            dueDateStr = format(baseDate, "yyyy-MM-dd");
          } else {
            // Último dia do mês de competência (padrão)
            const dueDate = new Date(competence.year, competence.month, 0);
            dueDateStr = format(dueDate, "yyyy-MM-dd");
          }
          
          // VALIDAÇÃO: Vencimento não pode ser anterior ao mês de competência
          const generatedDueDate = new Date(dueDateStr);
          if (generatedDueDate < competenceStartDate) {
            console.warn(`[Validação] Vencimento ${dueDateStr} anterior à competência ${competence.month}/${competence.year}. Corrigindo para último dia do mês.`);
            const correctedDueDate = new Date(competence.year, competence.month, 0);
            dueDateStr = format(correctedDueDate, "yyyy-MM-dd");
          }
          
          // Verificar se existe contribuição ativa para esta competência
          const { data: existing } = await supabase
            .from("employer_contributions")
            .select("id")
            .eq("employer_id", employerId)
            .eq("contribution_type_id", typeId)
            .eq("competence_month", competence.month)
            .eq("competence_year", competence.year)
            .neq("status", "cancelled")
            .maybeSingle();
          
          if (existing) {
            if (replaceExisting) {
              // Cancelar a contribuição existente para liberar a chave única
              const { error: cancelError } = await supabase
                .from("employer_contributions")
                .update({ status: "cancelled" })
                .eq("id", existing.id);
              
              if (cancelError) {
                throw new Error(`Erro ao cancelar existente: ${cancelError.message}`);
              }
              replaced++;
            } else {
              // Pular se não for para substituir
              skipped++;
              setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              continue;
            }
          }
          
          // Inserir contribuição offline (sem dados Lytex)
          // Nota: active_competence_key é uma coluna gerada automaticamente pelo banco
          const { error } = await supabase
            .from("employer_contributions")
            .insert({
              clinic_id: clinicId,
              employer_id: employerId,
              contribution_type_id: typeId,
              competence_month: competence.month,
              competence_year: competence.year,
              value: valueInCents,
              due_date: dueDateStr,
              status: "overdue", // Já nasce como vencida pois é retroativa
              notes: notes || null,
              created_by: userId,
            });

          if (error) {
            throw error;
          }

          success++;
        } catch (error: any) {
          failed++;
          const monthName = MONTHS[competence.month - 1];
          errors.push(`${employer?.name || 'Empresa'} (${monthName}/${competence.year}): ${error.message}`);
        }

        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
    }

    setResults({ success, failed, skipped, replaced, errors });
    setProcessing(false);
    setStep("result");
    
    if (success > 0) {
      onRefresh();
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5 text-orange-500" />
            Lançar Débitos Retroativos (Offline)
          </DialogTitle>
          <DialogDescription>
            Crie contribuições históricas sem integração Lytex. Ideal para débitos antigos que serão negociados.
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <>
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-4">
                {/* Aviso */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Estas contribuições serão criadas <strong>sem boleto</strong> e com status <strong>vencido</strong>. 
                  Use para registrar débitos históricos que serão incluídos em negociações de acordo.
                </p>
              </div>

              {/* Busca de Empresa - DESTAQUE */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <Label className="text-blue-700 dark:text-blue-300 font-medium">
                    Buscar Empresa por Nome ou CNPJ
                  </Label>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Input
                      ref={searchInputRef}
                      placeholder="Digite nome, razão social ou CNPJ (ex: 12.345.678/0001-90)..."
                      defaultValue=""
                      onChange={handleSearchChange}
                      className="pl-10 bg-white dark:bg-background border-blue-300 dark:border-blue-700 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                  </div>
                  
                  {categories.length > 0 && (
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-48 border-blue-300 dark:border-blue-700">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {filteredEmployers.length} empresa(s) encontrada(s)
                </p>
              </div>

              {/* Seleção de Empresas - logo após a busca */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Empresas ({selectedEmployers.length} selecionadas)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectAll ? "Desmarcar todas" : "Selecionar todas"}
                  </Button>
                </div>
                <ScrollArea className="h-[180px] border rounded-md p-2">
                  <div className="space-y-1">
                    {filteredEmployers.map(employer => (
                      <label
                        key={employer.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedEmployers.includes(employer.id)}
                          onCheckedChange={() => handleToggleEmployer(employer.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{employer.name}</span>
                            {employer.registration_number && (
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {employer.registration_number}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatCNPJ(employer.cnpj)}
                          </span>
                        </div>
                      </label>
                    ))}
                    {filteredEmployers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma empresa encontrada
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Tipo de Contribuição */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Tipo de Contribuição *</Label>
                  <Select value={typeId} onValueChange={setTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {contributionTypes.filter(t => t.is_active).map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Período de Competência */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Competência Inicial *</Label>
                  <div className="flex gap-2">
                    <Select value={String(startMonth)} onValueChange={v => setStartMonth(Number(v))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(startYear)} onValueChange={v => setStartYear(Number(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Competência Final *</Label>
                  <div className="flex gap-2">
                    <Select value={String(endMonth)} onValueChange={v => setEndMonth(Number(v))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(endYear)} onValueChange={v => setEndYear(Number(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Info de meses */}
              <div className="text-sm text-muted-foreground">
                Serão criadas <strong>{competenceList.length}</strong> contribuição(ões) por empresa selecionada.
              </div>

              {/* Substituir existente */}
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={replaceExisting}
                    onCheckedChange={(checked) => setReplaceExisting(!!checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Substituir contribuição existente (cancelar anterior)
                    </span>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                      Se já existir débito para o período, a anterior será cancelada e substituída pela nova
                    </p>
                  </div>
                </label>
              </div>

              {/* Valor */}
              <div className="space-y-2">
                <Label>Valor</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={useDefaultValue}
                      onCheckedChange={(checked) => setUseDefaultValue(!!checked)}
                    />
                    <span className="text-sm">Usar valor padrão do tipo</span>
                  </label>
                  {!useDefaultValue && (
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      className="w-32"
                    />
                  )}
                </div>
              </div>

              {/* Data de Vencimento */}
              <div className="space-y-3">
                <Label>Data de Vencimento</Label>
                
                {/* Opção 1: Último dia do mês */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dueDateMode"
                    checked={dueDateMode === 'lastDay'}
                    onChange={() => setDueDateMode('lastDay')}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-sm">Último dia do mês de competência</span>
                </label>
                
                {/* Opção 2: Data fixa */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dueDateMode"
                      checked={dueDateMode === 'fixed'}
                      onChange={() => setDueDateMode('fixed')}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Data fixa para todos os boletos</span>
                  </label>
                  {dueDateMode === 'fixed' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[240px] justify-start text-left font-normal ml-6",
                            !customDueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDueDate ? format(customDueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDueDate}
                          onSelect={setCustomDueDate}
                          initialFocus
                          className="pointer-events-auto"
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                
                {/* Opção 3: Data base sequencial */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dueDateMode"
                      checked={dueDateMode === 'sequential'}
                      onChange={() => setDueDateMode('sequential')}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Data base sequencial (vencimentos mensais)</span>
                  </label>
                  {dueDateMode === 'sequential' && (
                    <div className="ml-6 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Dia:</span>
                          <Select value={String(sequentialDay)} onValueChange={v => setSequentialDay(Number(v))}>
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                                <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">A partir de:</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-[160px] justify-start text-left font-normal",
                                  !sequentialStartDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {sequentialStartDate ? format(sequentialStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={sequentialStartDate}
                                onSelect={setSequentialStartDate}
                                initialFocus
                                className="pointer-events-auto"
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      
                      {/* Preview das datas */}
                      {sequentialStartDate && competenceList.length > 0 && (
                        <div className="bg-muted/50 rounded-md p-2">
                          <p className="text-xs text-muted-foreground mb-1">Preview dos vencimentos:</p>
                          <div className="flex flex-wrap gap-1">
                            {competenceList.slice(0, 6).map((comp, idx) => {
                              const baseDate = new Date(sequentialStartDate);
                              baseDate.setMonth(baseDate.getMonth() + idx);
                              const maxDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
                              baseDate.setDate(Math.min(sequentialDay, maxDay));
                              return (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {format(baseDate, "dd/MM/yy")}
                                </Badge>
                              );
                            })}
                            {competenceList.length > 6 && (
                              <Badge variant="outline" className="text-xs">
                                +{competenceList.length - 6} mais
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Débito retroativo - Aguardando negociação"
                  rows={2}
                />
              </div>

              </div>
            </ScrollArea>

            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate}
                disabled={!typeId || selectedEmployers.length === 0 || competenceList.length === 0}
              >
                <FileX className="h-4 w-4 mr-2" />
                Lançar {selectedEmployers.length * competenceList.length} Débito(s)
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Lançando débitos...</p>
            <p className="text-sm text-muted-foreground">
              {progress.current} de {progress.total}
            </p>
            <div className="w-full max-w-xs bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="flex-1 space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 text-lg font-medium">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Processo concluído
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <p className="text-xl font-bold text-green-600">{results.success}</p>
                <p className="text-xs text-muted-foreground">Criados</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <p className="text-xl font-bold text-blue-600">{results.replaced}</p>
                <p className="text-xs text-muted-foreground">Substituídos</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <p className="text-xl font-bold text-yellow-600">{results.skipped}</p>
                <p className="text-xs text-muted-foreground">Ignorados</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <p className="text-xl font-bold text-red-600">{results.failed}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="text-sm font-medium text-destructive mb-2">Erros:</p>
                <ScrollArea className="h-32">
                  <ul className="text-xs space-y-1">
                    {results.errors.map((error, i) => (
                      <li key={i} className="text-destructive/80">{error}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
