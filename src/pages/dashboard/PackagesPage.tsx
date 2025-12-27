import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Settings2,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PackageTemplateDialog } from "@/components/packages/PackageTemplateDialog";
import { PatientPackageDialog } from "@/components/packages/PatientPackageDialog";
import { PackageDetailsDialog } from "@/components/packages/PackageDetailsDialog";

interface PackageTemplate {
  id: string;
  name: string;
  description: string | null;
  procedure_id: string | null;
  total_sessions: number;
  price: number;
  validity_days: number | null;
  is_active: boolean;
  procedure?: { name: string } | null;
}

interface PatientPackage {
  id: string;
  name: string;
  description: string | null;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  price: number;
  purchase_date: string;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  patient: { id: string; name: string; phone: string } | null;
  procedure?: { name: string } | null;
}

export default function PackagesPage() {
  const { currentClinic } = useAuth();
  const [activeTab, setActiveTab] = useState("packages");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [packages, setPackages] = useState<PatientPackage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PackageTemplate | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PatientPackage | null>(null);

  useEffect(() => {
    if (currentClinic?.id) {
      fetchData();
    }
  }, [currentClinic?.id]);

  const fetchData = async () => {
    if (!currentClinic?.id) return;
    setLoading(true);

    try {
      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("package_templates")
        .select("*, procedure:procedures(name)")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

      // Fetch patient packages
      const { data: packagesData, error: packagesError } = await supabase
        .from("patient_packages")
        .select("*, patient:patients(id, name, phone), procedure:procedures(name)")
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (packagesError) throw packagesError;
      setPackages(packagesData || []);
    } catch (error) {
      console.error("Error fetching packages:", error);
      toast.error("Erro ao carregar pacotes");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este modelo de pacote?")) return;

    try {
      const { error } = await supabase
        .from("package_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Modelo excluído com sucesso");
      fetchData();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir modelo");
    }
  };

  const handleCancelPackage = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este pacote?")) return;

    try {
      const { error } = await supabase
        .from("patient_packages")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Pacote cancelado com sucesso");
      fetchData();
    } catch (error) {
      console.error("Error cancelling package:", error);
      toast.error("Erro ao cancelar pacote");
    }
  };

  const getStatusBadge = (status: string, expiryDate: string | null) => {
    // Check if expired
    if (expiryDate && isPast(new Date(expiryDate)) && status === "active") {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Expirado</Badge>;
    }
    
    // Check if expiring soon (within 7 days)
    if (expiryDate && status === "active") {
      const daysLeft = differenceInDays(new Date(expiryDate), new Date());
      if (daysLeft <= 7 && daysLeft > 0) {
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600"><Clock className="h-3 w-3" />Expira em {daysLeft}d</Badge>;
      }
    }

    switch (status) {
      case "active":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />Ativo</Badge>;
      case "completed":
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Concluído</Badge>;
      case "expired":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Expirado</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredPackages = packages.filter((pkg) => {
    const matchesSearch =
      pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.patient?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || pkg.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Summary stats
  const activePackages = packages.filter(p => p.status === "active").length;
  const expiringPackages = packages.filter(p => {
    if (!p.expiry_date || p.status !== "active") return false;
    const daysLeft = differenceInDays(new Date(p.expiry_date), new Date());
    return daysLeft <= 7 && daysLeft > 0;
  }).length;
  const completedPackages = packages.filter(p => p.status === "completed").length;

  return (
    <RoleGuard permission="view_stock">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Pacotes de Sessões</h1>
            <p className="text-muted-foreground">
              Gerencie pacotes de procedimentos recorrentes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setSelectedTemplate(null);
              setTemplateDialogOpen(true);
            }}>
              <Settings2 className="h-4 w-4 mr-2" />
              Novo Modelo
            </Button>
            <Button onClick={() => {
              setSelectedPackage(null);
              setPackageDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pacote
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activePackages}</p>
                  <p className="text-sm text-muted-foreground">Pacotes Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-yellow-500/10">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{expiringPackages}</p>
                  <p className="text-sm text-muted-foreground">Expirando em 7 dias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedPackages}</p>
                  <p className="text-sm text-muted-foreground">Pacotes Concluídos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="packages" className="gap-2">
              <Users className="h-4 w-4" />
              Pacotes de Pacientes
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Modelos de Pacotes
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === "packages" ? "Buscar por paciente ou pacote..." : "Buscar modelo..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {activeTab === "packages" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="completed">Concluídos</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Patient Packages Tab */}
          <TabsContent value="packages" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Pacote</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredPackages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum pacote encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPackages.map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pkg.patient?.name}</p>
                              <p className="text-sm text-muted-foreground">{pkg.patient?.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pkg.name}</p>
                              {pkg.procedure && (
                                <p className="text-sm text-muted-foreground">{pkg.procedure.name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>{pkg.used_sessions}/{pkg.total_sessions} sessões</span>
                                <span className="text-muted-foreground">
                                  {Math.round((pkg.used_sessions / pkg.total_sessions) * 100)}%
                                </span>
                              </div>
                              <Progress 
                                value={(pkg.used_sessions / pkg.total_sessions) * 100} 
                                className="h-2"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            {pkg.expiry_date ? (
                              <div>
                                <p className="text-sm">
                                  {format(new Date(pkg.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                                {pkg.status === "active" && !isPast(new Date(pkg.expiry_date)) && (
                                  <p className="text-xs text-muted-foreground">
                                    {differenceInDays(new Date(pkg.expiry_date), new Date())} dias restantes
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Sem validade</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(pkg.status, pkg.expiry_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedPackage(pkg);
                                  setDetailsDialogOpen(true);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedPackage(pkg);
                                  setPackageDialogOpen(true);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                {pkg.status === "active" && (
                                  <DropdownMenuItem 
                                    onClick={() => handleCancelPackage(pkg.id)}
                                    className="text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Procedimento</TableHead>
                      <TableHead>Sessões</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum modelo encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{template.name}</p>
                              {template.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {template.procedure?.name || (
                              <span className="text-muted-foreground">Qualquer</span>
                            )}
                          </TableCell>
                          <TableCell>{template.total_sessions}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(template.price)}
                          </TableCell>
                          <TableCell>
                            {template.validity_days ? (
                              `${template.validity_days} dias`
                            ) : (
                              <span className="text-muted-foreground">Sem limite</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={template.is_active ? "default" : "secondary"}>
                              {template.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedTemplate(template);
                                  setTemplateDialogOpen(true);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <PackageTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          template={selectedTemplate}
          onSuccess={fetchData}
        />

        <PatientPackageDialog
          open={packageDialogOpen}
          onOpenChange={setPackageDialogOpen}
          patientPackage={selectedPackage}
          templates={templates.filter(t => t.is_active)}
          onSuccess={fetchData}
        />

        <PackageDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          patientPackage={selectedPackage}
        />
      </div>
    </RoleGuard>
  );
}
