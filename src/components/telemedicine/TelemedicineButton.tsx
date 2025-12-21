import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Loader2, UserCheck, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TelemedicineButtonProps {
  appointmentId: string;
  clinicId: string;
  onStartCall: (sessionId: string, roomId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TelemedicineButton({
  appointmentId,
  clinicId,
  onStartCall,
  disabled = false,
  className,
}: TelemedicineButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);

  const handleStartTelemedicine = async () => {
    setLoading(true);

    try {
      // Check if session already exists
      const { data: existingSession } = await supabase
        .from("telemedicine_sessions")
        .select("id, room_id, status")
        .eq("appointment_id", appointmentId)
        .maybeSingle();

      if (existingSession) {
        // Resume existing session
        if (existingSession.status === "ended") {
          toast({
            title: "Sessão encerrada",
            description: "Esta teleconsulta já foi finalizada.",
            variant: "destructive",
          });
          return;
        }
        
        onStartCall(existingSession.id, existingSession.room_id);
        return;
      }

      // Create new session
      const roomId = `room_${appointmentId}_${Date.now()}`;
      
      const { data: session, error } = await supabase
        .from("telemedicine_sessions")
        .insert({
          appointment_id: appointmentId,
          clinic_id: clinicId,
          room_id: roomId,
          status: "waiting",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sala criada",
        description: "Aguardando o paciente entrar na chamada...",
      });

      onStartCall(session.id, session.room_id);
    } catch (error) {
      console.error("[TelemedicineButton] Error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a teleconsulta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleStartTelemedicine}
      disabled={disabled || loading}
      className={cn(
        "gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white",
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Conectando...
        </>
      ) : sessionStatus === "waiting" ? (
        <>
          <UserCheck className="h-4 w-4" />
          Aguardando Paciente
        </>
      ) : sessionStatus === "in_progress" ? (
        <>
          <Phone className="h-4 w-4" />
          Retomar Chamada
        </>
      ) : (
        <>
          <Video className="h-4 w-4" />
          Iniciar Teleconsulta
        </>
      )}
    </Button>
  );
}
