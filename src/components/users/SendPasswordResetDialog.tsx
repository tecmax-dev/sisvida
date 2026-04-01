import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, MessageSquare, Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SendPasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
}

export function SendPasswordResetDialog({
  open,
  onOpenChange,
  user,
}: SendPasswordResetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "whatsapp" | null>(null);

  const handleClose = () => {
    setSelectedChannel(null);
    onOpenChange(false);
  };

  const handleSend = async (channel: "email" | "whatsapp") => {
    if (!user) return;

    setSelectedChannel(channel);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-send-password-reset", {
        body: {
          targetUserId: user.user_id,
          channel,
          appBaseUrl: window.location.origin,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const channelLabel = channel === "email" ? "e-mail" : "WhatsApp";
      toast.success(`Link de redefinição enviado por ${channelLabel}!`, {
        description: channel === "email" 
          ? `Enviado para ${user.email}` 
          : `Enviado para ${user.phone || "telefone cadastrado"}`,
      });

      handleClose();
    } catch (err: any) {
      console.error("Error sending password reset:", err);
      toast.error(err.message || "Erro ao enviar link de redefinição");
    } finally {
      setLoading(false);
      setSelectedChannel(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar Reset de Senha
          </DialogTitle>
          <DialogDescription>
            Enviar link de redefinição de senha para{" "}
            <span className="font-medium text-foreground">{user?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || "Sem e-mail"} disabled className="bg-muted" />
          </div>

          {user?.phone && (
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={user.phone} disabled className="bg-muted" />
            </div>
          )}

          {!user?.email && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Usuário não possui e-mail cadastrado. Não é possível enviar reset.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => handleSend("email")}
              disabled={loading || !user?.email}
            >
              {loading && selectedChannel === "email" ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Mail className="h-6 w-6 text-primary" />
              )}
              <span className="text-sm font-medium">Enviar por E-mail</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 border-2 hover:border-emerald-500 hover:bg-emerald-500/5"
              onClick={() => handleSend("whatsapp")}
              disabled={loading || !user?.phone}
            >
              {loading && selectedChannel === "whatsapp" ? (
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              ) : (
                <MessageSquare className="h-6 w-6 text-emerald-500" />
              )}
              <span className="text-sm font-medium">Enviar por WhatsApp</span>
            </Button>
          </div>

          {!user?.phone && (
            <p className="text-xs text-muted-foreground text-center">
              WhatsApp indisponível: usuário sem telefone cadastrado
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
