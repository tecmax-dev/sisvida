import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, Plus, UserCog, Shield, Edit, AlertCircle, CheckCircle, Clock, UserCheck } from "lucide-react";
import { UserDialog } from "@/components/users/UserDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ClinicUserWithStatus {
  id?: string;
  user_id: string;
  role: 'owner' | 'admin' | 'receptionist' | 'professional' | 'administrative';
  access_group_id: string | null;
  created_at: string;
  profile: {
    name: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  access_group?: {
    name: string;
  } | null;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  professional: "Profissional",
  administrative: "Administrativo",
  receptionist: "Atendimento",
};

const roleBadgeColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  professional: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  administrative: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  receptionist: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function UsersManagementPage() {
  const { currentClinic, userRoles, user } = useAuth();
  const { logAction } = useAuditLog();
  const [users, setUsers] = useState<ClinicUserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClinicUserWithStatus | null>(null);
  const [confirmingUserId, setConfirmingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Check if current user is admin of the clinic
  const currentUserRole = userRoles.find(r => r.clinic_id === currentClinic?.id);
  const isAdmin = currentUserRole?.role === 'owner' || currentUserRole?.role === 'admin';

  useEffect(() => {
    if (currentClinic && isAdmin) {
      fetchUsers();
      logAction({ 
        action: 'view_users_list', 
        entityType: 'user', 
        entityId: currentClinic.id, 
        details: { clinic_name: currentClinic.name } 
      });
    }
  }, [currentClinic, isAdmin]);

  const fetchUsers = async () => {
    if (!currentClinic) return;

    setLoading(true);
    try {
      // Use edge function to get users with email confirmation status
      const { data, error } = await supabase.functions.invoke('list-clinic-users-with-status', {
        body: { clinic_id: currentClinic.id }
      });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(`Erro ao carregar usuários: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUser = async (userId: string) => {
    if (!currentClinic) return;
    
    setConfirmingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-user-email', {
        body: { user_id: userId, clinic_id: currentClinic.id }
      });

      if (error) {
        throw error;
      }

      toast.success("E-mail do usuário confirmado com sucesso!");
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === userId 
          ? { ...u, email_confirmed_at: new Date().toISOString() }
          : u
      ));

      logAction({
        action: 'confirm_user_email',
        entityType: 'user',
        entityId: userId,
        details: { clinic_id: currentClinic.id }
      });
    } catch (error: any) {
      console.error('Error confirming user:', error);
      toast.error(`Erro ao confirmar usuário: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setConfirmingUserId(null);
    }
  };

  const handleEditUser = (clinicUser: ClinicUserWithStatus) => {
    setSelectedUser(clinicUser);
    setDialogOpen(true);
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (success?: boolean) => {
    setDialogOpen(false);
    setSelectedUser(null);
    if (success) {
      fetchUsers();
    }
  };

  const filteredUsers = users.filter(u => 
    u.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.profile?.phone?.includes(searchTerm) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const confirmedUsers = filteredUsers.filter(u => u.email_confirmed_at);
  const pendingUsers = filteredUsers.filter(u => !u.email_confirmed_at);

  const displayUsers = activeTab === 'pending' ? pendingUsers : 
                       activeTab === 'confirmed' ? confirmedUsers : 
                       filteredUsers;

  // Redirect non-admin users
  if (!loading && !isAdmin) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar esta página. Apenas administradores podem gerenciar usuários.
          </AlertDescription>
        </Alert>
        <Navigate to="/dashboard" replace />
      </div>
    );
  }

  const UserRow = ({ clinicUser }: { clinicUser: ClinicUserWithStatus }) => {
    const isConfirmed = !!clinicUser.email_confirmed_at;
    const isConfirming = confirmingUserId === clinicUser.user_id;

    return (
      <TableRow key={clinicUser.user_id}>
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {clinicUser.profile?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium">
                {clinicUser.profile?.name || 'Sem nome'}
              </p>
              <p className="text-xs text-muted-foreground">
                {clinicUser.email || '-'}
              </p>
              {clinicUser.user_id === user?.id && (
                <Badge variant="outline" className="text-xs mt-1">Você</Badge>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>{clinicUser.profile?.phone || '-'}</TableCell>
        <TableCell>
          <Badge className={roleBadgeColors[clinicUser.role] || ''}>
            {clinicUser.role === 'owner' && <Shield className="h-3 w-3 mr-1" />}
            {roleLabels[clinicUser.role] || clinicUser.role}
          </Badge>
        </TableCell>
        <TableCell>
          {clinicUser.access_group ? (
            <Badge variant="outline" className="text-xs">
              {clinicUser.access_group.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
        <TableCell>
          {isConfirmed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Confirmado
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Confirmado em {format(new Date(clinicUser.email_confirmed_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                <Clock className="h-3 w-3 mr-1" />
                Pendente
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleConfirmUser(clinicUser.user_id)}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Confirmar e-mail manualmente</TooltipContent>
              </Tooltip>
            </div>
          )}
        </TableCell>
        <TableCell>
          {format(new Date(clinicUser.created_at), "dd/MM/yyyy", { locale: ptBR })}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditUser(clinicUser)}
            disabled={clinicUser.role === 'owner' && clinicUser.user_id !== user?.id}
            title={clinicUser.role === 'owner' && clinicUser.user_id !== user?.id ? 'Não é possível editar o proprietário' : 'Editar'}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground">
            Gerencie os usuários e permissões da clínica
          </p>
        </div>
        <Button onClick={handleCreateUser} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Usuários da Clínica</CardTitle>
              <CardDescription>
                {displayUsers.length} usuário(s) encontrado(s)
                {pendingUsers.length > 0 && activeTab !== 'pending' && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    • {pendingUsers.length} pendente(s)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                Todos
                <Badge variant="secondary" className="ml-1">{filteredUsers.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-3 w-3" />
                Pendentes
                {pendingUsers.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingUsers.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="gap-2">
                <CheckCircle className="h-3 w-3" />
                Confirmados
                <Badge variant="secondary" className="ml-1">{confirmedUsers.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhum usuário encontrado" : 
               activeTab === 'pending' ? "Nenhum usuário pendente de confirmação" :
               activeTab === 'confirmed' ? "Nenhum usuário confirmado" :
               "Nenhum usuário cadastrado"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Grupo de Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayUsers.map((clinicUser) => (
                    <UserRow key={clinicUser.user_id} clinicUser={clinicUser} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        clinicUser={selectedUser ? {
          id: selectedUser.id || selectedUser.user_id,
          user_id: selectedUser.user_id,
          role: selectedUser.role,
          access_group_id: selectedUser.access_group_id,
          created_at: selectedUser.created_at,
          profile: selectedUser.profile
        } : null}
        clinicId={currentClinic?.id || ''}
      />
    </div>
  );
}
