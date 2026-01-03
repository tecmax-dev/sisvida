import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  Stethoscope,
  Pill,
  ClipboardList,
  MessageSquare,
  History,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  } | null;
}

interface PatientMedicalHistoryProps {
  records: MedicalRecord[];
  loading?: boolean;
  patientName?: string;
}

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
  telemedicine: "Telemedicina",
};

const typeColors: Record<string, string> = {
  first_visit: "bg-blue-100 text-blue-700 border-blue-200",
  return: "bg-green-100 text-green-700 border-green-200",
  exam: "bg-purple-100 text-purple-700 border-purple-200",
  procedure: "bg-orange-100 text-orange-700 border-orange-200",
  telemedicine: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

export function PatientMedicalHistory({ 
  records, 
  loading = false,
  patientName 
}: PatientMedicalHistoryProps) {
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  const toggleRecord = (recordId: string) => {
    setExpandedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedRecords(new Set(records.map(r => r.id)));
  };

  const collapseAll = () => {
    setExpandedRecords(new Set());
  };

  // Group records by year and month
  const groupedRecords = records.reduce((acc, record) => {
    const date = parseISO(record.record_date || record.created_at);
    const yearMonth = format(date, "yyyy-MM");
    if (!acc[yearMonth]) {
      acc[yearMonth] = [];
    }
    acc[yearMonth].push(record);
    return acc;
  }, {} as Record<string, MedicalRecord[]>);

  const sortedMonths = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
        <p className="text-sm">Carregando histórico...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <h3 className="text-lg font-medium mb-1">Nenhum histórico encontrado</h3>
        <p className="text-sm">Este paciente ainda não possui prontuários registrados.</p>
      </div>
    );
  }

  const hasContent = (record: MedicalRecord) => {
    return record.chief_complaint || record.diagnosis || record.treatment_plan || record.prescription || record.notes;
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="font-medium">{records.length} registro(s)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
            Expandir todos
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
            Recolher todos
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="h-[calc(100vh-400px)] pr-4">
        <div className="space-y-6">
          {sortedMonths.map((monthKey) => {
            const monthRecords = groupedRecords[monthKey];
            const monthDate = parseISO(monthKey + "-01");
            const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR });

            return (
              <div key={monthKey} className="relative">
                {/* Month Header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 mb-3">
                  <h3 className="text-sm font-semibold text-primary capitalize flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {monthLabel}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {monthRecords.length} registro(s)
                    </Badge>
                  </h3>
                </div>

                {/* Records for this month */}
                <div className="relative pl-6 border-l-2 border-border space-y-3">
                  {monthRecords.map((record, index) => {
                    const recordDate = parseISO(record.record_date || record.created_at);
                    const isExpanded = expandedRecords.has(record.id);
                    const appointmentType = record.appointment?.type || "return";

                    return (
                      <div key={record.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[31px] w-4 h-4 rounded-full border-2 border-background bg-primary" />

                        <Collapsible open={isExpanded} onOpenChange={() => toggleRecord(record.id)}>
                          <Card className={cn(
                            "transition-all duration-200 hover:shadow-md",
                            isExpanded && "ring-1 ring-primary/20"
                          )}>
                            <CollapsibleTrigger asChild>
                              <div className="p-4 cursor-pointer">
                                <div className="flex items-start justify-between gap-4">
                                  {/* Left: Date and Type */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="flex flex-col items-center min-w-[50px]">
                                      <span className="text-2xl font-bold text-foreground">
                                        {format(recordDate, "dd")}
                                      </span>
                                      <span className="text-xs text-muted-foreground uppercase">
                                        {format(recordDate, "EEE", { locale: ptBR })}
                                      </span>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <Badge 
                                          variant="outline" 
                                          className={cn(
                                            "text-xs",
                                            typeColors[appointmentType] || "bg-gray-100 text-gray-700"
                                          )}
                                        >
                                          {typeLabels[appointmentType] || appointmentType}
                                        </Badge>
                                      </div>

                                      {/* Professional */}
                                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                        <User className="h-3.5 w-3.5" />
                                        <span>{record.professional?.name || "Profissional não identificado"}</span>
                                      </div>

                                      {/* Preview of chief complaint */}
                                      {record.chief_complaint && (
                                        <p className="text-sm text-foreground mt-1 line-clamp-1">
                                          <span className="font-medium">Queixa:</span> {record.chief_complaint}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Time and Expand */}
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <span className="text-xs">
                                      {format(parseISO(record.created_at), "HH:mm")}
                                    </span>
                                    {hasContent(record) && (
                                      isExpanded ? (
                                        <ChevronDown className="h-5 w-5" />
                                      ) : (
                                        <ChevronRight className="h-5 w-5" />
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <CardContent className="pt-0 pb-4 border-t mt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                  {/* Queixa Principal */}
                                  {record.chief_complaint && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
                                        <ClipboardList className="h-3.5 w-3.5" />
                                        Queixa Principal
                                      </div>
                                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded">
                                        {record.chief_complaint}
                                      </p>
                                    </div>
                                  )}

                                  {/* Diagnóstico */}
                                  {record.diagnosis && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
                                        <Stethoscope className="h-3.5 w-3.5" />
                                        Diagnóstico
                                      </div>
                                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded">
                                        {record.diagnosis}
                                      </p>
                                    </div>
                                  )}

                                  {/* Plano de Tratamento */}
                                  {record.treatment_plan && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
                                        <FileText className="h-3.5 w-3.5" />
                                        Plano de Tratamento
                                      </div>
                                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded">
                                        {record.treatment_plan}
                                      </p>
                                    </div>
                                  )}

                                  {/* Prescrição */}
                                  {record.prescription && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
                                        <Pill className="h-3.5 w-3.5" />
                                        Prescrição
                                      </div>
                                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded font-mono text-xs">
                                        {record.prescription}
                                      </p>
                                    </div>
                                  )}

                                  {/* Observações */}
                                  {record.notes && (
                                    <div className="space-y-1 md:col-span-2">
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Observações
                                      </div>
                                      <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded">
                                        {record.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
