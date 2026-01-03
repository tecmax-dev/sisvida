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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {records.length} registro(s)
        </span>
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
            const raw = record.record_date || record.created_at;
            const normalized = (raw || "").includes("T") ? (raw || "").split("T")[0] : (raw || "");
            const [y, m, d] = normalized.split("-").map((n) => Number(n));
            const recordDate = new Date(y, (m || 1) - 1, d || 1);

            return (
              <AccordionItem 
                key={record.id} 
                value={record.id}
                className="border-0 border-b last:border-b-0"
              >
                <AccordionTrigger className="py-2 px-0 hover:no-underline hover:bg-transparent">
                  <div className="flex items-center gap-2 text-left">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {format(recordDate, "dd/MM/yyyy")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — {record.professional?.name || "Profissional"}
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-3 pt-1 pl-6">
                  <div className="space-y-2 text-sm">
                    {record.chief_complaint && (
                      <p>
                        <span className="font-medium text-muted-foreground">Queixa: </span>
                        <span className="text-foreground">{record.chief_complaint}</span>
                      </p>
                    )}

                    {record.diagnosis && (
                      <p>
                        <span className="font-medium text-muted-foreground">Diagnóstico: </span>
                        <span className="text-foreground">{record.diagnosis}</span>
                      </p>
                    )}

                    {record.treatment_plan && (
                      <p>
                        <span className="font-medium text-muted-foreground">Tratamento: </span>
                        <span className="text-foreground">{record.treatment_plan}</span>
                      </p>
                    )}

                    {record.prescription && (
                      <p>
                        <span className="font-medium text-muted-foreground">Prescrição: </span>
                        <span className="text-foreground">{record.prescription}</span>
                      </p>
                    )}

                    {record.notes && (
                      <p>
                        <span className="font-medium text-muted-foreground">Obs: </span>
                        <span className="text-foreground">{record.notes}</span>
                      </p>
                    )}

                    {!hasContent(record) && (
                      <p className="text-xs text-muted-foreground italic">Sem dados registrados.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}