import { useState } from "react";
import { Mail, Loader2, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface SendAccessCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "accounting_office" | "employer";
  entityId: string;
  entityName: string;
  currentEmail: string;
}

export function SendAccessCodeDialog({
  open,
  onOpenChange,
  type,
  entityId,
  entityName,
  currentEmail,
}: SendAccessCodeDialogProps) {
  const { currentClinic } = useAuth();
  const [email, setEmail] = useState(currentEmail);
  const [updateEmail, setUpdateEmail] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isEmailDifferent = email.toLowerCase().trim() !== currentEmail.toLowerCase().trim();

  const handleSend = async () => {
    if (!email || !currentClinic) {
      toast.error("Email é obrigatório");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Email inválido");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-portal-access-code", {
        body: {
          type,
          entityId,
          recipientEmail: email.toLowerCase().trim(),
          recipientName: entityName,
          clinicName: currentClinic.name,
          clinicSlug: currentClinic.slug,
          updateEmail: isEmailDifferent && updateEmail,
        },
      });

      if (error) throw error;

      toast.success("Código de acesso enviado com sucesso!");
      
      if (isEmailDifferent && updateEmail) {
        toast.info("Email atualizado no cadastro");
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending access code:", error);
      toast.error(error.message || "Erro ao enviar código de acesso");
    } finally {
      setIsSending(false);
    }
  };

  const portalName = type === "accounting_office" ? "Portal do Contador" : "Portal da Empresa";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Enviar Código de Acesso
          </DialogTitle>
          <DialogDescription>
            Envie o código de acesso do {portalName} por e-mail para <strong>{entityName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail do destinatário</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {currentEmail && (
              <p className="text-xs text-muted-foreground">
                E-mail cadastrado: {currentEmail}
              </p>
            )}
          </div>

          {isEmailDifferent && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  O e-mail informado é diferente do cadastrado.
                </p>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="updateEmail"
                    checked={updateEmail}
                    onCheckedChange={(checked) => setUpdateEmail(checked === true)}
                  />
                  <label
                    htmlFor="updateEmail"
                    className="text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer"
                  >
                    Atualizar e-mail no cadastro
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending || !email}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar Código
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
