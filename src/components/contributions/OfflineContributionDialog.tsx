import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, FileX, Building2, CheckCircle2, Tag, AlertTriangle } from "lucide-react";
import { format, subMonths } from "date-fns";
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
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; failed: number; skipped: number; errors: string[] }>({ 
    success: 0, 
    failed: 0, 
    skipped: 0,
    errors: [] 
  });

  // Filter employers
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
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
      setSearchTerm("");
      setCategoryFilter("all");
      setResults({ success: 0, failed: 0, skipped: 0, errors: [] });
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
    const errors: string[] = [];

    for (const employerId of selectedEmployers) {
      const employer = employers.find(e => e.id === employerId);
      
      for (const competence of competenceList) {
        try {
          // Gerar data de vencimento no último dia do mês de competência
          const dueDate = new Date(competence.year, competence.month, 0);
          const dueDateStr = format(dueDate, "yyyy-MM-dd");
          
          // Gerar active_competence_key para evitar duplicatas
          const activeCompetenceKey = `${employerId}-${typeId}-${competence.year}-${String(competence.month).padStart(2, "0")}`;
          
          // Verificar se já existe uma contribuição ativa para esta competência
          const { data: existing } = await supabase
            .from("employer_contributions")
            .select("id")
            .eq("active_competence_key", activeCompetenceKey)
            .maybeSingle();
          
          if (existing) {
            skipped++;
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            continue;
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

    setResults({ success, failed, skipped, errors });
    setProcessing(false);
    setStep("result");
    
    if (success > 0) {
      onRefresh();
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
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
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Aviso */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Estas contribuições serão criadas <strong>sem boleto</strong> e com status <strong>vencido</strong>. 
                  Use para registrar débitos históricos que serão incluídos em negociações de acordo.
                </p>
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

              {/* Filtros de Empresa */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Buscar empresa</Label>
                  <Input
                    placeholder="Nome ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {categories.length > 0 && (
                  <div>
                    <Label>Filtrar por categoria</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue />
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
                  </div>
                )}
              </div>

              {/* Seleção de Empresas */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <Label>Empresas ({selectedEmployers.length} selecionadas)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectAll ? "Desmarcar todas" : "Selecionar todas"}
                  </Button>
                </div>
                <ScrollArea className="flex-1 border rounded-md p-2 min-h-[200px]">
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
            </div>

            <DialogFooter>
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
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-green-500/10 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{results.success}</p>
                <p className="text-sm text-muted-foreground">Criados</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{results.skipped}</p>
                <p className="text-sm text-muted-foreground">Já existentes</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
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
