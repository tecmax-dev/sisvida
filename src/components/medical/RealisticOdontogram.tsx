import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Share2, Printer, RotateCcw } from "lucide-react";
import { RealisticToothSVG } from "./RealisticToothSVG";
import { ToothDialog } from "./ToothDialog";
import { ToothRecord, ODONTOGRAM_CONDITIONS } from "./Odontogram";

// Tooth numbering follows FDI World Dental Federation notation
const ADULT_TEETH = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
};

interface RealisticOdontogramProps {
  patientId: string;
  clinicId: string;
  professionalId: string;
  appointmentId?: string;
  readOnly?: boolean;
}

export function RealisticOdontogram({
  patientId,
  clinicId,
  professionalId,
  appointmentId,
  readOnly = false,
}: RealisticOdontogramProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<ToothRecord[]>([]);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

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

  const filteredConditions = filter === "all" 
    ? null 
    : filter;

  const shouldShowTooth = (toothNumber: number): boolean => {
    if (!filteredConditions) return true;
    return getToothCondition(toothNumber) === filteredConditions;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Filtrar:</span>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ODONTOGRAM_CONDITIONS.map((condition) => (
                <SelectItem key={condition.id} value={condition.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: condition.color }}
                    />
                    {condition.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRecords}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-1" />
            Compartilhar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Odontogram Chart */}
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl border p-6 print:p-4">
        <h3 className="text-center text-lg font-semibold text-foreground mb-6">Odontograma</h3>
        
        {/* Upper Teeth */}
        <div className="mb-8">
          <div className="flex justify-center items-end gap-0.5 mb-2">
            {/* Upper Right */}
            {ADULT_TEETH.upperRight.map((toothNumber) => (
              <div 
                key={toothNumber} 
                className={!shouldShowTooth(toothNumber) ? "opacity-20" : ""}
              >
                <RealisticToothSVG
                  toothNumber={toothNumber}
                  isUpper={true}
                  condition={getToothCondition(toothNumber)}
                  onClick={() => handleToothClick(toothNumber)}
                  disabled={readOnly}
                  size="md"
                />
              </div>
            ))}
            
            {/* Midline divider */}
            <div className="w-px h-16 bg-border mx-2" />
            
            {/* Upper Left */}
            {ADULT_TEETH.upperLeft.map((toothNumber) => (
              <div 
                key={toothNumber}
                className={!shouldShowTooth(toothNumber) ? "opacity-20" : ""}
              >
                <RealisticToothSVG
                  toothNumber={toothNumber}
                  isUpper={true}
                  condition={getToothCondition(toothNumber)}
                  onClick={() => handleToothClick(toothNumber)}
                  disabled={readOnly}
                  size="md"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Horizontal divider */}
        <div className="border-t-2 border-dashed border-muted-foreground/20 my-4" />

        {/* Lower Teeth */}
        <div className="mt-8">
          <div className="flex justify-center items-start gap-0.5">
            {/* Lower Right (reversed for display) */}
            {ADULT_TEETH.lowerRight.slice().reverse().map((toothNumber) => (
              <div 
                key={toothNumber}
                className={!shouldShowTooth(toothNumber) ? "opacity-20" : ""}
              >
                <RealisticToothSVG
                  toothNumber={toothNumber}
                  isUpper={false}
                  condition={getToothCondition(toothNumber)}
                  onClick={() => handleToothClick(toothNumber)}
                  disabled={readOnly}
                  size="md"
                />
              </div>
            ))}
            
            {/* Midline divider */}
            <div className="w-px h-16 bg-border mx-2" />
            
            {/* Lower Left (reversed for display) */}
            {ADULT_TEETH.lowerLeft.slice().reverse().map((toothNumber) => (
              <div 
                key={toothNumber}
                className={!shouldShowTooth(toothNumber) ? "opacity-20" : ""}
              >
                <RealisticToothSVG
                  toothNumber={toothNumber}
                  isUpper={false}
                  condition={getToothCondition(toothNumber)}
                  onClick={() => handleToothClick(toothNumber)}
                  disabled={readOnly}
                  size="md"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-sm">
        {ODONTOGRAM_CONDITIONS.map((condition) => (
          <div key={condition.id} className="flex items-center gap-1.5">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: condition.color }}
            />
            <span className="text-muted-foreground">{condition.label}</span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      {!readOnly && (
        <p className="text-xs text-center text-muted-foreground">
          Clique em um dente para registrar procedimentos e condições
        </p>
      )}

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
