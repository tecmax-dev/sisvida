import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TelemedicineControls } from "./TelemedicineControls";
import { Loader2, User, Video, AlertCircle, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VideoCallProps {
  sessionId: string;
  roomId: string;
  isInitiator: boolean;
  onEnd: () => void;
  patientName?: string;
}

type ConnectionState = "connecting" | "waiting" | "connected" | "disconnected" | "failed";

export function VideoCall({ 
  sessionId, 
  roomId, 
  isInitiator, 
  onEnd,
  patientName 
}: VideoCallProps) {
  const { toast } = useToast();
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  // Timer
  useEffect(() => {
    if (connectionState !== "connected") return;
    
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionState]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Initialize media and WebRTC
  const initializeCall = useCallback(async () => {
    try {
      console.log("[VideoCall] Initializing call...", { roomId, isInitiator });

      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote tracks
      pc.ontrack = (event) => {
        console.log("[VideoCall] Remote track received");
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setConnectionState("connected");
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log("[VideoCall] Connection state:", pc.connectionState);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setConnectionState("disconnected");
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          console.log("[VideoCall] Sending ICE candidate");
          channelRef.current.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON(), from: isInitiator ? "professional" : "patient" },
          });
        }
      };

      // Set up Supabase Realtime channel for signaling
      const channel = supabase.channel(`telemedicine:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (!isInitiator && payload.sdp) {
            console.log("[VideoCall] Received offer");
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: pc.localDescription },
            });
          }
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (isInitiator && payload.sdp) {
            console.log("[VideoCall] Received answer");
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          }
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (payload.candidate) {
            console.log("[VideoCall] Received ICE candidate");
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.error("[VideoCall] Error adding ICE candidate:", err);
            }
          }
        })
        .on("broadcast", { event: "participant-joined" }, () => {
          console.log("[VideoCall] Participant joined");
          if (isInitiator) {
            // Create and send offer
            createAndSendOffer(pc, channel);
          }
        })
        .on("broadcast", { event: "call-ended" }, () => {
          console.log("[VideoCall] Call ended by other party");
          handleEndCall();
        })
        .subscribe(async (status) => {
          console.log("[VideoCall] Channel status:", status);
          if (status === "SUBSCRIBED") {
            channelRef.current = channel;
            
            // Notify that we joined
            channel.send({
              type: "broadcast",
              event: "participant-joined",
              payload: { role: isInitiator ? "professional" : "patient" },
            });

            if (isInitiator) {
              setConnectionState("waiting");
            } else {
              // Patient waits for offer
              setConnectionState("waiting");
            }
          }
        });

      return () => {
        channel.unsubscribe();
      };
    } catch (error) {
      console.error("[VideoCall] Error initializing:", error);
      setConnectionState("failed");
      toast({
        title: "Erro ao iniciar chamada",
        description: "Verifique as permissões de câmera e microfone",
        variant: "destructive",
      });
    }
  }, [roomId, isInitiator, toast]);

  const createAndSendOffer = async (pc: RTCPeerConnection, channel: ReturnType<typeof supabase.channel>) => {
    try {
      console.log("[VideoCall] Creating offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channel.send({
        type: "broadcast",
        event: "offer",
        payload: { sdp: pc.localDescription },
      });
    } catch (err) {
      console.error("[VideoCall] Error creating offer:", err);
    }
  };

  useEffect(() => {
    initializeCall();

    return () => {
      cleanup();
    };
  }, [initializeCall]);

  const cleanup = () => {
    console.log("[VideoCall] Cleaning up...");
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "call-ended",
        payload: {},
      });
      channelRef.current.unsubscribe();
    }
  };

  const handleEndCall = () => {
    cleanup();
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        
        // Replace with camera track
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (videoTrack) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
        
        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error("[VideoCall] Screen share error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível compartilhar a tela",
        variant: "destructive",
      });
    }
  };

  const renderConnectionStatus = () => {
    switch (connectionState) {
      case "connecting":
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-medium">Conectando...</h3>
            <p className="text-muted-foreground text-sm">Iniciando chamada de vídeo</p>
          </div>
        );
      case "waiting":
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <h3 className="text-lg font-medium mt-2">
              {isInitiator ? "Aguardando paciente..." : "Aguardando profissional..."}
            </h3>
            <p className="text-muted-foreground text-sm">
              {isInitiator 
                ? "O paciente receberá um link para entrar na chamada"
                : "O profissional iniciará a consulta em breve"
              }
            </p>
          </div>
        );
      case "failed":
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">Falha na conexão</h3>
            <p className="text-muted-foreground text-sm">
              Verifique sua conexão e permissões de câmera/microfone
            </p>
          </div>
        );
      case "disconnected":
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <WifiOff className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-medium">Conexão perdida</h3>
            <p className="text-muted-foreground text-sm">
              Tentando reconectar...
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[400px] bg-muted/50 rounded-lg overflow-hidden">
      {/* Connection status overlay */}
      {connectionState !== "connected" && (
        <div className="absolute inset-0 z-10 bg-background/95 backdrop-blur-sm">
          {renderConnectionStatus()}
        </div>
      )}

      {/* Remote video (main) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={cn(
          "w-full h-full object-cover",
          connectionState !== "connected" && "invisible"
        )}
      />

      {/* Remote placeholder when no video */}
      {connectionState === "connected" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-30">
            <User className="h-24 w-24 mx-auto mb-2" />
            <p>{patientName || "Participante"}</p>
          </div>
        </div>
      )}

      {/* Local video (PIP) */}
      <div className="absolute top-4 right-4 w-48 aspect-video rounded-lg overflow-hidden shadow-lg border-2 border-background">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover",
            isVideoOff && "invisible"
          )}
        />
        {isVideoOff && (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Status badges */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        {connectionState === "connected" && (
          <>
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
              Ao vivo
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {formatTime(elapsedTime)}
            </Badge>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <TelemedicineControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={handleEndCall}
          disabled={connectionState === "connecting"}
        />
      </div>
    </div>
  );
}
