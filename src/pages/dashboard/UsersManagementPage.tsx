import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Search, 
  Plus, 
  UserCog, 
  Shield, 
  Edit, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  UserCheck,
  Users,
  UserX,
  Briefcase,
  Phone
} from "lucide-react";
import { UserDialog } from "@/components/users/UserDialog";
import { UserAvatar } from "@/components/users/UserAvatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Navigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface ClinicUserWithStatus {
  id?: string;
  user_id: string;
  role: 'owner' | 'admin' | 'receptionist' | 'professional' | 'administrative';
  access_group_id: string | null;
  professional_id: string | null;
  created_at: string;
  profile: {
    name: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  access_group?: {
    name: string;
  } | null;
  professional?: {
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

  // Stats
  const stats = useMemo(() => ({
    total: users.length,
    confirmed: users.filter(u => u.email_confirmed_at).length,
    pending: users.filter(u => !u.email_confirmed_at).length,
    admins: users.filter(u => u.role === 'owner' || u.role === 'admin').length,
    professionals: users.filter(u => u.professional_id).length,
  }), [users]);

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

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários e permissões da clínica
          </p>
        </div>
        <Button onClick={handleCreateUser} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Confirmados</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-1">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-purple-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">Admins</span>
            </div>
            <p className="text-xl font-bold text-purple-600 mt-1">{stats.admins}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Profissionais</span>
            </div>
            <p className="text-xl font-bold text-blue-600 mt-1">{stats.professionals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">
              Todos
              <Badge variant="secondary" className="ml-1.5 h-5">{filteredUsers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-3">
              <Clock className="h-3 w-3 mr-1" />
              Pendentes
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5">{pendingUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs px-3">
              <CheckCircle className="h-3 w-3 mr-1" />
              Confirmados
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Users List */}
      <Card>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
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
            <div className="text-center py-12 text-muted-foreground">
              <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">
                {searchTerm ? "Nenhum usuário encontrado" : 
                 activeTab === 'pending' ? "Nenhum usuário pendente de confirmação" :
                 activeTab === 'confirmed' ? "Nenhum usuário confirmado" :
                 "Nenhum usuário cadastrado"}
              </p>
              <p className="text-sm mt-1">
                {!searchTerm && activeTab === 'all' && "Clique em 'Novo Usuário' para adicionar"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Usuário</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold">Telefone</TableHead>
                  <TableHead className="font-semibold">Perfil</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold">Grupo de Acesso</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold">Profissional</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold">Desde</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayUsers.map((clinicUser) => {
                  const isConfirmed = !!clinicUser.email_confirmed_at;
                  const isConfirming = confirmingUserId === clinicUser.user_id;

                  return (
                    <TableRow key={clinicUser.user_id} className="h-12 hover:bg-muted/30 transition-colors">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar 
                            avatarUrl={clinicUser.profile?.avatar_url}
                            name={clinicUser.profile?.name || "U"}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <button
                              onClick={() => handleEditUser(clinicUser)}
                              disabled={clinicUser.role === 'owner' && clinicUser.user_id !== user?.id}
                              className="font-medium text-sm text-primary hover:underline text-left truncate max-w-[180px] block disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                            >
                              {clinicUser.profile?.name || 'Sem nome'}
                            </button>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {clinicUser.email || '-'}
                            </p>
                            {clinicUser.user_id === user?.id && (
                              <Badge variant="outline" className="text-xs mt-0.5">Você</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2">
                        {clinicUser.profile?.phone ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {clinicUser.profile.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge className={`${roleBadgeColors[clinicUser.role] || ''} text-xs`}>
                          {clinicUser.role === 'owner' && <Shield className="h-3 w-3 mr-1" />}
                          {roleLabels[clinicUser.role] || clinicUser.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-2">
                        {clinicUser.access_group ? (
                          <Badge variant="outline" className="text-xs">
                            {clinicUser.access_group.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2">
                        {clinicUser.professional ? (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
                            {clinicUser.professional.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {isConfirmed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Confirmado em {format(new Date(clinicUser.email_confirmed_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleConfirmUser(clinicUser.user_id)}
                                  disabled={isConfirming}
                                >
                                  {isConfirming ? (
                                    <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Confirmar e-mail</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(clinicUser.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem 
                              onClick={() => handleEditUser(clinicUser)}
                              disabled={clinicUser.role === 'owner' && clinicUser.user_id !== user?.id}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {!isConfirmed && (
                              <DropdownMenuItem 
                                onClick={() => handleConfirmUser(clinicUser.user_id)}
                                disabled={isConfirming}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Confirmar e-mail
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <UserDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        clinicUser={selectedUser ? {
          id: selectedUser.id || selectedUser.user_id,
          user_id: selectedUser.user_id,
          role: selectedUser.role,
          access_group_id: selectedUser.access_group_id,
          professional_id: selectedUser.professional_id,
          created_at: selectedUser.created_at,
          profile: selectedUser.profile
        } : null}
        clinicId={currentClinic?.id || ''}
      />
    </div>
  );
}
