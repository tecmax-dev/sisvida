import { useState, useEffect, useMemo } from "react";
import { getStaticYearRange } from "@/hooks/useAvailableYears";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, FileStack, Building2, CheckCircle2, Tag, Mail, Send } from "lucide-react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { extractFunctionsError } from "@/lib/functionsError";

interface CreatedContribution {
  id: string;
  public_access_token: string;
  employer: {
    id: string;
    name: string;
    email?: string | null;
    cnpj: string;
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  email?: string | null;
  category_id?: string | null;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  default_value: number;
  is_active: boolean;
}

interface BulkContributionDialogProps {
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

export default function BulkContributionDialog({
  open,
  onOpenChange,
  employers,
  contributionTypes,
  clinicId,
  userId,
  onRefresh,
  categories = [],
}: BulkContributionDialogProps) {
  const [step, setStep] = useState<"config" | "processing" | "result">("config");
  
  // Form state
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 10), "yyyy-MM-dd"));
  const [useDefaultValue, setUseDefaultValue] = useState(true);
  const [customValue, setCustomValue] = useState("");
  const [generateZero, setGenerateZero] = useState(false);
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({ 
    success: 0, 
    failed: 0, 
    errors: [] 
  });
  
  // Created contributions for email sending
  const [createdContributions, setCreatedContributions] = useState<CreatedContribution[]>([]);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailProgress, setEmailProgress] = useState({ current: 0, total: 0 });
  const [clinicName, setClinicName] = useState("");

  // Filter employers
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  const filteredEmployers = useMemo(() => {
    let filtered = employers;
    
    // Filter by category
    if (categoryFilter !== "all") {
      if (categoryFilter === "none") {
        filtered = filtered.filter(e => !e.category_id);
      } else {
        filtered = filtered.filter(e => e.category_id === categoryFilter);
      }
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(term) || 
        e.cnpj.includes(term.replace(/\D/g, "")) ||
        e.registration_number?.includes(term)
      );
    }
    
    return filtered;
  }, [employers, searchTerm, categoryFilter]);

  // Get default value from selected type
  const selectedType = contributionTypes.find(t => t.id === typeId);
  const valueToUse = useMemo(() => {
    if (generateZero) return 0;
    if (!useDefaultValue && customValue) {
      return Math.round(parseFloat(customValue.replace(",", ".")) * 100);
    }
    return selectedType?.default_value || 0;
  }, [generateZero, useDefaultValue, customValue, selectedType]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep("config");
      setSelectedEmployers([]);
      setSelectAll(false);
      setTypeId("");
      setMonth(new Date().getMonth() + 1);
      setYear(new Date().getFullYear());
      setDueDate(format(addDays(new Date(), 10), "yyyy-MM-dd"));
      setUseDefaultValue(true);
      setCustomValue("");
      setGenerateZero(false);
      setSearchTerm("");
      setCategoryFilter("all");
      setResults({ success: 0, failed: 0, errors: [] });
      setCreatedContributions([]);
      fetchClinicName();
    }
  }, [open]);

  const fetchClinicName = async () => {
    try {
      const { data } = await supabase
        .from("clinics")
        .select("name")
        .eq("id", clinicId)
        .single();
      if (data) setClinicName(data.name);
    } catch (error) {
      console.error("Error fetching clinic name:", error);
    }
  };

  // Handle select all - now respects category filter
  useEffect(() => {
    if (selectAll) {
      setSelectedEmployers(filteredEmployers.map(e => e.id));
    }
  }, [selectAll, filteredEmployers]);

  const handleToggleEmployer = (employerId: string) => {
    setSelectedEmployers(prev => 
      prev.includes(employerId) 
        ? prev.filter(id => id !== employerId)
        : [...prev, employerId]
    );
    if (selectAll) setSelectAll(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      // Select only filtered employers (respects category filter)
      setSelectedEmployers(filteredEmployers.map(e => e.id));
    } else {
      setSelectedEmployers([]);
    }
  };

  const { validateSession } = useSessionValidator();

  const handleGenerate = async () => {
    if (selectedEmployers.length === 0) {
      toast.error("Selecione pelo menos uma empresa");
      return;
    }
    if (!typeId) {
      toast.error("Selecione o tipo de contribuição");
      return;
    }
    if (!dueDate) {
      toast.error("Informe a data de vencimento");
      return;
    }

    // Verificar sessão antes de começar
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      return;
    }

    setStep("processing");
    setProcessing(true);
    setProgress({ current: 0, total: selectedEmployers.length });
    setResults({ success: 0, failed: 0, errors: [] });

    const finalValue = generateZero ? 0 : valueToUse;
    const status = generateZero || finalValue === 0 ? "awaiting_value" : "pending";

    let successCount = 0;
    let failedCount = 0;
    let boletoSuccessCount = 0;
    let boletoFailedCount = 0;
    const errors: string[] = [];
    let sessionExpired = false;
    const newCreatedContributions: CreatedContribution[] = [];

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < selectedEmployers.length; i++) {
      const employerId = selectedEmployers[i];
      const employer = employers.find(e => e.id === employerId);
      
      try {
        // Generate public token for zero value contributions
        const publicToken = (generateZero || finalValue === 0) 
          ? crypto.randomUUID() 
          : null;

        // Create contribution
        const { data: newContribution, error: insertError } = await supabase
          .from("employer_contributions")
          .insert({
            clinic_id: clinicId,
            employer_id: employerId,
            contribution_type_id: typeId,
            competence_month: month,
            competence_year: year,
            value: finalValue,
            due_date: dueDate,
            status: status,
            created_by: userId,
            public_access_token: publicToken,
          })
          .select(`
            *,
            employers (*)
          `)
          .single();

        if (insertError) {
          throw insertError;
        }

        successCount++;

        // Store for email sending if zero value
        if (publicToken && newContribution && employer) {
          newCreatedContributions.push({
            id: newContribution.id,
            public_access_token: publicToken,
            employer: {
              id: employer.id,
              name: employer.name,
              email: employer.email,
              cnpj: employer.cnpj,
            },
          });
        }

        // Generate boleto only if value > 0
        if (finalValue > 0 && newContribution) {
          const { data, error: invoiceError } = await supabase.functions.invoke("lytex-api", {
            body: {
              action: "create_invoice",
              contributionId: newContribution.id,
              clinicId: clinicId,
              employer: {
                cnpj: employer?.cnpj,
                name: employer?.name,
              },
              value: finalValue,
              dueDate: dueDate,
              description: `${selectedType?.name || "Contribuição"} - ${MONTHS[month - 1]}/${year}`,
              enableBoleto: true,
              enablePix: true,
            },
          });

          if (invoiceError) {
            const extracted = extractFunctionsError(invoiceError);
            console.error("Error generating invoice:", extracted);
            
            // Verificar se é erro de sessão expirada
            if (extracted.status === 401 || 
                extracted.message?.toLowerCase().includes("token") ||
                extracted.message?.toLowerCase().includes("unauthorized") ||
                extracted.message?.toLowerCase().includes("sessão")) {
              sessionExpired = true;
              toast.error("Sua sessão expirou. As contribuições foram criadas, mas os boletos não foram gerados. Faça login novamente.");
              break; // Interromper o processamento
            }
            
            boletoFailedCount++;
            errors.push(`${employer?.name}: Contribuição criada, mas erro ao gerar boleto - ${extracted.message}`);
          } else {
            boletoSuccessCount++;
          }
        }
      } catch (error: any) {
        failedCount++;
        const errorMsg = error.message?.includes("unique_active_contribution")
          ? `${employer?.name}: Contribuição já existe para este período`
          : `${employer?.name}: ${error.message || "Erro desconhecido"}`;
        errors.push(errorMsg);
        console.error(`Error for employer ${employerId}:`, error);
      }

      setProgress({ current: i + 1, total: selectedEmployers.length });
      setResults({ success: successCount, failed: failedCount, errors });

      // Se a sessão expirou, sair do loop
      if (sessionExpired) break;
    }

    setCreatedContributions(newCreatedContributions);
    setProcessing(false);
    setStep("result");
    
    // Mostrar resumo detalhado
    if (successCount > 0 && !sessionExpired) {
      if (boletoFailedCount > 0) {
        toast.warning(`${successCount} contribuições criadas. ${boletoSuccessCount} boletos gerados, ${boletoFailedCount} falharam.`);
      } else if (finalValue > 0) {
        toast.success(`${successCount} contribuições criadas com boletos gerados.`);
      } else if (newCreatedContributions.length > 0) {
        toast.success(`${successCount} contribuições criadas. Você pode enviar os links por email.`);
      }
      onRefresh();
    } else if (successCount > 0 && sessionExpired) {
      onRefresh();
    }
  };

  const handleSendBulkEmails = async () => {
    const contributionsWithEmail = createdContributions.filter(c => c.employer.email);
    
    if (contributionsWithEmail.length === 0) {
      toast.error("Nenhuma empresa possui email cadastrado");
      return;
    }

    setSendingEmails(true);
    setEmailProgress({ current: 0, total: contributionsWithEmail.length });

    let successCount = 0;
    let failedCount = 0;
    const baseUrl = window.location.origin;

    for (let i = 0; i < contributionsWithEmail.length; i++) {
      const contrib = contributionsWithEmail[i];
      const publicLink = `${baseUrl}/contribuicao/${contrib.public_access_token}`;

      try {
        const { error } = await supabase.functions.invoke("send-boleto-email", {
          body: {
            recipientEmail: contrib.employer.email,
            recipientName: contrib.employer.name,
            clinicName: clinicName || "Sindicato",
            boletos: [{
              employerName: contrib.employer.name,
              employerCnpj: contrib.employer.cnpj,
              contributionType: selectedType?.name || "Contribuição",
              competenceMonth: month,
              competenceYear: year,
              dueDate: dueDate,
              value: 0,
              status: "awaiting_value",
              invoiceUrl: publicLink,
              isAwaitingValue: true,
            }],
          },
        });

        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error(`Error sending email to ${contrib.employer.email}:`, error);
        failedCount++;
      }

      setEmailProgress({ current: i + 1, total: contributionsWithEmail.length });
    }

    setSendingEmails(false);

    if (successCount > 0) {
      toast.success(`${successCount} email(s) enviado(s) com sucesso!`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} email(s) falharam ao enviar.`);
    }
  };

  const handleSendSingleEmail = async (contrib: CreatedContribution) => {
    if (!contrib.employer.email) {
      toast.error("Esta empresa não possui email cadastrado");
      return;
    }

    const baseUrl = window.location.origin;
    const publicLink = `${baseUrl}/contribuicao/${contrib.public_access_token}`;

    try {
      const { error } = await supabase.functions.invoke("send-boleto-email", {
        body: {
          recipientEmail: contrib.employer.email,
          recipientName: contrib.employer.name,
          clinicName: clinicName || "Sindicato",
          boletos: [{
            employerName: contrib.employer.name,
            employerCnpj: contrib.employer.cnpj,
            contributionType: selectedType?.name || "Contribuição",
            competenceMonth: month,
            competenceYear: year,
            dueDate: dueDate,
            value: 0,
            status: "awaiting_value",
            invoiceUrl: publicLink,
            isAwaitingValue: true,
          }],
        },
      });

      if (error) throw error;
      toast.success(`Email enviado para ${contrib.employer.email}`);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Erro ao enviar email");
    }
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-primary" />
            Gerar Contribuições em Lote
          </DialogTitle>
          <DialogDescription>
            {step === "config" && "Selecione as empresas e configure os parâmetros da geração"}
            {step === "processing" && "Processando contribuições..."}
            {step === "result" && "Resultado da geração em lote"}
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <>
            <div className="grid gap-4 py-4">
              {/* Config Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Contribuição *</Label>
                  <Select value={typeId} onValueChange={setTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {contributionTypes.filter(t => t.is_active).map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vencimento *</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês Competência</Label>
                  <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getStaticYearRange().map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Value Options */}
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <Label className="text-sm font-medium">Valor da Contribuição</Label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="generateZero" 
                    checked={generateZero}
                    onCheckedChange={(checked) => {
                      setGenerateZero(!!checked);
                      if (checked) setUseDefaultValue(false);
                    }}
                  />
                  <label htmlFor="generateZero" className="text-sm cursor-pointer">
                    Gerar com valor R$ 0,00 (para definir posteriormente)
                  </label>
                </div>

                {!generateZero && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="useDefault" 
                        checked={useDefaultValue}
                        onCheckedChange={(checked) => setUseDefaultValue(!!checked)}
                      />
                      <label htmlFor="useDefault" className="text-sm cursor-pointer">
                        Usar valor padrão do tipo 
                        {selectedType && (
                          <span className="font-medium ml-1">
                            (R$ {(selectedType.default_value / 100).toFixed(2).replace(".", ",")})
                          </span>
                        )}
                      </label>
                    </div>

                    {!useDefaultValue && (
                      <div className="space-y-1">
                        <Label className="text-xs">Valor personalizado (R$)</Label>
                        <Input
                          placeholder="0,00"
                          value={customValue}
                          onChange={(e) => setCustomValue(e.target.value)}
                          className="w-40"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Employer Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Empresas</Label>
                  <Badge variant="secondary">
                    {selectedEmployers.length} de {filteredEmployers.length} selecionadas
                  </Badge>
                </div>
                
                {/* Category Filter */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Filtrar por categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
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
                
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="selectAll" 
                      checked={selectAll}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                    <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                      Selecionar todas {categoryFilter !== "all" && "(filtradas)"}
                    </label>
                  </div>
                  <Input
                    placeholder="Buscar por nome, CNPJ ou matrícula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 h-8"
                  />
                </div>

                <ScrollArea className="h-48 border rounded-md p-2">
                  <div className="space-y-1">
                    {filteredEmployers.map((employer) => (
                      <div
                        key={employer.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                          selectedEmployers.includes(employer.id) ? "bg-primary/10" : ""
                        }`}
                        onClick={() => handleToggleEmployer(employer.id)}
                      >
                        <Checkbox 
                          checked={selectedEmployers.includes(employer.id)}
                          onCheckedChange={() => handleToggleEmployer(employer.id)}
                        />
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{employer.name}</p>
                            {employer.registration_number && (
                              <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                {employer.registration_number}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatCNPJ(employer.cnpj)}</p>
                        </div>
                      </div>
                    ))}
                    {filteredEmployers.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-4">
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
                disabled={selectedEmployers.length === 0 || !typeId}
              >
                <FileStack className="h-4 w-4 mr-2" />
                Gerar {selectedEmployers.length} Contribuição(ões)
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="py-8 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Processando contribuições...</p>
              <p className="text-sm text-muted-foreground">
                {progress.current} de {progress.total}
              </p>
            </div>
            <div className="w-full max-w-xs bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {step === "result" && (
          <>
            <div className="py-6 space-y-4">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-2 mx-auto">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-green-600">{results.success}</p>
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                </div>
                {results.failed > 0 && (
                  <div className="text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-2 mx-auto">
                      <span className="text-2xl">❌</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                    <p className="text-sm text-muted-foreground">Falhas</p>
                  </div>
                )}
              </div>

              {results.errors.length > 0 && (
                <div className="mt-4">
                  <Label className="text-sm">Detalhes dos erros:</Label>
                  <ScrollArea className="h-32 border rounded-md p-2 mt-1 bg-muted/50">
                    {results.errors.map((error, i) => (
                      <p key={i} className="text-xs text-destructive py-1">• {error}</p>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {/* Email sending section for zero value contributions */}
              {createdContributions.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      Enviar Links por Email
                    </h4>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                    {createdContributions.filter(c => c.employer.email).length} de {createdContributions.length} empresas possuem email cadastrado.
                  </p>

                  {sendingEmails ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          Enviando emails... {emailProgress.current} de {emailProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(emailProgress.current / emailProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button 
                        onClick={handleSendBulkEmails}
                        disabled={createdContributions.filter(c => c.employer.email).length === 0}
                        className="w-full gap-2"
                        variant="default"
                      >
                        <Send className="h-4 w-4" />
                        Enviar Todos os Emails ({createdContributions.filter(c => c.employer.email).length})
                      </Button>

                      <div className="text-xs text-muted-foreground text-center">ou envie individualmente:</div>

                      <ScrollArea className="h-40 border rounded-md bg-background">
                        <div className="p-2 space-y-1">
                          {createdContributions.map((contrib) => (
                            <div 
                              key={contrib.id} 
                              className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{contrib.employer.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {contrib.employer.email || "Sem email"}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSendSingleEmail(contrib)}
                                disabled={!contrib.employer.email}
                                className="ml-2 shrink-0"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} disabled={sendingEmails}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
