import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VideoCall } from "@/components/telemedicine/VideoCall";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  User,
  Calendar,
  Building2,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TelemedicineSession {
  id: string;
  room_id: string;
  status: string;
  appointment: {
    id: string;
    appointment_date: string;
    start_time: string;
    patient: {
      name: string;
    };
    professional: {
      name: string;
      specialty: string | null;
    };
    clinic: {
      name: string;
      logo_url: string | null;
    };
  } | null;
}

export default function TelemedicinePatient() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<TelemedicineSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  
  // Device check
  const [checkingDevices, setCheckingDevices] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchSession();
    }
  }, [token]);

  const fetchSession = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("telemedicine_sessions")
        .select(`
          id,
          room_id,
          status,
          appointment:appointments (
            id,
            appointment_date,
            start_time,
            patient:patients (name),
            professional:professionals (name, specialty),
            clinic:clinics (name, logo_url)
          )
        `)
        .eq("patient_token", token)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError("Link inválido ou expirado");
        return;
      }

      if (data.status === "ended") {
        setCallEnded(true);
      }

      // Type assertion for nested query result
      const sessionData = data as unknown as TelemedicineSession;
      setSession(sessionData);
    } catch (err) {
      console.error("[TelemedicinePatient] Error:", err);
      setError("Erro ao carregar sessão");
    } finally {
      setLoading(false);
    }
  };

  const checkDevices = async () => {
    setCheckingDevices(true);
    setDeviceError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      setHasCamera(videoTracks.length > 0);
      setHasMicrophone(audioTracks.length > 0);

      // Stop tracks after checking
      stream.getTracks().forEach((track) => track.stop());

      if (videoTracks.length === 0 || audioTracks.length === 0) {
        setDeviceError("Câmera ou microfone não detectados");
      }
    } catch (err) {
      console.error("[TelemedicinePatient] Device check error:", err);
      setDeviceError(
        "Não foi possível acessar câmera e microfone. Verifique as permissões do navegador."
      );
    } finally {
      setCheckingDevices(false);
    }
  };

  const handleJoinCall = () => {
    setInCall(true);
    
    // Update session status
    if (session) {
      supabase
        .from("telemedicine_sessions")
        .update({ status: "in_progress" })
        .eq("id", session.id)
        .then(() => {});
    }
  };

  const handleEndCall = async () => {
    setInCall(false);
    setCallEnded(true);
    
    if (session) {
      await supabase
        .from("telemedicine_sessions")
        .update({ 
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", session.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">{error || "Sessão não encontrada"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (callEnded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Consulta Finalizada</h2>
            <p className="text-muted-foreground mb-4">
              Sua teleconsulta foi encerrada. Obrigado!
            </p>
            <p className="text-sm text-muted-foreground">
              Em caso de dúvidas, entre em contato com a clínica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inCall) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {session.appointment?.clinic?.logo_url ? (
                <img 
                  src={session.appointment.clinic.logo_url} 
                  alt="Logo" 
                  className="h-10 w-auto" 
                />
              ) : (
                <Logo />
              )}
              <div>
                <h1 className="font-semibold">{session.appointment?.clinic?.name}</h1>
                <p className="text-sm text-muted-foreground">Teleconsulta</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
              Conectado
            </Badge>
          </div>

          <div className="aspect-video max-h-[calc(100vh-150px)]">
            <VideoCall
              sessionId={session.id}
              roomId={session.room_id}
              isInitiator={false}
              onEnd={handleEndCall}
              patientName={session.appointment?.patient?.name}
            />
          </div>
        </div>
      </div>
    );
  }

  // Pre-call screen
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {session.appointment?.clinic?.logo_url ? (
              <img 
                src={session.appointment.clinic.logo_url} 
                alt="Logo" 
                className="h-12 w-auto" 
              />
            ) : (
              <Logo />
            )}
            <div>
              <h1 className="text-xl font-semibold">{session.appointment?.clinic?.name}</h1>
              <p className="text-sm text-muted-foreground">Teleconsulta</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Appointment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informações da Consulta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{session.appointment?.professional?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {session.appointment?.professional?.specialty || "Profissional de Saúde"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {session.appointment?.appointment_date && 
                      format(new Date(session.appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    às {session.appointment?.start_time?.substring(0, 5)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <p className="font-medium">{session.appointment?.clinic?.name}</p>
              </div>
            </CardContent>
          </Card>

          {/* Device Check */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Verificação de Dispositivos
              </CardTitle>
              <CardDescription>
                Antes de entrar, verifique se sua câmera e microfone estão funcionando
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasCamera && !hasMicrophone && !deviceError && (
                <Button
                  onClick={checkDevices}
                  disabled={checkingDevices}
                  variant="outline"
                  className="w-full"
                >
                  {checkingDevices ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-2" />
                      Verificar Câmera e Microfone
                    </>
                  )}
                </Button>
              )}

              {(hasCamera || hasMicrophone) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {hasCamera ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <VideoOff className="h-5 w-5 text-destructive" />
                    )}
                    <span>Câmera {hasCamera ? "detectada" : "não detectada"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasMicrophone ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <MicOff className="h-5 w-5 text-destructive" />
                    )}
                    <span>Microfone {hasMicrophone ? "detectado" : "não detectado"}</span>
                  </div>
                </div>
              )}

              {deviceError && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Erro ao verificar dispositivos</p>
                    <p className="text-sm text-muted-foreground">{deviceError}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Join Button */}
          <Button
            onClick={handleJoinCall}
            disabled={checkingDevices}
            size="lg"
            className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 h-14 text-lg"
          >
            <Video className="h-5 w-5" />
            Entrar na Consulta
          </Button>

          {/* Instructions */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-3">Dicas para uma boa consulta:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />
                  Escolha um local silencioso e bem iluminado
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />
                  Verifique sua conexão com a internet
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />
                  Use fones de ouvido para melhor qualidade de áudio
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />
                  Tenha em mãos seus documentos e exames, se necessário
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
