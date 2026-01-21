import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, LogOut, RefreshCw } from "lucide-react";

interface SessionExpiryWarningProps {
  open: boolean;
  timeRemaining: number; // em segundos
  onRenew: () => void;
  onLogout: () => void;
}

export function SessionExpiryWarning({
  open,
  timeRemaining,
  onRenew,
  onLogout
}: SessionExpiryWarningProps) {
  const [displayTime, setDisplayTime] = useState(timeRemaining);

  useEffect(() => {
    setDisplayTime(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (!open || displayTime <= 0) return;

    const timer = setInterval(() => {
      setDisplayTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, displayTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <AlertDialog open={open} systemModal>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <AlertDialogTitle className="text-xl">
              Sessão prestes a expirar
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Por segurança, sua sessão será encerrada em{" "}
            <span className="font-semibold text-warning">
              {formatTime(displayTime)}
            </span>
            . Deseja continuar conectado?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel 
            onClick={onLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair agora
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onRenew}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Continuar conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
