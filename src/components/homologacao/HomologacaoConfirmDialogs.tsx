import { AlertPopup } from "@/components/ui/alert-popup";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  appointmentName?: string;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  appointmentName,
}: ConfirmDeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertPopup
      open={open}
      onClose={() => onOpenChange(false)}
      title="Excluir Agendamento"
      description={
        <>
          Tem certeza que deseja excluir o agendamento de{" "}
          <strong>{appointmentName}</strong>? Esta ação não pode ser desfeita.
        </>
      }
      cancelText="Cancelar"
      confirmText={isLoading ? "Excluindo..." : "Excluir"}
      confirmVariant="destructive"
      onConfirm={handleConfirm}
      isLoading={isLoading}
    />
  );
}

interface ConfirmCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  appointmentName?: string;
}

export function ConfirmCancelDialog({
  open,
  onOpenChange,
  onConfirm,
  appointmentName,
}: ConfirmCancelDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(reason);
      setReason("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertPopup
      open={open}
      onClose={() => onOpenChange(false)}
      title="Cancelar Agendamento"
      description={
        <>
          Tem certeza que deseja cancelar o agendamento de{" "}
          <strong>{appointmentName}</strong>?
        </>
      }
      cancelText="Voltar"
      confirmText={isLoading ? "Cancelando..." : "Cancelar Agendamento"}
      confirmClassName="bg-orange-600 text-white hover:bg-orange-700"
      onConfirm={handleConfirm}
      isLoading={isLoading}
    >
      <div className="space-y-2 py-4">
        <Label htmlFor="cancel-reason">Motivo do Cancelamento</Label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Informe o motivo do cancelamento (opcional)"
          rows={3}
        />
      </div>
    </AlertPopup>
  );
}

interface ConfirmCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  appointmentName?: string;
}

export function ConfirmCompleteDialog({
  open,
  onOpenChange,
  onConfirm,
  appointmentName,
}: ConfirmCompleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertPopup
      open={open}
      onClose={() => onOpenChange(false)}
      title="Marcar como Atendido"
      description={
        <>
          Confirma que a homologação de <strong>{appointmentName}</strong> foi
          realizada com sucesso? Um protocolo será gerado automaticamente.
        </>
      }
      cancelText="Voltar"
      confirmText={isLoading ? "Confirmando..." : "Confirmar Atendimento"}
      confirmClassName="bg-green-600 text-white hover:bg-green-700"
      onConfirm={handleConfirm}
      isLoading={isLoading}
    />
  );
}
