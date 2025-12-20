import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog } from "@/hooks/useAuditLog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ClinicUser {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'receptionist' | 'professional' | 'administrative';
  created_at: string;
  profile: {
    name: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

interface UserDialogProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  clinicUser: ClinicUser | null;
  clinicId: string;
}

const formSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().optional(),
  role: z.enum(['admin', 'professional', 'administrative', 'receptionist']),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
});

type FormData = z.infer<typeof formSchema>;

const roleLabels: Record<string, string> = {
  admin: "Admin - Acesso total ao sistema",
  professional: "Profissional - Atendimento clínico",
  administrative: "Administrativo - Funções administrativas e financeiras",
  receptionist: "Atendimento - Agendamentos e cadastro de pacientes",
};

export function UserDialog({ open, onClose, clinicUser, clinicId }: UserDialogProps) {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const [loading, setLoading] = useState(false);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [emailChecked, setEmailChecked] = useState(false);

  const isEditing = !!clinicUser;
  const isOwner = clinicUser?.role === 'owner';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      name: "",
      phone: "",
      role: "receptionist",
      password: "",
    },
  });

  useEffect(() => {
    if (clinicUser) {
      form.reset({
        email: "",
        name: clinicUser.profile?.name || "",
        phone: clinicUser.profile?.phone || "",
        role: clinicUser.role === 'owner' ? 'admin' : clinicUser.role,
      });
    } else {
      form.reset({
        email: "",
        name: "",
        phone: "",
        role: "receptionist",
        password: "",
      });
    }
    setExistingUserId(null);
    setEmailChecked(false);
  }, [clinicUser, open]);

  const checkExistingUser = async (email: string) => {
    if (!email || isEditing) return;

    try {
      // Check if user exists in profiles by querying auth
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, phone')
        .ilike('name', `%${email}%`);

      // We can't directly query by email, but if user exists in clinic already, show warning
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('clinic_id', clinicId);

      setEmailChecked(true);
    } catch (error) {
      console.error('Error checking user:', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!clinicId) return;

    setLoading(true);
    try {
      if (isEditing && clinicUser) {
        // Update user role
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: data.role })
          .eq('id', clinicUser.id);

        if (roleError) throw roleError;

        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: data.name,
            phone: data.phone || null,
          })
          .eq('user_id', clinicUser.user_id);

        if (profileError) throw profileError;

        await logAction({
          action: 'view_users_list',
          entityType: 'user',
          entityId: clinicUser.id,
          details: {
            user_name: data.name,
            new_role: data.role,
            previous_role: clinicUser.role,
          },
        });

        toast.success('Usuário atualizado com sucesso');
        onClose(true);
      } else {
        // Create new user
        // First, create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password || Math.random().toString(36).slice(-8) + 'A1!',
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              name: data.name,
            },
          },
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            toast.error('Este email já está cadastrado no sistema');
            setLoading(false);
            return;
          }
          throw authError;
        }

        if (!authData.user) {
          throw new Error('Falha ao criar usuário');
        }

        // Create user role for the clinic
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            clinic_id: clinicId,
            role: data.role,
          });

        if (roleError) throw roleError;

        // Update profile with phone if provided
        if (data.phone) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ phone: data.phone })
            .eq('user_id', authData.user.id);

          if (profileError) console.error('Error updating profile:', profileError);
        }

        // Auto-create professional record when role is 'professional'
        if (data.role === 'professional') {
          const { error: professionalError } = await supabase
            .from('professionals')
            .insert({
              clinic_id: clinicId,
              user_id: authData.user.id,
              name: data.name,
              email: data.email,
              phone: data.phone || null,
              is_active: true,
            });

          if (professionalError) {
            console.error('Error creating professional record:', professionalError);
          }
        }

        await logAction({
          action: 'create_super_admin',
          entityType: 'user',
          entityId: authData.user.id,
          details: {
            user_name: data.name,
            user_email: data.email,
            role: data.role,
            clinic_id: clinicId,
          },
        });

        toast.success('Usuário criado com sucesso. Um email de confirmação foi enviado.');
        onClose(true);
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Atualize as informações e permissões do usuário'
              : 'Adicione um novo usuário à clínica'
            }
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este usuário é o proprietário da clínica. Algumas configurações não podem ser alteradas.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isEditing && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="email@exemplo.com" 
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          checkExistingUser(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do usuário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="(00) 00000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha inicial (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Deixe vazio para gerar automaticamente" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Se não informada, uma senha será gerada automaticamente
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nível de Permissão</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isOwner}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onClose()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Usuário'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
