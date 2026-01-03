import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  User,
  Calendar,
  Stethoscope,
  Pill,
  ClipboardList,
  MessageSquare,
  History,
} from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";

interface MedicalRecord {
  id: string;
  record_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  notes: string | null;
  created_at: string;
  professional: {
    id: string;
    name: string;
  } | null;
  appointment?: {
    type: string;
    appointment_date?: string;
  } | null;
}

interface PatientMedicalHistoryProps {
  records: MedicalRecord[];
  loading?: boolean;
  patientName?: string;
}

const typeLabels: Record<string, string> = {
  first_visit: "1ª Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
  telemedicine: "Telemedicina",
};

const typeColors: Record<string, string> = {
  first_visit: "bg-primary/10 text-primary",
  return: "bg-secondary text-secondary-foreground",
  exam: "bg-accent/50 text-accent-foreground",
  procedure: "bg-muted text-muted-foreground",
  telemedicine: "bg-primary/10 text-primary",
};

export function PatientMedicalHistory({ 
  records, 
  loading = false,
}: PatientMedicalHistoryProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
        <p className="text-xs">Carregando histórico...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-2 opacity-30" />
        <h3 className="text-sm font-medium mb-1">Nenhum histórico</h3>
        <p className="text-xs">Sem prontuários registrados.</p>
      </div>
    );
  }

  const hasContent = (record: MedicalRecord) => {
    return record.chief_complaint || record.diagnosis || record.treatment_plan || record.prescription || record.notes;
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span className="font-medium">{records.length} prontuário(s)</span>
        </div>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpandedItems(records.map(r => r.id))} 
            className="text-xs h-6 px-2"
          >
            Expandir
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpandedItems([])} 
            className="text-xs h-6 px-2"
          >
            Recolher
          </Button>
        </div>
      </div>

      {/* Accordion List */}
      <ScrollArea className="h-[calc(100vh-420px)]">
        <Accordion 
          type="multiple" 
          value={expandedItems}
          onValueChange={setExpandedItems}
          className="space-y-1"
        >
          {records.map((record) => {
            const raw =
              record.appointment?.appointment_date ||
              record.record_date ||
              record.created_at;

            // Prefer date-only when available; avoid timezone shifts.
            const normalized = (raw || "").includes("T") ? (raw || "").split("T")[0] : (raw || "");

            // Supports: YYYY-MM-DD (default) and dd/MM/yyyy (imports)
            const recordDate = normalized.includes("/")
              ? parse(normalized, "dd/MM/yyyy", new Date())
              : (() => {
                  const [y, m, d] = normalized.split("-").map((n) => Number(n));
                  return new Date(y, (m || 1) - 1, d || 1);
                })();

            const appointmentType = record.appointment?.type || "return";

            return (
              <AccordionItem 
                key={record.id} 
                value={record.id}
                className="border rounded-md bg-card px-3 py-0 data-[state=open]:bg-muted/30"
              >
                <AccordionTrigger className="py-2 hover:no-underline gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    {/* Date */}
                    <div className="flex items-center gap-1.5 min-w-[90px]">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(recordDate, "dd/MM/yyyy")}
                      </span>
                    </div>

                    {/* Type Badge */}
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5 font-normal",
                        typeColors[appointmentType] || "bg-muted text-muted-foreground"
                      )}
                    >
                      {typeLabels[appointmentType] || appointmentType}
                    </Badge>

                    {/* Professional */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{record.professional?.name || "—"}</span>
                    </div>

                    {/* Preview */}
                    {record.chief_complaint && (
                      <span className="text-xs text-muted-foreground truncate hidden md:block">
                        • {record.chief_complaint.slice(0, 40)}{record.chief_complaint.length > 40 ? "..." : ""}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>

                {hasContent(record) && (
                  <AccordionContent className="pt-2 pb-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {record.chief_complaint && (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
                            <ClipboardList className="h-3 w-3" />
                            Queixa
                          </div>
                          <p className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap">
                            {record.chief_complaint}
                          </p>
                        </div>
                      )}

                      {record.diagnosis && (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
                            <Stethoscope className="h-3 w-3" />
                            Diagnóstico
                          </div>
                          <p className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap">
                            {record.diagnosis}
                          </p>
                        </div>
                      )}

                      {record.treatment_plan && (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
                            <FileText className="h-3 w-3" />
                            Tratamento
                          </div>
                          <p className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap">
                            {record.treatment_plan}
                          </p>
                        </div>
                      )}

                      {record.prescription && (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
                            <Pill className="h-3 w-3" />
                            Prescrição
                          </div>
                          <p className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap font-mono">
                            {record.prescription}
                          </p>
                        </div>
                      )}

                      {record.notes && (
                        <div className="space-y-0.5 md:col-span-2">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
                            <MessageSquare className="h-3 w-3" />
                            Observações
                          </div>
                          <p className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap">
                            {record.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}