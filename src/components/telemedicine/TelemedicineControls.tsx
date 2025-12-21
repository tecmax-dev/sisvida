import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface TelemedicineControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  disabled?: boolean;
}

export function TelemedicineControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  disabled = false,
}: TelemedicineControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 p-4 bg-background/95 backdrop-blur rounded-xl border shadow-lg">
      <Button
        variant={isMuted ? "destructive" : "secondary"}
        size="icon"
        onClick={onToggleMute}
        disabled={disabled}
        className={cn(
          "h-12 w-12 rounded-full transition-all",
          isMuted && "bg-red-500 hover:bg-red-600"
        )}
        title={isMuted ? "Ativar microfone" : "Desativar microfone"}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>

      <Button
        variant={isVideoOff ? "destructive" : "secondary"}
        size="icon"
        onClick={onToggleVideo}
        disabled={disabled}
        className={cn(
          "h-12 w-12 rounded-full transition-all",
          isVideoOff && "bg-red-500 hover:bg-red-600"
        )}
        title={isVideoOff ? "Ativar câmera" : "Desativar câmera"}
      >
        {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      </Button>

      <Button
        variant={isScreenSharing ? "default" : "secondary"}
        size="icon"
        onClick={onToggleScreenShare}
        disabled={disabled}
        className={cn(
          "h-12 w-12 rounded-full transition-all",
          isScreenSharing && "bg-primary"
        )}
        title={isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
      >
        {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
      </Button>

      <Button
        variant="destructive"
        size="icon"
        onClick={onEndCall}
        disabled={disabled}
        className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-700"
        title="Encerrar chamada"
      >
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  );
}
