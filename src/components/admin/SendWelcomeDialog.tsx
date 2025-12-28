import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Mail, Copy, Check, Eye, EyeOff, RefreshCw, Send, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SendWelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  clinicName: string;
  clinicId: string;
}

interface ClinicUser {
  user_id: string;
  role: string;
  profile: {
    name: string | null;
    phone: string | null;
  } | null;
  email?: string;
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
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tempPassword, setTempPassword] = useState(generateTempPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [isSending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Carregar usuários da clínica
  useEffect(() => {
    if (open && clinicId) {
      fetchClinicUsers();
    }
  }, [open, clinicId]);

  const fetchClinicUsers = async () => {
    setLoadingUsers(true);
    try {
      // Buscar roles dos usuários da clínica
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("clinic_id", clinicId);

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setClinicUsers([]);
        return;
      }

      // Buscar perfis dos usuários
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", userIds);

      if (profilesError) {
        console.warn("Erro ao buscar perfis:", profilesError);
      }

      // Buscar emails dos usuários via edge function
      const { data: emailsData, error: emailsError } = await supabase.functions.invoke(
        "list-users-with-email"
      );

      if (emailsError) {
        console.warn("Não foi possível buscar emails:", emailsError);
      }

      const profileMap = new Map<string, { name: string | null; phone: string | null }>();
      (profiles || []).forEach((p: any) => {
        profileMap.set(p.user_id, { name: p.name, phone: p.phone });
      });

      const emailMap = new Map<string, string>();
      if (emailsData?.users) {
        emailsData.users.forEach((u: any) => {
          emailMap.set(u.id, u.email);
        });
      }

      const usersWithEmail = roles.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        profile: profileMap.get(r.user_id) || null,
        email: emailMap.get(r.user_id) || "",
      }));

      setClinicUsers(usersWithEmail);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar usuários da clínica");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const user = clinicUsers.find((u) => u.user_id === userId);
    if (user) {
      setEmail(user.email || "");
      setName(user.profile?.name || "");
    }
  };

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
      // Se for novo usuário, criar primeiro
      if (mode === "new") {
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
      handleClose();
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      toast.error(error.message || "Erro ao enviar email de boas-vindas");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMode("existing");
      setSelectedUserId("");
      setEmail("");
      setName("");
      setTempPassword(generateTempPassword());
      onClose();
    }
  };

  const roleLabels: Record<string, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    user: "Usuário",
    professional: "Profissional",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
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
          {/* Seleção de modo */}
          <RadioGroup
            value={mode}
            onValueChange={(v) => {
              setMode(v as "existing" | "new");
              setSelectedUserId("");
              setEmail("");
              setName("");
            }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="relative">
              <RadioGroupItem
                value="existing"
                id="mode-existing"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-existing"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Users className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Usuário Existente</span>
              </Label>
            </div>
            <div className="relative">
              <RadioGroupItem
                value="new"
                id="mode-new"
                className="peer sr-only"
              />
              <Label
                htmlFor="mode-new"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <UserPlus className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Novo Usuário</span>
              </Label>
            </div>
          </RadioGroup>

          {/* Seleção de usuário existente */}
          {mode === "existing" && (
            <div className="space-y-2">
              <Label>Selecionar usuário</Label>
              {loadingUsers ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : clinicUsers.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Nenhum usuário encontrado nesta clínica. Crie um novo usuário.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedUserId} onValueChange={handleUserSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clinicUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.profile?.name || "Sem nome"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({roleLabels[user.role] || user.role})
                          </span>
                          {user.email && (
                            <span className="text-xs text-muted-foreground">
                              - {user.email}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email do responsável</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSending || (mode === "existing" && !!selectedUserId)}
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
              disabled={isSending || (mode === "existing" && !!selectedUserId)}
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

          {mode === "new" && (
            <Alert className="bg-warning/10 border-warning/20">
              <AlertDescription className="text-sm">
                Um novo usuário será criado com a role de <strong>Proprietário</strong> para esta clínica.
              </AlertDescription>
            </Alert>
          )}

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
            <Button 
              type="submit" 
              disabled={isSending || (mode === "existing" && !selectedUserId)}
            >
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
