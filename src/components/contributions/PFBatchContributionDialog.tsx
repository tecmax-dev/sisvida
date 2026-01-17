import { useState, useEffect } from "react";
import { getStaticYearRange } from "@/hooks/useAvailableYears";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  Loader2, 
  Check, 
  ChevronsUpDown, 
  User, 
  Plus, 
  Trash2, 
  Calendar,
  RotateCcw,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths, addDays, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { extractFunctionsError } from "@/lib/functionsError";
import { Progress } from "@/components/ui/progress";

interface Member {
  id: string;
  name: string;
  cpf: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  is_active: boolean;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  member_id?: string | null;
}

interface InstallmentItem {
  id: string;
  month: number;
  year: number;
  dueDate: string;
  isCustomDate: boolean;
}

interface PFBatchContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributionTypes: ContributionType[];
  clinicId: string;
  userId: string;
  onRefresh: () => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function PFBatchContributionDialog({
  open,
  onOpenChange,
  contributionTypes,
  clinicId,
  userId,
  onRefresh,
}: PFBatchContributionDialogProps) {
  const [step, setStep] = useState<"config" | "processing" | "result">("config");
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Form states
  const [formMemberId, setFormMemberId] = useState("");
  const [formTypeId, setFormTypeId] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formNotes, setFormNotes] = useState("");
  
  // Installments/Parcels
  const [installments, setInstallments] = useState<InstallmentItem[]>([]);
  const [baseMonth, setBaseMonth] = useState(new Date().getMonth() + 1);
  const [baseYear, setBaseYear] = useState(new Date().getFullYear());
  const [baseDueDate, setBaseDueDate] = useState(format(addDays(new Date(), 10), "yyyy-MM-dd"));
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ 
    success: number; 
    failed: number; 
    boletoSuccess: number;
    boletoFailed: number;
    errors: string[] 
  }>({ success: 0, failed: 0, boletoSuccess: 0, boletoFailed: 0, errors: [] });

  // Member combobox
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const { validateSession } = useSessionValidator();

  // Fetch members when dialog opens
  useEffect(() => {
    if (open && clinicId) {
      fetchMembers();
      resetForm();
    }
  }, [open, clinicId]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      // Fetch all members with pagination to overcome 1000 row limit
      let allMembers: Member[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("patients")
          .select("id, name, cpf, email, phone")
          .eq("clinic_id", clinicId)
          .not("cpf", "is", null)
          .order("name")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allMembers = [...allMembers, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      setMembers(allMembers);
      console.log(`[PFBatchContributionDialog] Loaded ${allMembers.length} members`);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Erro ao carregar sócios");
    } finally {
      setLoadingMembers(false);
    }
  };

  const resetForm = () => {
    setStep("config");
    setFormMemberId("");
    setFormTypeId("");
    setFormValue("");
    setFormNotes("");
    setInstallments([]);
    setBaseMonth(new Date().getMonth() + 1);
    setBaseYear(new Date().getFullYear());
    setBaseDueDate(format(addDays(new Date(), 10), "yyyy-MM-dd"));
    setResults({ success: 0, failed: 0, boletoSuccess: 0, boletoFailed: 0, errors: [] });
  };

  const handleTypeChange = (typeId: string) => {
    setFormTypeId(typeId);
    const type = contributionTypes.find((t) => t.id === typeId);
    if (type && type.default_value > 0) {
      setFormValue((type.default_value / 100).toFixed(2).replace(".", ","));
    }
  };

  // Add a new installment based on the last one
  const addInstallment = () => {
    const lastInstallment = installments[installments.length - 1];
    
    let newMonth: number;
    let newYear: number;
    let newDueDate: string;
    
    if (lastInstallment) {
      // Calculate next month/year
      const nextDate = addMonths(new Date(lastInstallment.year, lastInstallment.month - 1), 1);
      newMonth = nextDate.getMonth() + 1;
      newYear = nextDate.getFullYear();
      
      // Calculate due date - add 1 month to last due date
      const lastDueDate = parse(lastInstallment.dueDate, "yyyy-MM-dd", new Date());
      newDueDate = format(addMonths(lastDueDate, 1), "yyyy-MM-dd");
    } else {
      newMonth = baseMonth;
      newYear = baseYear;
      newDueDate = baseDueDate;
    }
    
    setInstallments([
      ...installments,
      {
        id: crypto.randomUUID(),
        month: newMonth,
        year: newYear,
        dueDate: newDueDate,
        isCustomDate: false,
      }
    ]);
  };

  // Remove an installment
  const removeInstallment = (id: string) => {
    setInstallments(installments.filter(i => i.id !== id));
  };

  // Update installment due date
  const updateInstallmentDueDate = (id: string, newDate: string) => {
    setInstallments(installments.map(i => 
      i.id === id ? { ...i, dueDate: newDate, isCustomDate: true } : i
    ));
  };

  // Reset installment to auto-calculated date
  const resetInstallmentDate = (id: string, index: number) => {
    const firstDueDate = parse(installments[0]?.dueDate || baseDueDate, "yyyy-MM-dd", new Date());
    const autoDate = format(addMonths(firstDueDate, index), "yyyy-MM-dd");
    
    setInstallments(installments.map(i => 
      i.id === id ? { ...i, dueDate: autoDate, isCustomDate: false } : i
    ));
  };

  // Get or create placeholder employer for PF contributions
  const getOrCreatePlaceholderEmployer = async () => {
    const { data: existing } = await supabase
      .from("employers")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("cnpj", "00000000000000")
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from("employers")
      .insert({
        clinic_id: clinicId,
        name: "Contribuições Pessoa Física",
        cnpj: "00000000000000",
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw new Error("Erro ao configurar contribuição PF");
    return created.id;
  };

  const handleGenerate = async () => {
    if (!formMemberId) {
      toast.error("Selecione um sócio");
      return;
    }
    if (!formTypeId) {
      toast.error("Selecione o tipo de contribuição");
      return;
    }
    if (!formValue) {
      toast.error("Informe o valor da contribuição");
      return;
    }
    if (installments.length === 0) {
      toast.error("Adicione pelo menos uma parcela");
      return;
    }

    const selectedMember = members.find(m => m.id === formMemberId);
    if (!selectedMember?.cpf) {
      toast.error("Sócio selecionado não possui CPF cadastrado");
      return;
    }

    const isSessionValid = await validateSession();
    if (!isSessionValid) return;

    setStep("processing");
    setProcessing(true);
    setProgress({ current: 0, total: installments.length });
    setResults({ success: 0, failed: 0, boletoSuccess: 0, boletoFailed: 0, errors: [] });

    const valueInCents = Math.round(parseFloat(formValue.replace(",", ".")) * 100);
    const selectedType = contributionTypes.find(t => t.id === formTypeId);

    let successCount = 0;
    let failedCount = 0;
    let boletoSuccessCount = 0;
    let boletoFailedCount = 0;
    const errors: string[] = [];

    try {
      const placeholderEmployerId = await getOrCreatePlaceholderEmployer();

      for (let i = 0; i < installments.length; i++) {
        const installment = installments[i];
        const competenceLabel = `${String(installment.month).padStart(2, "0")}/${installment.year}`;

        try {
          // Create contribution
          const { data: newContribution, error: insertError } = await supabase
            .from("employer_contributions")
            .insert({
              clinic_id: clinicId,
              employer_id: placeholderEmployerId,
              member_id: formMemberId,
              contribution_type_id: formTypeId,
              competence_month: installment.month,
              competence_year: installment.year,
              value: valueInCents,
              due_date: installment.dueDate,
              notes: formNotes || null,
              created_by: userId,
            })
            .select("*")
            .single();

          if (insertError) {
            if (insertError.message.includes("unique_active_contribution")) {
              throw new Error("Já existe contribuição para esta competência");
            }
            throw insertError;
          }

          successCount++;

          // Generate invoice
          if (newContribution && valueInCents > 0) {
            const { error: invoiceError } = await supabase.functions.invoke("lytex-api", {
              body: {
                action: "create_invoice",
                contributionId: newContribution.id,
                clinicId: clinicId,
                member: {
                  cpf: selectedMember.cpf,
                  name: selectedMember.name,
                  email: selectedMember.email,
                  phone: selectedMember.phone,
                },
                value: valueInCents,
                dueDate: installment.dueDate,
                description: `${selectedType?.name || "Contribuição PF"} - ${MONTHS[installment.month - 1]}/${installment.year}`,
                enableBoleto: true,
                enablePix: true,
              },
            });

            if (invoiceError) {
              const extracted = extractFunctionsError(invoiceError);
              console.error("Error generating invoice:", extracted);
              boletoFailedCount++;
              errors.push(`${competenceLabel}: Criado, mas boleto falhou - ${extracted.message}`);
            } else {
              boletoSuccessCount++;
            }
          }
        } catch (error: any) {
          failedCount++;
          errors.push(`${competenceLabel}: ${error.message || "Erro desconhecido"}`);
          console.error(`Error for installment ${i}:`, error);
        }

        setProgress({ current: i + 1, total: installments.length });
        setResults({ 
          success: successCount, 
          failed: failedCount, 
          boletoSuccess: boletoSuccessCount,
          boletoFailed: boletoFailedCount,
          errors 
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar contribuições");
    }

    setProcessing(false);
    setStep("result");
    
    if (successCount > 0) {
      if (boletoFailedCount > 0) {
        toast.warning(`${successCount} contribuições criadas. ${boletoSuccessCount} boletos gerados, ${boletoFailedCount} falharam.`);
      } else {
        toast.success(`${successCount} contribuições com boletos criados com sucesso!`);
      }
      onRefresh();
    }
  };

  const formatCPF = (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const selectedMember = members.find((m) => m.id === formMemberId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-600" />
            Gerar Contribuições PF em Lote
          </DialogTitle>
          <DialogDescription>
            {step === "config" && "Configure múltiplas contribuições para um sócio"}
            {step === "processing" && "Processando contribuições e gerando boletos..."}
            {step === "result" && "Resultado do processamento"}
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 py-4">
                {/* Sócio/Associado */}
                <div className="space-y-2">
                  <Label>Sócio/Associado *</Label>
                  <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={memberPopoverOpen}
                        className="w-full justify-between font-normal"
                        disabled={loadingMembers}
                      >
                        {loadingMembers ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando...
                          </span>
                        ) : formMemberId ? (
                          <span className="truncate">{selectedMember?.name}</span>
                        ) : (
                          "Selecione o sócio..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome ou CPF..." />
                        <CommandList>
                          <CommandEmpty>Nenhum sócio encontrado.</CommandEmpty>
                          <CommandGroup>
                            {members.map((member) => {
                              const formattedCpf = member.cpf ? formatCPF(member.cpf) : "";
                              return (
                                <CommandItem
                                  key={member.id}
                                  value={`${member.name} ${member.cpf || ""} ${formattedCpf}`}
                                  onSelect={() => {
                                    setFormMemberId(member.id);
                                    setMemberPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formMemberId === member.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{member.name}</span>
                                    {member.cpf && (
                                      <span className="text-xs text-emerald-600">
                                        {formatCPF(member.cpf)}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedMember?.cpf && (
                    <p className="text-xs text-muted-foreground">
                      CPF: <span className="font-medium text-emerald-600">{formatCPF(selectedMember.cpf)}</span>
                    </p>
                  )}
                </div>

                {/* Tipo e Valor */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Contribuição *</Label>
                    <Select value={formTypeId} onValueChange={handleTypeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {contributionTypes
                          .filter((t) => t.is_active)
                          .map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$) *</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                    />
                  </div>
                </div>

                {/* Base para primeira parcela */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <Label className="text-sm font-medium">Configuração Base</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Mês Inicial</Label>
                      <Select value={String(baseMonth)} onValueChange={(v) => setBaseMonth(parseInt(v))}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => (
                            <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ano</Label>
                      <Select value={String(baseYear)} onValueChange={(v) => setBaseYear(parseInt(v))}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getStaticYearRange().map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vencimento</Label>
                      <Input
                        type="date"
                        className="h-9"
                        value={baseDueDate}
                        onChange={(e) => setBaseDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Parcelas/Competências */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Parcelas/Competências</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addInstallment}
                      className="h-8"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {installments.length === 0 ? (
                    <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma parcela adicionada</p>
                      <p className="text-xs">Clique em "Adicionar" para incluir competências</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {installments.map((installment, index) => (
                        <div
                          key={installment.id}
                          className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border"
                        >
                          <Badge variant="outline" className="shrink-0">
                            {index + 1}
                          </Badge>
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-muted-foreground">Comp:</span>
                              <span className="font-medium">
                                {String(installment.month).padStart(2, "0")}/{installment.year}
                              </span>
                            </div>
                            <div className="col-span-2 flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Venc:</span>
                              <Input
                                type="date"
                                className="h-8 flex-1"
                                value={installment.dueDate}
                                onChange={(e) => updateInstallmentDueDate(installment.id, e.target.value)}
                              />
                              {installment.isCustomDate && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => resetInstallmentDate(installment.id, index)}
                                  title="Restaurar data automática"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {installment.isCustomDate && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              editado
                            </Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => removeInstallment(installment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label>Observações (aplicada a todas)</Label>
                  <Input
                    type="text"
                    placeholder="Observações opcionais"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={installments.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Gerar {installments.length} Boleto{installments.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-2">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-purple-600" />
              <p className="text-lg font-medium">Processando contribuições...</p>
              <p className="text-sm text-muted-foreground">
                {progress.current} de {progress.total}
              </p>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{results.success}</p>
                <p className="text-xs text-muted-foreground">Criados</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-lg">
                <p className="text-2xl font-bold text-rose-600">{results.failed}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                <p className="text-2xl font-bold text-emerald-600">{results.success}</p>
                <p className="text-sm text-muted-foreground">Contribuições Criadas</p>
                <p className="text-xs text-emerald-600 mt-1">
                  {results.boletoSuccess} boletos gerados
                </p>
              </div>
              <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
                <XCircle className="h-8 w-8 mx-auto mb-2 text-rose-600" />
                <p className="text-2xl font-bold text-rose-600">{results.failed}</p>
                <p className="text-sm text-muted-foreground">Falhas</p>
                {results.boletoFailed > 0 && (
                  <p className="text-xs text-rose-600 mt-1">
                    {results.boletoFailed} boletos não gerados
                  </p>
                )}
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-destructive">Erros encontrados:</Label>
                <ScrollArea className="h-32 border rounded-lg p-2">
                  <ul className="space-y-1 text-xs">
                    {results.errors.map((error, i) => (
                      <li key={i} className="text-destructive">• {error}</li>
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
