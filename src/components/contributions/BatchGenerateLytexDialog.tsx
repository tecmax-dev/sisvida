import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { toast } from "sonner";
import { Loader2, FileWarning, Receipt, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] });
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (open && currentClinic) {
      fetchContributionsWithoutInvoice();
    }
  }, [open, currentClinic, yearFilter]);

  const fetchContributionsWithoutInvoice = async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      let query = supabase
        .from("employer_contributions")
        .select(`
          id, value, due_date, competence_month, competence_year, status, employer_id, member_id,
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

      if (yearFilter) {
        query = query.eq("competence_year", yearFilter);
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;
      setContributions(data || []);
      setSelectedIds(new Set((data || []).map((c) => c.id)));
    } catch (error) {
      console.error("Erro ao buscar contribuições:", error);
      toast.error("Erro ao carregar contribuições sem boleto");
    } finally {
      setLoading(false);
    }
  };

  const groupedContributions = useMemo(() => {
    const grouped: Record<string, ContributionWithoutInvoice[]> = {};
    contributions.forEach((c) => {
      const key = formatCompetence(c.competence_month, c.competence_year);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    return grouped;
  }, [contributions]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(contributions.map((c) => c.id)));
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

    const selected = contributions.filter((c) => selectedIds.has(c.id));
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
      onOpenChange(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  const allSelected = contributions.length > 0 && selectedIds.size === contributions.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < contributions.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Gerar Boletos na Lytex em Lote
          </DialogTitle>
          <DialogDescription>
            Selecione as contribuições que deseja gerar boletos na Lytex.
            {yearFilter && ` Filtrando por ano: ${yearFilter}`}
          </DialogDescription>
        </DialogHeader>

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

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
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
                    disabled={processing}
                  />
                  <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Selecionar todos ({contributions.length})
                  </Label>
                  {someSelected && (
                    <Badge variant="secondary">{selectedIds.size} selecionado(s)</Badge>
                  )}
                </div>

                <ScrollArea className="flex-1 max-h-[400px]">
                  <div className="space-y-4 pr-4">
                    {Object.entries(groupedContributions).map(([competence, items]) => (
                      <div key={competence} className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground sticky top-0 bg-background py-1">
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
                                    <Badge variant={isPF ? "secondary" : "outline"} className="text-xs">
                                      {isPF ? "PF" : "PJ"}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex gap-2">
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
                  </div>
                </ScrollArea>

                <DialogFooter className="pt-4 border-t">
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
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
