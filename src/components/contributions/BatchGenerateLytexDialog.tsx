import { useState, useEffect, useMemo } from "react";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { toast } from "sonner";
import { Loader2, FileWarning, Receipt, CheckCircle2, XCircle, AlertTriangle, Filter } from "lucide-react";
import { formatCompetence } from "@/lib/competence-format";

interface ContributionWithoutInvoice {
  id: string;
  value: number;
  due_date: string;
  competence_month: number;
  competence_year: number;
  status: string;
  employer_id: string | null;
  member_id: string | null;
  contribution_type_id: string;
  employers?: {
    id: string;
    name: string;
    cnpj: string;
    email?: string | null;
    phone?: string | null;
    registration_number?: string | null;
  } | null;
  patients?: {
    id: string;
    name: string;
    cpf?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  contribution_types?: {
    id: string;
    name: string;
  } | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface BatchGenerateLytexDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  yearFilter?: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function BatchGenerateLytexDialog({
  open,
  onOpenChange,
  onSuccess,
  yearFilter,
}: BatchGenerateLytexDialogProps) {
  const { currentClinic } = useAuth();
  const { validateSession } = useSessionValidator();
  const [contributions, setContributions] = useState<ContributionWithoutInvoice[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] });
  const [showResults, setShowResults] = useState(false);

  // Filtros
  const [personTypeFilter, setPersonTypeFilter] = useState<"all" | "pf" | "pj">("all");
  const [competenceFilter, setCompetenceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "overdue">("all");
  const [internalYearFilter, setInternalYearFilter] = useState<number | null>(yearFilter ?? null);

  // Anos disponíveis para seleção
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i);

  useEffect(() => {
    if (open) {
      setInternalYearFilter(yearFilter ?? null);
    }
  }, [open, yearFilter]);

  useEffect(() => {
    if (open && currentClinic) {
      fetchContributionsWithoutInvoice();
      fetchContributionTypes();
    }
  }, [open, currentClinic, internalYearFilter]);

  const fetchContributionTypes = async () => {
    if (!currentClinic) return;
    const { data } = await supabase
      .from("contribution_types")
      .select("id, name")
      .eq("clinic_id", currentClinic.id)
      .eq("is_active", true)
      .order("name");
    setContributionTypes(data || []);
  };

  const fetchContributionsWithoutInvoice = async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      let query = supabase
        .from("employer_contributions")
        .select(`
          id, value, due_date, competence_month, competence_year, status, employer_id, member_id, contribution_type_id,
          employers(id, name, cnpj, email, phone, registration_number),
          patients(id, name, cpf, email, phone),
          contribution_types(id, name)
        `)
        .eq("clinic_id", currentClinic.id)
        .is("lytex_invoice_id", null)
        .gt("value", 0)
        .in("status", ["pending", "overdue"])
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (internalYearFilter) {
        query = query.eq("competence_year", internalYearFilter);
      }

      const { data, error } = await query.limit(1000);

