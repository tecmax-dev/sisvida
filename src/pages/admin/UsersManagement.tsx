import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Users, 
  Search, 
  Shield,
  Building2,
  Pencil,
  Mail,
  AlertCircle,
  Trash2,
  Key,
  UserX,
  Phone
} from "lucide-react";
import { EditUserEmailDialog } from "@/components/admin/EditUserEmailDialog";
import { EditUserPasswordDialog } from "@/components/admin/EditUserPasswordDialog";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserClinic {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  role: string;
}

interface UserWithEmail {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  isSuperAdmin: boolean;
  clinicsCount: number;
  clinics: UserClinic[];
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
}

interface ClinicInfo {
  id: string;
  name: string;
  slug: string;
  usersCount: number;
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  receptionist: "Recepcionista",
  professional: "Profissional",
  administrative: "Administrativo",
};

export default function UsersManagement() {
  const [users, setUsers] = useState<UserWithEmail[]>([]);
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"clinics" | "all" | "unlinked">("clinics");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithEmail | null>(null);
  const { logAction } = useAuditLog();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
    logAction({ action: 'view_users_list', entityType: 'user' });
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "list-users-with-email"
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setUsers(data?.users || []);
      setClinics(data?.clinics || []);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmail = (user: UserWithEmail) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleEditPassword = (user: UserWithEmail) => {
    setSelectedUser(user);
    setPasswordDialogOpen(true);
  };

  const handleDeleteUser = (user: UserWithEmail) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const canDeleteUser = (user: UserWithEmail): { allowed: boolean; reason?: string } => {
    if (user.user_id === currentUser?.id) {
      return { allowed: false, reason: "Você não pode excluir sua própria conta" };
    }
    if (user.isSuperAdmin) {
      return { allowed: false, reason: "Não é permitido excluir Super Admins" };
    }
    return { allowed: true };
  };

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter((user) =>
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      (user.phone && user.phone.includes(term))
    );
  }, [users, searchTerm]);

  // Users without any clinic
  const unlinkedUsers = useMemo(() => 
    filteredUsers.filter(u => u.clinicsCount === 0 && !u.isSuperAdmin),
    [filteredUsers]
  );

  // Super admins
  const superAdmins = useMemo(() => 
    filteredUsers.filter(u => u.isSuperAdmin),
    [filteredUsers]
  );

  // Get users for a specific clinic
  const getUsersForClinic = (clinicId: string) => {
    return filteredUsers.filter(u => 
      u.clinics.some(c => c.clinic_id === clinicId)
    );
  };

  // Filtered clinics based on search (show only clinics with matching users)
  const filteredClinics = useMemo(() => {
    if (!searchTerm) return clinics;
    return clinics.filter(clinic => 
      getUsersForClinic(clinic.id).length > 0
    );
  }, [clinics, searchTerm, filteredUsers]);

  const UserCard = ({ user, clinicContext }: { user: UserWithEmail; clinicContext?: string }) => {
    const deleteCheck = canDeleteUser(user);
    const userRoleInClinic = clinicContext 
      ? user.clinics.find(c => c.clinic_id === clinicContext)?.role 
      : null;

    return (
      <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 rounded-lg transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{user.name}</p>
              {user.isSuperAdmin && (
                <Badge variant="default" className="bg-warning text-warning-foreground shrink-0">
                  <Shield className="h-3 w-3 mr-1" />
                  Super Admin
                </Badge>
              )}
              {userRoleInClinic && (
                <Badge variant="outline" className="shrink-0">
                  {roleLabels[userRoleInClinic] || userRoleInClinic}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              {user.phone && (
                <span className="flex items-center gap-1 shrink-0">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEditEmail(user)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar email</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEditPassword(user)}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alterar senha</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteUser(user)}
                    disabled={!deleteCheck.allowed}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {deleteCheck.allowed ? "Excluir usuário" : deleteCheck.reason}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciar Usuários</h1>
        <p className="text-muted-foreground mt-1">
          Usuários organizados por clínica
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                {filteredUsers.length} usuários
              </Badge>
              <Badge variant="outline">
                <Building2 className="h-3 w-3 mr-1" />
                {clinics.length} clínicas
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="clinics" className="gap-2">
              <Building2 className="h-4 w-4" />
              Por Clínica
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Users className="h-4 w-4" />
              Todos
              <Badge variant="secondary" className="ml-1">{filteredUsers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unlinked" className="gap-2">
              <UserX className="h-4 w-4" />
              Sem Clínica
              {unlinkedUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1">{unlinkedUsers.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Por Clínica */}
          <TabsContent value="clinics" className="space-y-4">
            {/* Super Admins Section */}
            {superAdmins.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4 text-warning" />
                    Super Administradores
                    <Badge variant="secondary" className="ml-auto">{superAdmins.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {superAdmins.map(user => (
                      <UserCard key={user.user_id} user={user} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinics Accordion */}
            {filteredClinics.length > 0 ? (
              <Accordion type="multiple" className="space-y-2">
                {filteredClinics.map(clinic => {
                  const clinicUsers = getUsersForClinic(clinic.id);
                  if (clinicUsers.length === 0) return null;

                  return (
                    <AccordionItem 
                      key={clinic.id} 
                      value={clinic.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{clinic.name}</p>
                            <p className="text-sm text-muted-foreground">/{clinic.slug}</p>
                          </div>
                          <Badge variant="secondary" className="ml-auto mr-2">
                            {clinicUsers.length} usuário{clinicUsers.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <div className="divide-y border-t">
                          {clinicUsers.map(user => (
                            <UserCard 
                              key={user.user_id} 
                              user={user} 
                              clinicContext={clinic.id}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "Nenhuma clínica encontrada com usuários correspondentes" : "Nenhuma clínica cadastrada"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Todos */}
          <TabsContent value="all">
            <Card>
              <CardContent className="p-0">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredUsers.map(user => (
                      <UserCard key={user.user_id} user={user} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sem Clínica */}
          <TabsContent value="unlinked">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                  <UserX className="h-4 w-4" />
                  Usuários sem vínculo com clínica
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {unlinkedUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Todos os usuários estão vinculados a clínicas
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {unlinkedUsers.map(user => (
                      <UserCard key={user.user_id} user={user} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <EditUserEmailDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />

      <EditUserPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />

      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />
    </div>
  );
}