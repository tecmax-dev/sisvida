import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Heart, 
  Thermometer, 
  Weight, 
  Ruler, 
  Droplets,
  Clock,
  User,
  Stethoscope
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
    (data.blood_pressure_systolic && data.blood_pressure_systolic > 0) || 
    (data.heart_rate && data.heart_rate > 0) || 
    (data.temperature && data.temperature > 0) || 
    (data.weight && data.weight > 0) || 
    (data.height && data.height > 0) || 
    (data.oxygen_saturation && data.oxygen_saturation > 0) ||
    (data.glucose && data.glucose > 0);

  if (!hasAnyVital && (!data.notes || !data.notes.trim())) return null;

  // Calculate BMI if weight and height are available
  const bmi = data.weight && data.height 
    ? (data.weight / Math.pow(data.height / 100, 2)).toFixed(1)
    : null;

  const getBMICategory = (bmi: number): { label: string; color: string; bg: string } => {
    if (bmi < 18.5) return { label: "Abaixo do peso", color: "text-blue-700", bg: "bg-blue-100 dark:bg-blue-900/30" };
    if (bmi < 25) return { label: "Normal", color: "text-green-700", bg: "bg-green-100 dark:bg-green-900/30" };
    if (bmi < 30) return { label: "Sobrepeso", color: "text-amber-700", bg: "bg-amber-100 dark:bg-amber-900/30" };
    return { label: "Obesidade", color: "text-red-700", bg: "bg-red-100 dark:bg-red-900/30" };
  };

  return (
    <Card className={`border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-lg ${className}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                Pré-Atendimento
                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                  Triagem
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(data.recorded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {recorderName && (
                  <>
                    <span className="mx-1">•</span>
                    <User className="h-3 w-3" />
                    {recorderName}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Vital Signs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Blood Pressure */}
          {data.blood_pressure_systolic && data.blood_pressure_diastolic && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
              <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-red-700 dark:text-red-300 font-medium">PA</p>
                <p className="font-bold text-lg text-red-800 dark:text-red-200">
                  {data.blood_pressure_systolic}/{data.blood_pressure_diastolic}
                </p>
                <p className="text-[10px] text-red-600 dark:text-red-400">mmHg</p>
              </div>
            </div>
          )}

          {/* Heart Rate */}
          {data.heart_rate && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-pink-100 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800">
              <div className="h-10 w-10 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-pink-700 dark:text-pink-300 font-medium">FC</p>
                <p className="font-bold text-lg text-pink-800 dark:text-pink-200">
                  {data.heart_rate}
                </p>
                <p className="text-[10px] text-pink-600 dark:text-pink-400">bpm</p>
              </div>
            </div>
          )}

          {/* Oxygen Saturation */}
          {data.oxygen_saturation && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-medium">SpO₂</p>
                <p className="font-bold text-lg text-blue-800 dark:text-blue-200">
                  {data.oxygen_saturation}%
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400">saturação</p>
              </div>
            </div>
          )}

          {/* Temperature */}
          {data.temperature && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
              <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Thermometer className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-orange-700 dark:text-orange-300 font-medium">Temp</p>
                <p className="font-bold text-lg text-orange-800 dark:text-orange-200">
                  {data.temperature}°C
                </p>
                <p className="text-[10px] text-orange-600 dark:text-orange-400">axilar</p>
              </div>
            </div>
          )}

          {/* Glucose */}
          {data.glucose && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Droplets className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-purple-700 dark:text-purple-300 font-medium">Glicemia</p>
                <p className="font-bold text-lg text-purple-800 dark:text-purple-200">
                  {data.glucose}
                </p>
                <p className="text-[10px] text-purple-600 dark:text-purple-400">mg/dL</p>
              </div>
            </div>
          )}

          {/* Weight */}
          {data.weight && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Weight className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-green-700 dark:text-green-300 font-medium">Peso</p>
                <p className="font-bold text-lg text-green-800 dark:text-green-200">
                  {data.weight} kg
                </p>
                <p className="text-[10px] text-green-600 dark:text-green-400">corporal</p>
              </div>
            </div>
          )}

          {/* Height */}
          {data.height && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800">
              <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Ruler className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-cyan-700 dark:text-cyan-300 font-medium">Altura</p>
                <p className="font-bold text-lg text-cyan-800 dark:text-cyan-200">
                  {data.height} cm
                </p>
                <p className="text-[10px] text-cyan-600 dark:text-cyan-400">estatura</p>
              </div>
            </div>
          )}

          {/* BMI */}
          {bmi && (
            <div className={`flex items-center gap-3 p-3 rounded-xl ${getBMICategory(parseFloat(bmi)).bg} border border-gray-200 dark:border-gray-700`}>
              <div className="h-10 w-10 rounded-full bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-700 dark:text-gray-300 font-medium">IMC</p>
                <p className={`font-bold text-lg ${getBMICategory(parseFloat(bmi)).color}`}>
                  {bmi}
                </p>
                <p className={`text-[10px] ${getBMICategory(parseFloat(bmi)).color}`}>
                  {getBMICategory(parseFloat(bmi)).label}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {data.notes && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-1">
              📝 Observações da Triagem:
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-100">{data.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
