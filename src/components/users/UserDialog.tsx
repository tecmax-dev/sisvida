import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useQuery } from "@tanstack/react-query";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
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
import { Loader2, AlertTriangle, Shield, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

function generateTempPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password + "Aa1!";
}

interface ClinicUser {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'receptionist' | 'professional' | 'administrative';
  access_group_id?: string | null;
  professional_id?: string | null;
  created_at: string;
  profile: { name: string; phone: string | null; avatar_url: string | null; } | null;
}

interface UserDialogProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  clinicUser: ClinicUser | null;
  clinicId: string;
}

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().optional(),
  role: z.enum(['admin', 'professional', 'administrative', 'receptionist']),
  access_group_id: z.string().optional(),
  professional_id: z.string().optional(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
});

const editUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().optional(),
  role: z.enum(['admin', 'professional', 'administrative', 'receptionist']),
  access_group_id: z.string().optional(),
  professional_id: z.string().optional(),
});

type CreateFormData = z.infer<typeof createUserSchema>;
type EditFormData = z.infer<typeof editUserSchema>;
type FormData = CreateFormData | EditFormData;

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

  const isEditing = !!clinicUser;
  const isOwner = clinicUser?.role === 'owner';

  const { data: accessGroups } = useQuery({
    queryKey: ['access-groups', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_groups')
        .select('id, name, description, is_system')
        .or(`clinic_id.eq.${clinicId},is_system.eq.true`)
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const { data: professionals } = useQuery({
    queryKey: ['professionals-for-linking', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(isEditing ? editUserSchema : createUserSchema),
    defaultValues: { email: "", name: "", phone: "", role: "receptionist", access_group_id: "", professional_id: "", password: "" },
  });

  useEffect(() => {
    if (clinicUser) {
      form.reset({
        email: "", name: clinicUser.profile?.name || "", phone: clinicUser.profile?.phone || "",
        role: clinicUser.role === 'owner' ? 'admin' : clinicUser.role,
        access_group_id: clinicUser.access_group_id || "", professional_id: clinicUser.professional_id || "",
      });
    } else {
      form.reset({ email: "", name: "", phone: "", role: "receptionist", access_group_id: "", professional_id: "", password: "" });
    }
  }, [clinicUser, open]);

  const onSubmit = async (data: FormData) => {
    if (!clinicId) return;
    setLoading(true);
    try {
      if (isEditing && clinicUser) {
        const { error: roleError } = await supabase.from('user_roles').update({
          role: data.role, access_group_id: data.access_group_id || null, professional_id: data.professional_id || null,
        }).eq('user_id', clinicUser.user_id).eq('clinic_id', clinicId);
        if (roleError) throw roleError;

        const { error: profileError } = await supabase.from('profiles').update({
          name: data.name, phone: data.phone || null,
        }).eq('user_id', clinicUser.user_id);
        if (profileError) throw profileError;

        await logAction({ action: 'update_user', entityType: 'user', entityId: clinicUser.id, details: { user_name: data.name, new_role: data.role } });
        toast.success('Usuário atualizado com sucesso');
        onClose(true);
      } else {
        const createData = data as CreateFormData;
        const tempPassword = createData.password || generateTempPassword();
        
        const { data: createResult, error: createError } = await supabase.functions.invoke('create-clinic-user', {
          body: { email: createData.email, password: tempPassword, name: createData.name, phone: createData.phone || null, role: createData.role, clinicId, accessGroupId: createData.access_group_id || null, professionalId: createData.professional_id || null },
        });

        if (createError || !createResult?.success) {
          const errorMessage = createResult?.error || createError?.message || 'Erro ao criar usuário';
          if (errorMessage.includes('já está cadastrado') || errorMessage.includes('already registered')) {
            toast.error('Este email já está cadastrado no sistema');
            setLoading(false);
            return;
          }
          throw new Error(errorMessage);
        }

        await logAction({ action: 'create_user', entityType: 'user', entityId: createResult.userId, details: { user_name: createData.name, user_email: createData.email, role: createData.role, clinic_id: clinicId } });
        toast.success('Usuário criado com sucesso! As credenciais foram enviadas por email.');
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
    <PopupBase open={open} onClose={() => onClose()} maxWidth="lg">
      <PopupHeader>
        <PopupTitle>{isEditing ? 'Editar Usuário' : 'Novo Usuário'}</PopupTitle>
        <PopupDescription>{isEditing ? 'Atualize as informações e permissões do usuário' : 'Adicione um novo usuário à clínica'}</PopupDescription>
      </PopupHeader>

      {isOwner && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Este usuário é o proprietário da clínica. Algumas configurações não podem ser alteradas.</AlertDescription>
        </Alert>
      )}

      <ScrollArea className="max-h-[60vh] pr-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isEditing && (
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Nome completo</FormLabel><FormControl><Input placeholder="Nome do usuário" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Telefone (opcional)</FormLabel><FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {!isEditing && (
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Senha inicial (opcional)</FormLabel><FormControl><Input type="password" placeholder="Deixe vazio para gerar automaticamente" {...field} /></FormControl><FormDescription>Se não informada, uma senha será gerada automaticamente</FormDescription><FormMessage /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem><FormLabel>Perfil Base</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isOwner}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o perfil" /></SelectTrigger></FormControl>
                  <SelectContent>{Object.entries(roleLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Define o perfil base do usuário.</FormDescription><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="access_group_id" render={({ field }) => (
              <FormItem><FormLabel className="flex items-center gap-2"><Shield className="h-4 w-4" />Grupo de Acesso</FormLabel>
                <Select onValueChange={(value) => field.onChange(value === "none" ? "" : value)} value={field.value || "none"} disabled={isOwner}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione um grupo (opcional)" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-muted-foreground">Nenhum (usar perfil base)</span></SelectItem>
                    {accessGroups?.map((group) => (<SelectItem key={group.id} value={group.id}><div className="flex items-center gap-2">{group.is_system && <Shield className="h-3 w-3 text-primary" />}<span>{group.name}</span></div></SelectItem>))}
                  </SelectContent>
                </Select>
                <FormDescription>Quando definido, as permissões do grupo sobrescrevem o perfil base.</FormDescription><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="professional_id" render={({ field }) => (
              <FormItem><FormLabel className="flex items-center gap-2"><User className="h-4 w-4" />Vincular a Profissional</FormLabel>
                <Select onValueChange={(value) => field.onChange(value === "none" ? "" : value)} value={field.value || "none"} disabled={isOwner}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione um profissional (opcional)" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-muted-foreground">Nenhum (ver toda a agenda)</span></SelectItem>
                    {professionals?.map((prof) => (<SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <FormDescription>Quando vinculado, o usuário só poderá ver a agenda deste profissional.</FormDescription><FormMessage />
              </FormItem>
            )} />

            <PopupFooter>
              <Button type="button" variant="outline" onClick={() => onClose()}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEditing ? 'Salvar' : 'Criar Usuário'}</Button>
            </PopupFooter>
          </form>
        </Form>
      </ScrollArea>
    </PopupBase>
  );
}
