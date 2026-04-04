import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowRightLeft, Loader2, Users } from "lucide-react";
import { useWhazingQueues, useTransferToQueue } from "@/hooks/useWhazingQueues";
import { useQueueUsers } from "@/hooks/useWhazingQueueUsers";
import { toast } from "sonner";

interface TransferQueueDialogProps {
  ticketId: string;
  currentQueueId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function QueueUserCount({ queueId }: { queueId: string }) {
  const { data: users } = useQueueUsers(queueId);
  const count = (users || []).length;
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
      <Users className="h-3 w-3" />
      {count}
    </span>
  );
}

export default function TransferQueueDialog({
  ticketId,
  currentQueueId,
  open,
  onOpenChange,
}: TransferQueueDialogProps) {
  const { data: queues } = useWhazingQueues();
  const transfer = useTransferToQueue();
  const [selected, setSelected] = useState<string | null>(null);

  const handleTransfer = async () => {
    if (!selected) return;
    try {
      await transfer.mutateAsync({ ticketId, queueId: selected });
      toast.success("Ticket transferido");
      onOpenChange(false);
      setSelected(null);
    } catch {
      toast.error("Erro ao transferir");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir para Fila
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {(queues || []).map((q) => (
            <button
              key={q.id}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                selected === q.id
                  ? "border-primary bg-primary/5"
                  : currentQueueId === q.id
                  ? "border-muted bg-muted/50 opacity-50"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => currentQueueId !== q.id && setSelected(q.id)}
              disabled={currentQueueId === q.id}
            >
              <span className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: q.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{q.name}</p>
                {q.description && (
                  <p className="text-xs text-muted-foreground">{q.description}</p>
                )}
              </div>
              <QueueUserCount queueId={q.id} />
              {currentQueueId === q.id && (
                <span className="text-xs text-muted-foreground">Atual</span>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleTransfer} disabled={!selected || transfer.isPending}>
            {transfer.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
