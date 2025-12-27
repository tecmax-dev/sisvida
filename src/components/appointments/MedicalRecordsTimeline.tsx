import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Trash2, Pencil, ChevronDown, Share2, Printer, Save, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MedicalRecord {
  id: string;
  record_date: string;
  created_at: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  notes: string | null;
  physical_examination: string | null;
  professional?: {
    name: string;
  };
  appointment?: {
    type: string;
  };
}

interface MedicalRecordsTimelineProps {
  records: MedicalRecord[];
  onUpdateRecord: (id: string, data: Partial<MedicalRecord>) => void;
  onDeleteRecord: (id: string) => void;
  filterType: string;
  onFilterChange: (type: string) => void;
}

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

export function MedicalRecordsTimeline({
  records,
  onUpdateRecord,
  onDeleteRecord,
  filterType,
  onFilterChange,
}: MedicalRecordsTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<MedicalRecord>>({});

  // Group records by date
  const groupedRecords = records.reduce((acc, record) => {
    const date = format(parseISO(record.record_date), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, MedicalRecord[]>);

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

  const handleEdit = (record: MedicalRecord) => {
    setEditingId(record.id);
    setEditData({
      chief_complaint: record.chief_complaint,
      diagnosis: record.diagnosis,
      treatment_plan: record.treatment_plan,
      notes: record.notes,
      physical_examination: record.physical_examination,
    });
  };

  const handleSave = (id: string) => {
    onUpdateRecord(id, editData);
    setEditingId(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  return (
    <div>
      {/* Filter & Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              Filtrar: {filterType === 'all' ? 'Todos' : typeLabels[filterType] || filterType}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onFilterChange('all')}>
              Todos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange('first_visit')}>
              Primeira Consulta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange('return')}>
              Retorno
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange('exam')}>
              Exame
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange('procedure')}>
              Procedimento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            COMPARTILHAR
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            IMPRIMIR
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {sortedDates.map((dateKey, dateIndex) => {
          const dateRecords = groupedRecords[dateKey];
          const formattedDate = format(parseISO(dateKey), "dd MMM yyyy", { locale: ptBR });

          return (
            <div key={dateKey} className="relative flex gap-6 pb-8">
              {/* Date Column */}
              <div className="w-28 flex-shrink-0 text-right">
                <span className="text-sm font-medium text-muted-foreground uppercase">
                  {formattedDate}
                </span>
              </div>

              {/* Timeline Line */}
              <div className="relative flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-primary border-2 border-background z-10" />
                {dateIndex < sortedDates.length - 1 && (
                  <div className="absolute top-3 w-0.5 h-full bg-border" />
                )}
              </div>

              {/* Records */}
              <div className="flex-1 space-y-4">
                {dateRecords.map((record) => {
                  const isEditing = editingId === record.id;
                  const recordTime = format(parseISO(record.created_at), 'HH:mm');
                  const appointmentType = record.appointment?.type || 'return';

                  return (
                    <Card key={record.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              Por: <span className="font-medium text-foreground">{record.professional?.name || 'Profissional'}</span>
                            </span>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              {typeLabels[appointmentType] || appointmentType}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleSave(record.id)}
                                >
                                  <Save className="h-4 w-4 text-success" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={handleCancel}
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(record)}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => onDeleteRecord(record.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            <span className="text-sm text-muted-foreground ml-2">{recordTime}</span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Queixa Principal */}
                          {(record.chief_complaint || isEditing) && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                                Queixa Principal
                              </label>
                              {isEditing ? (
                                <Textarea
                                  value={editData.chief_complaint || ''}
                                  onChange={(e) => setEditData({ ...editData, chief_complaint: e.target.value })}
                                  className="min-h-[60px]"
                                />
                              ) : (
                                <p className="text-sm text-foreground">{record.chief_complaint}</p>
                              )}
                            </div>
                          )}

                          {/* Exame Físico */}
                          {(record.physical_examination || isEditing) && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                                Exame Físico
                              </label>
                              {isEditing ? (
                                <Textarea
                                  value={editData.physical_examination || ''}
                                  onChange={(e) => setEditData({ ...editData, physical_examination: e.target.value })}
                                  className="min-h-[60px]"
                                />
                              ) : (
                                <p className="text-sm text-foreground">{record.physical_examination}</p>
                              )}
                            </div>
                          )}

                          {/* Diagnóstico */}
                          {(record.diagnosis || isEditing) && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                                Diagnóstico
                              </label>
                              {isEditing ? (
                                <Textarea
                                  value={editData.diagnosis || ''}
                                  onChange={(e) => setEditData({ ...editData, diagnosis: e.target.value })}
                                  className="min-h-[60px]"
                                />
                              ) : (
                                <p className="text-sm text-foreground">{record.diagnosis}</p>
                              )}
                            </div>
                          )}

                          {/* Plano de Tratamento */}
                          {(record.treatment_plan || isEditing) && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                                Plano de Tratamento
                              </label>
                              {isEditing ? (
                                <Textarea
                                  value={editData.treatment_plan || ''}
                                  onChange={(e) => setEditData({ ...editData, treatment_plan: e.target.value })}
                                  className="min-h-[60px]"
                                />
                              ) : (
                                <p className="text-sm text-foreground">{record.treatment_plan}</p>
                              )}
                            </div>
                          )}

                          {/* Observações */}
                          {(record.notes || isEditing) && (
                            <div className="col-span-2">
                              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">
                                Observações
                              </label>
                              {isEditing ? (
                                <Textarea
                                  value={editData.notes || ''}
                                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                  className="min-h-[60px]"
                                />
                              ) : (
                                <p className="text-sm text-foreground">{record.notes}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {records.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum registro encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
