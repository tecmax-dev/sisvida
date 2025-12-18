import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { ToothDiagram } from "./ToothDiagram";
import { ToothDialog } from "./ToothDialog";
import { OdontogramLegend } from "./OdontogramLegend";

// Tooth numbering follows FDI World Dental Federation notation
// Quadrant 1: Upper Right (11-18), Quadrant 2: Upper Left (21-28)
// Quadrant 3: Lower Left (31-38), Quadrant 4: Lower Right (41-48)
const ADULT_TEETH = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
};

export interface ToothRecord {
  id?: string;
  tooth_number: number;
  tooth_face?: string;
  condition: string;
  material?: string;
  notes?: string;
  recorded_at?: string;
}

export interface OdontogramCondition {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

export const ODONTOGRAM_CONDITIONS: OdontogramCondition[] = [
  { id: "healthy", label: "Saudável", color: "#22c55e" },
  { id: "caries", label: "Cárie", color: "#ef4444" },
  { id: "restoration", label: "Restauração", color: "#3b82f6" },
  { id: "extraction", label: "Extração", color: "#000000" },
  { id: "missing", label: "Ausente", color: "#9ca3af" },
  { id: "crown", label: "Coroa", color: "#f59e0b" },
  { id: "implant", label: "Implante", color: "#8b5cf6" },
  { id: "root_canal", label: "Tratamento de Canal", color: "#ec4899" },
  { id: "fracture", label: "Fratura", color: "#f97316" },
  { id: "sealant", label: "Selante", color: "#06b6d4" },
];

interface OdontogramProps {
  patientId: string;
  clinicId: string;
  professionalId: string;
  appointmentId?: string;
  readOnly?: boolean;
}

export function Odontogram({
  patientId,
  clinicId,
  professionalId,
  appointmentId,
  readOnly = false,
}: OdontogramProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<ToothRecord[]>([]);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCondition, setActiveCondition] = useState<string>("caries");

  useEffect(() => {
    loadRecords();
  }, [patientId, clinicId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("odontogram_records")
        .select("*")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      // Keep only the latest record for each tooth
      const latestRecords: Record<number, ToothRecord> = {};
      data?.forEach((record) => {
        if (!latestRecords[record.tooth_number]) {
          latestRecords[record.tooth_number] = record;
        }
      });

      setRecords(Object.values(latestRecords));
    } catch (error: any) {
      toast({
        title: "Erro ao carregar odontograma",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getToothCondition = (toothNumber: number): string => {
    const record = records.find((r) => r.tooth_number === toothNumber);
    return record?.condition || "healthy";
  };

  const handleToothClick = (toothNumber: number) => {
    if (readOnly) return;
    setSelectedTooth(toothNumber);
    setDialogOpen(true);
  };

  const handleQuickCondition = async (toothNumber: number) => {
    if (readOnly) return;
    
    try {
      const { error } = await supabase.from("odontogram_records").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        appointment_id: appointmentId || null,
        tooth_number: toothNumber,
        condition: activeCondition,
      });

      if (error) throw error;

      toast({
        title: "Registro salvo",
        description: `Dente ${toothNumber} marcado como ${ODONTOGRAM_CONDITIONS.find(c => c.id === activeCondition)?.label}`,
      });

      loadRecords();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveToothRecord = async (record: ToothRecord) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("odontogram_records").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        appointment_id: appointmentId || null,
        tooth_number: record.tooth_number,
        tooth_face: record.tooth_face || null,
        condition: record.condition,
        material: record.material || null,
        notes: record.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Registro salvo",
        description: `Informações do dente ${record.tooth_number} salvas com sucesso.`,
      });

      setDialogOpen(false);
      loadRecords();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const ToothRow = ({ teeth, isUpper }: { teeth: number[]; isUpper: boolean }) => (
    <div className="flex justify-center gap-1">
      {teeth.map((toothNumber) => (
        <ToothDiagram
          key={toothNumber}
          toothNumber={toothNumber}
          condition={getToothCondition(toothNumber)}
          isUpper={isUpper}
          onClick={() => handleToothClick(toothNumber)}
          onDoubleClick={() => handleQuickCondition(toothNumber)}
          disabled={readOnly}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Condition Selector */}
      {!readOnly && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Condição Rápida (duplo clique no dente)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex flex-wrap gap-2">
              {ODONTOGRAM_CONDITIONS.map((condition) => (
                <Badge
                  key={condition.id}
                  variant={activeCondition === condition.id ? "default" : "outline"}
                  className="cursor-pointer transition-all"
                  style={{
                    backgroundColor: activeCondition === condition.id ? condition.color : undefined,
                    borderColor: condition.color,
                    color: activeCondition === condition.id ? "white" : condition.color,
                  }}
                  onClick={() => setActiveCondition(condition.id)}
                >
                  {condition.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Odontogram Chart */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Odontograma</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadRecords}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative bg-muted/30 rounded-lg p-4 overflow-x-auto">
            {/* Upper Teeth */}
            <div className="mb-2">
              <div className="flex justify-center gap-8 mb-1">
                <span className="text-xs text-muted-foreground w-20 text-right">Sup. Direito</span>
                <span className="text-xs text-muted-foreground w-20 text-left">Sup. Esquerdo</span>
              </div>
              <div className="flex justify-center">
                <div className="flex gap-1">
                  <ToothRow teeth={ADULT_TEETH.upperRight} isUpper={true} />
                </div>
                <div className="w-4 border-l-2 border-dashed border-muted-foreground/30 mx-1" />
                <div className="flex gap-1">
                  <ToothRow teeth={ADULT_TEETH.upperLeft} isUpper={true} />
                </div>
              </div>
            </div>

            {/* Midline */}
            <div className="border-t-2 border-dashed border-muted-foreground/30 my-3" />

            {/* Lower Teeth */}
            <div>
              <div className="flex justify-center">
                <div className="flex gap-1">
                  <ToothRow teeth={ADULT_TEETH.lowerRight.slice().reverse()} isUpper={false} />
                </div>
                <div className="w-4 border-l-2 border-dashed border-muted-foreground/30 mx-1" />
                <div className="flex gap-1">
                  <ToothRow teeth={ADULT_TEETH.lowerLeft.slice().reverse()} isUpper={false} />
                </div>
              </div>
              <div className="flex justify-center gap-8 mt-1">
                <span className="text-xs text-muted-foreground w-20 text-right">Inf. Direito</span>
                <span className="text-xs text-muted-foreground w-20 text-left">Inf. Esquerdo</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2 text-center">
            Clique em um dente para detalhes • Duplo clique para aplicar condição rápida
          </p>
        </CardContent>
      </Card>

      {/* Legend */}
      <OdontogramLegend />

      {/* Tooth Dialog */}
      <ToothDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        toothNumber={selectedTooth}
        currentCondition={selectedTooth ? getToothCondition(selectedTooth) : "healthy"}
        onSave={handleSaveToothRecord}
        saving={saving}
      />
    </div>
  );
}
