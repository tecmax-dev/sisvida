import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Heart, 
  Thermometer, 
  Weight, 
  Ruler, 
  Droplets,
  Clock,
  User
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PreAttendanceData {
  id: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
  oxygen_saturation: number | null;
  glucose: number | null;
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
}

interface VitalSignsDisplayProps {
  appointmentId: string;
  className?: string;
}

export function VitalSignsDisplay({ appointmentId, className }: VitalSignsDisplayProps) {
  const [data, setData] = useState<PreAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recorderName, setRecorderName] = useState<string | null>(null);

  useEffect(() => {
    fetchVitalSigns();
  }, [appointmentId]);

  const fetchVitalSigns = async () => {
    try {
      const { data: preAttendance, error } = await supabase
        .from("pre_attendance")
        .select("*")
        .eq("appointment_id", appointmentId)
        .maybeSingle();

      if (error) throw error;

      if (preAttendance) {
        setData(preAttendance as PreAttendanceData);

        // Fetch recorder name if available
        if (preAttendance.recorded_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", preAttendance.recorded_by)
            .maybeSingle();

          if (profile) {
            setRecorderName(profile.name);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching vital signs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (!data) return null;

  const hasAnyVital = 
    data.blood_pressure_systolic || 
    data.heart_rate || 
    data.temperature || 
    data.weight || 
    data.height || 
    data.oxygen_saturation ||
    data.glucose;

  if (!hasAnyVital && !data.notes) return null;

  // Calculate BMI if weight and height are available
  const bmi = data.weight && data.height 
    ? (data.weight / Math.pow(data.height / 100, 2)).toFixed(1)
    : null;

  const getBMICategory = (bmi: number): { label: string; color: string } => {
    if (bmi < 18.5) return { label: "Abaixo do peso", color: "text-blue-600" };
    if (bmi < 25) return { label: "Normal", color: "text-green-600" };
    if (bmi < 30) return { label: "Sobrepeso", color: "text-yellow-600" };
    return { label: "Obesidade", color: "text-red-600" };
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Sinais Vitais - Pré-Atendimento
          </span>
          <Badge variant="outline" className="font-normal text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {format(new Date(data.recorded_at), "HH:mm", { locale: ptBR })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Blood Pressure */}
          {data.blood_pressure_systolic && data.blood_pressure_diastolic && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
              <Heart className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pressão Arterial</p>
                <p className="font-semibold">
                  {data.blood_pressure_systolic}/{data.blood_pressure_diastolic} 
                  <span className="text-xs font-normal ml-1">mmHg</span>
                </p>
              </div>
            </div>
          )}

          {/* Heart Rate */}
          {data.heart_rate && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-pink-50 dark:bg-pink-950/20">
              <Activity className="h-5 w-5 text-pink-500" />
              <div>
                <p className="text-xs text-muted-foreground">Freq. Cardíaca</p>
                <p className="font-semibold">
                  {data.heart_rate}
                  <span className="text-xs font-normal ml-1">bpm</span>
                </p>
              </div>
            </div>
          )}

          {/* Oxygen Saturation */}
          {data.oxygen_saturation && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Droplets className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Saturação O₂</p>
                <p className="font-semibold">
                  {data.oxygen_saturation}
                  <span className="text-xs font-normal ml-1">%</span>
                </p>
              </div>
            </div>
          )}

          {/* Temperature */}
          {data.temperature && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <Thermometer className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Temperatura</p>
                <p className="font-semibold">
                  {data.temperature}
                  <span className="text-xs font-normal ml-1">°C</span>
                </p>
              </div>
            </div>
          )}

          {/* Glucose */}
          {data.glucose && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Droplets className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Glicemia</p>
                <p className="font-semibold">
                  {data.glucose}
                  <span className="text-xs font-normal ml-1">mg/dL</span>
                </p>
              </div>
            </div>
          )}

          {/* Weight */}
          {data.weight && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
              <Weight className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Peso</p>
                <p className="font-semibold">
                  {data.weight}
                  <span className="text-xs font-normal ml-1">kg</span>
                </p>
              </div>
            </div>
          )}

          {/* Height */}
          {data.height && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/20">
              <Ruler className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-xs text-muted-foreground">Altura</p>
                <p className="font-semibold">
                  {data.height}
                  <span className="text-xs font-normal ml-1">cm</span>
                </p>
              </div>
            </div>
          )}

          {/* BMI */}
          {bmi && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-950/20">
              <Activity className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-xs text-muted-foreground">IMC</p>
                <p className={`font-semibold ${getBMICategory(parseFloat(bmi)).color}`}>
                  {bmi}
                  <span className="text-xs font-normal ml-1">
                    ({getBMICategory(parseFloat(bmi)).label})
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {data.notes && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Observações:</p>
            <p className="text-sm">{data.notes}</p>
          </div>
        )}

        {/* Recorder info */}
        {recorderName && (
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            Registrado por {recorderName}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