      if (error) throw error;
      setContributions(data || []);
    } catch (error) {
      console.error("Erro ao buscar contribuições:", error);
      toast.error("Erro ao carregar contribuições sem boleto");
    } finally {
      setLoading(false);
    }
  };

  // Competências disponíveis para filtro
  const availableCompetences = useMemo(() => {
    const set = new Set<string>();
    contributions.forEach((c) => {
      set.add(`${c.competence_month}-${c.competence_year}`);
    });
    return Array.from(set)
      .map((key) => {
        const [month, year] = key.split("-").map(Number);
        return { key, month, year, label: formatCompetence(month, year) };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }, [contributions]);

  // Aplicar filtros
  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      // Filtro PF/PJ
      if (personTypeFilter === "pf" && !c.member_id) return false;
      if (personTypeFilter === "pj" && c.member_id) return false;

      // Filtro de competência
      if (competenceFilter !== "all") {
        const key = `${c.competence_month}-${c.competence_year}`;
        if (key !== competenceFilter) return false;
      }

      // Filtro de tipo
      if (typeFilter !== "all" && c.contribution_type_id !== typeFilter) return false;

      // Filtro de status
      if (statusFilter !== "all" && c.status !== statusFilter) return false;

      return true;
    });
  }, [contributions, personTypeFilter, competenceFilter, typeFilter, statusFilter]);

  // Atualizar seleção quando filtros mudarem
  useEffect(() => {
    const filteredIds = new Set(filteredContributions.map((c) => c.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (filteredIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredContributions]);

  const groupedContributions = useMemo(() => {
    const grouped: Record<string, ContributionWithoutInvoice[]> = {};
    filteredContributions.forEach((c) => {
      const key = formatCompetence(c.competence_month, c.competence_year);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    return grouped;
  }, [filteredContributions]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredContributions.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma contribuição");
      return;
    }

    const isSessionValid = await validateSession();
    if (!isSessionValid) return;

    setProcessing(true);
    setProgress(0);
    setResults({ success: 0, errors: [] });

    const selected = filteredContributions.filter((c) => selectedIds.has(c.id));
    const total = selected.length;
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const contribution = selected[i];
      try {
        const isPF = !!contribution.member_id;
        const typeName = contribution.contribution_types?.name || "Contribuição";
        const description = `${typeName} - ${MONTHS[contribution.competence_month - 1]}/${contribution.competence_year}`;

        const body: Record<string, unknown> = {
          action: "create_invoice",
          contributionId: contribution.id,
          clinicId: currentClinic?.id,
          value: contribution.value,
          dueDate: contribution.due_date,
          description,
          enableBoleto: true,
          enablePix: true,
        };

        if (isPF && contribution.patients) {
          body.member = {
            cpf: contribution.patients.cpf,
            name: contribution.patients.name,
            email: contribution.patients.email,
            phone: contribution.patients.phone,
          };
        } else if (contribution.employers) {
          body.employer = {
            cnpj: contribution.employers.cnpj,
            name: contribution.employers.name,
            email: contribution.employers.email,
            phone: contribution.employers.phone,
          };
          body.registrationNumber = contribution.employers.registration_number;
        }

        const { data, error } = await supabase.functions.invoke("lytex-api", { body });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Atualizar contribuição com dados do boleto
        const updateData: Record<string, unknown> = {
          lytex_invoice_id: data.lytexInvoiceId || data._id,
          lytex_invoice_url: data.invoiceUrl,
          lytex_boleto_barcode: data.boleto?.barCode || null,
          lytex_boleto_digitable_line: data.boleto?.digitableLine || null,
          lytex_pix_code: data.pix?.code || null,
          lytex_pix_qrcode: data.pix?.qrCode || null,
        };

        // Se estava overdue e agora tem boleto, muda para pending
        if (contribution.status === "overdue") {
          updateData.status = "pending";
        }

        await supabase
          .from("employer_contributions")
          .update(updateData)
          .eq("id", contribution.id);

        successCount++;
      } catch (err: unknown) {
        const name = contribution.employers?.name || contribution.patients?.name || contribution.id;
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        errors.push(`${name}: ${msg}`);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResults({ success: successCount, errors });
    setShowResults(true);
    setProcessing(false);

    if (successCount > 0) {
      toast.success(`${successCount} boleto(s) gerado(s) com sucesso!`);
      onSuccess?.();
    }
    if (errors.length > 0) {
      toast.warning(`${errors.length} erro(s) durante a geração`);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setShowResults(false);
      setResults({ success: 0, errors: [] });
      setPersonTypeFilter("all");
      setCompetenceFilter("all");
      setTypeFilter("all");
      setStatusFilter("all");
      onOpenChange(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  const allSelected = filteredContributions.length > 0 && selectedIds.size === filteredContributions.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredContributions.length;

  const totalValue = filteredContributions
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum + c.value, 0);

  return (
    <PopupBase open={open} onClose={handleClose} maxWidth="3xl" className="flex flex-col max-h-[90vh]">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Gerar Boletos na Lytex em Lote
        </PopupTitle>
        <PopupDescription>
          Selecione as contribuições sem boleto. Use os filtros para localizar registros específicos.
        </PopupDescription>
      </PopupHeader>

      {showResults ? (
        <div className="flex-1 space-y-4 py-4">
          <div className="text-center space-y-2">
            {results.success > 0 && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{results.success} boleto(s) gerado(s) com sucesso</span>
              </div>
            )}
            {results.errors.length > 0 && (
              <div className="flex items-center justify-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">{results.errors.length} erro(s)</span>
              </div>
            )}
          </div>

          {results.errors.length > 0 && (
            <ScrollArea className="h-48 border rounded-md p-3">
              <div className="space-y-1 text-sm">
                {results.errors.map((error, i) => (
                  <div key={i} className="flex items-start gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <PopupFooter>
            <Button onClick={handleClose}>Fechar</Button>
          </PopupFooter>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contributions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileWarning className="h-12 w-12 mb-2" />
              <p>Nenhuma contribuição sem boleto encontrada</p>
              <p className="text-sm">Todas as contribuições já possuem boleto gerado</p>
            </div>
          ) : (
            <>
              {/* Barra de Filtros */}
              <div className="flex flex-wrap items-center gap-2 py-2 border-b">
                <Filter className="h-4 w-4 text-muted-foreground" />

                <Select 
                  value={internalYearFilter?.toString() ?? "all"} 
                  onValueChange={(v) => setInternalYearFilter(v === "all" ? null : Number(v))}
                >
                  <SelectTrigger className="w-[90px] h-8 text-xs">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={personTypeFilter} onValueChange={(v) => setPersonTypeFilter(v as "all" | "pf" | "pj")}>
                  <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                    <SelectItem value="pf">PF</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={competenceFilter} onValueChange={setCompetenceFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue placeholder="Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableCompetences.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Tipo Contrib." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Tipos</SelectItem>
                    {contributionTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "pending" | "overdue")}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                  </SelectContent>
                </Select>

                <Badge variant="outline" className="ml-auto text-xs">
                  {filteredContributions.length} de {contributions.length}
                </Badge>
              </div>

              {processing && (
                <div className="space-y-2 py-4">
                  <div className="flex justify-between text-sm">
                    <span>Gerando boletos...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <div className="flex items-center gap-2 py-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                  disabled={processing || filteredContributions.length === 0}
                />
                <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Selecionar todos ({filteredContributions.length})
                </Label>
                {someSelected && (
                  <Badge variant="secondary">{selectedIds.size} selecionado(s)</Badge>
                )}
                {selectedIds.size > 0 && (
                  <Badge variant="default" className="ml-auto">
                    Total: {formatCurrency(totalValue)}
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 h-[350px]">
                <div className="space-y-4 pr-4">
                  {Object.entries(groupedContributions).map(([competence, items]) => (
                    <div key={competence} className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground sticky top-0 bg-background py-1 z-10">
                        Competência {competence} ({items.length})
                      </h4>
                      <div className="space-y-1">
                        {items.map((contribution) => {
                          const isPF = !!contribution.member_id;
                          const name = isPF
                            ? contribution.patients?.name
                            : contribution.employers?.name;
                          const doc = isPF
                            ? contribution.patients?.cpf
                            : contribution.employers?.cnpj;

                          return (
                            <div
                              key={contribution.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                            >
                              <Checkbox
                                id={contribution.id}
                                checked={selectedIds.has(contribution.id)}
                                onCheckedChange={(checked) => toggleOne(contribution.id, !!checked)}
                                disabled={processing}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{name}</span>
                                  <Badge variant={isPF ? "secondary" : "outline"} className="text-xs shrink-0">
                                    {isPF ? "PF" : "PJ"}
                                  </Badge>
                                  {contribution.status === "overdue" && (
                                    <Badge variant="destructive" className="text-xs shrink-0">
                                      Atrasado
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                                  <span>{doc}</span>
                                  <span>•</span>
                                  <span>{formatCurrency(contribution.value)}</span>
                                  <span>•</span>
                                  <span>Venc: {new Date(contribution.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {filteredContributions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhuma contribuição encontrada com os filtros aplicados</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <PopupFooter className="pt-4 border-t">
                <Button variant="outline" onClick={handleClose} disabled={processing}>
                  Cancelar
                </Button>
                <Button onClick={handleGenerate} disabled={processing || selectedIds.size === 0}>
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Receipt className="h-4 w-4 mr-2" />
                      Gerar {selectedIds.size} Boleto(s)
                    </>
                  )}
                </Button>
              </PopupFooter>
            </>
          )}
        </>
      )}
    </PopupBase>
  );
}
