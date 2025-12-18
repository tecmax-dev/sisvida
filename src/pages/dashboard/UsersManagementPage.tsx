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
import { Search, Plus, UserCog, Shield, Edit, AlertCircle } from "lucide-react";
import { UserDialog } from "@/components/users/UserDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Navigate } from "react-router-dom";

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
  email?: string;
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
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClinicUser | null>(null);

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
      // Fetch user roles with profiles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role,
          created_at
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Fetch profiles for these users
      const userIds = rolesData?.map(r => r.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, phone, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const usersWithProfiles = rolesData?.map(role => ({
        ...role,
        profile: profilesData?.find(p => p.user_id === role.user_id) || null,
      })) || [];

      setUsers(usersWithProfiles as ClinicUser[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (clinicUser: ClinicUser) => {
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
    u.profile?.phone?.includes(searchTerm)
  );

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
                {filteredUsers.length} usuário(s) encontrado(s)
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((clinicUser) => (
                    <TableRow key={clinicUser.id}>
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
                            {clinicUser.user_id === user?.id && (
                              <Badge variant="outline" className="text-xs">Você</Badge>
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
        clinicUser={selectedUser}
        clinicId={currentClinic?.id || ''}
      />
    </div>
  );
}
