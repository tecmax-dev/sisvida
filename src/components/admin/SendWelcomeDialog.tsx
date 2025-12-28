import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Copy, Check, Eye, EyeOff, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

interface SendWelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  clinicName: string;
  clinicId: string;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function SendWelcomeDialog({
  open,
  onClose,
  clinicName,
  clinicId,
}: SendWelcomeDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tempPassword, setTempPassword] = useState(generateTempPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [isSending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createUser, setCreateUser] = useState(true);

  const handleRegeneratePassword = () => {
    setTempPassword(generateTempPassword());
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    toast.success("Senha copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !name || !tempPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSending(true);

    try {
      // Se createUser estiver ativo, criar o usuário primeiro
      if (createUser) {
        // Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: tempPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              name,
            },
          },
        });

        if (authError) {
          // Se o usuário já existe, apenas enviar o email
          if (authError.message.includes("already registered")) {
            toast.warning("Usuário já existe. Enviando email de boas-vindas...");
          } else {
            throw authError;
          }
        }

        // Se o usuário foi criado, adicionar perfil e role
        if (authData?.user) {
          // Atualizar perfil
          await supabase
            .from("profiles")
            .upsert({
              user_id: authData.user.id,
              name,
              updated_at: new Date().toISOString(),
            });

          // Adicionar role de owner para a clínica
          await supabase
            .from("user_roles")
            .insert({
              user_id: authData.user.id,
              clinic_id: clinicId,
              role: "owner",
            });
        }
      }

      // Enviar email de boas-vindas
      const { data, error } = await supabase.functions.invoke("send-user-credentials", {
        body: {
          userEmail: email,
          userName: name,
          tempPassword,
          clinicName,
        },
      });

      if (error) throw error;

      toast.success("Email de boas-vindas enviado com sucesso!");
      onClose();
      
      // Reset form
      setEmail("");
      setName("");
      setTempPassword(generateTempPassword());
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      toast.error(error.message || "Erro ao enviar email de boas-vindas");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setEmail("");
      setName("");
      setTempPassword(generateTempPassword());
      setCreateUser(true);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Enviar Boas-Vindas
          </DialogTitle>
          <DialogDescription>
            Envie um email com credenciais de acesso para a clínica{" "}
            <strong>{clinicName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do responsável</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome do responsável</Label>
            <Input
              id="name"
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha temporária</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  required
                  disabled={isSending}
                  className="pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSending}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRegeneratePassword}
                disabled={isSending}
                title="Gerar nova senha"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyPassword}
                disabled={isSending}
                title="Copiar senha"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createUser"
              checked={createUser}
              onChange={(e) => setCreateUser(e.target.checked)}
              disabled={isSending}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="createUser" className="text-sm font-normal cursor-pointer">
              Criar usuário no sistema (se não existir)
            </Label>
          </div>

          <Alert className="bg-info/10 border-info/20">
            <AlertDescription className="text-sm text-info">
              O usuário receberá um email com as credenciais de acesso e um link para o sistema. 
              Recomende que ele altere a senha no primeiro acesso.
            </AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Email
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
