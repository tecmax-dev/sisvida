import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, History, Copy, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InheritableRecord {
  id: string;
  record_date: string;
  created_at: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription?: string | null;
  notes: string | null;
  professional?: { id: string; name: string } | null;
}

export interface RecordFormValues {
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  notes: string;
}

interface Props {
  records: InheritableRecord[];
  loading?: boolean;
  disabled?: boolean;
  onInherit: (values: Partial<RecordFormValues>, mode: "fill" | "replace") => void;
}

function formatRecordDate(raw: string) {
  const base = (raw || "").includes("T") ? raw.split("T")[0] : raw || "";
  const [y, m, d] = base.split("-").map(Number);
  if (!y) return "--/--/----";
  return `${String(d || 1).padStart(2, "0")}/${String(m || 1).padStart(2, "0")}/${y}`;
}

export function PreviousRecordsInherit({ records, loading = false, disabled = false, onInherit }: Props) {
  const [open, setOpen] = useState(false);
  const [lastUsedId, setLastUsedId] = useState<string | null>(null);

  if (loading) return null;
  if (!records || records.length === 0) return null;

  const toValues = (r: InheritableRecord): Partial<RecordFormValues> => ({
    chief_complaint: r.chief_complaint || "",
    diagnosis: r.diagnosis || "",
    treatment_plan: r.treatment_plan || "",
    notes: r.notes || "",
  });

  const handle = (r: InheritableRecord, mode: "fill" | "replace") => {
    onInherit(toValues(r), mode);
    setLastUsedId(r.id);
  };

  return (
    <Card className="border-dashed">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/40 transition-colors rounded-t-lg">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Prontuários anteriores
                <Badge variant="secondary" className="text-[10px]">{records.length}</Badge>
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <p className="text-xs text-muted-foreground mb-2">
              Herde os dados de um atendimento anterior para poupar digitação. Revise sempre antes de salvar.
            </p>
            <ScrollArea className="max-h-[320px] pr-2">
              <div className="space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="rounded-lg border p-2.5 space-y-2 bg-background">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{formatRecordDate(r.record_date || r.created_at)}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.professional?.name || "Profissional não informado"}
                      </span>
                      {lastUsedId === r.id && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <CheckCheck className="h-3 w-3" /> herdado
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {r.chief_complaint && <p className="line-clamp-2"><span className="font-medium">Queixa: </span>{r.chief_complaint}</p>}
                      {r.diagnosis && <p className="line-clamp-2"><span className="font-medium">Diagnóstico: </span>{r.diagnosis}</p>}
                      {r.treatment_plan && <p className="line-clamp-2"><span className="font-medium">Tratamento: </span>{r.treatment_plan}</p>}
                      {r.notes && <p className="line-clamp-2"><span className="font-medium">Obs: </span>{r.notes}</p>}
                      {!r.chief_complaint && !r.diagnosis && !r.treatment_plan && !r.notes && (
                        <p className="italic">Sem dados registrados.</p>
                      )}
                    </div>

                    {!disabled && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handle(r, "fill")}>
                          <Copy className="h-3 w-3 mr-1" />
                          Preencher campos vazios
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handle(r, "replace")}>
                          Substituir tudo
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}