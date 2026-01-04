import { useState, useEffect, useMemo } from "react";
import { 
  Building2, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Users, 
  Phone, 
  Mail, 
  MapPin, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Building,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Tag,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EmployerCategoryDialog from "@/components/employers/EmployerCategoryDialog";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Employer {
  id: string;
  clinic_id: string;
  cnpj: string;
  name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  category_id: string | null;
  category?: Category | null;
  patients?: { id: string; name: string }[];
}

interface EmployerFormData {
  cnpj: string;
  name: string;
  trade_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  is_active: boolean;
  category_id: string;
}

const initialFormData: EmployerFormData = {
  cnpj: "",
  name: "",
  trade_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  notes: "",
  is_active: true,
  category_id: "",
};

const ITEMS_PER_PAGE = 15;

export default function EmployersPage() {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [formData, setFormData] = useState<EmployerFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [expandedEmployer, setExpandedEmployer] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (currentClinic) {
      fetchEmployers();
      fetchCategories();
    }
  }, [currentClinic]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const fetchCategories = async () => {
    if (!currentClinic) return;
    try {
      const { data, error } = await supabase
        .from("employer_categories")
        .select("id, name, color")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchEmployers = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    try {
      const { data: employersData, error: employersError } = await supabase
        .from("employers")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (employersError) throw employersError;

      const { data: patientsData, error: patientsError } = await supabase
        .from("patients")
        .select("id, name, employer_cnpj, employer_name")
        .eq("clinic_id", currentClinic.id)
        .not("employer_cnpj", "is", null);

      if (patientsError) throw patientsError;

      const employersWithPatients = (employersData || []).map((employer) => ({
        ...employer,
        patients: (patientsData || []).filter(
          (p) => p.employer_cnpj === employer.cnpj
        ),
      }));

      const employerCnpjs = new Set((employersData || []).map((e) => e.cnpj));
      const orphanPatients = (patientsData || []).filter(
        (p) => p.employer_cnpj && !employerCnpjs.has(p.employer_cnpj)
      );

      const orphanGroups = orphanPatients.reduce((acc, patient) => {
        const cnpj = patient.employer_cnpj!;
        if (!acc[cnpj]) {
          acc[cnpj] = {
            id: `virtual-${cnpj}`,
            clinic_id: currentClinic.id,
            cnpj,
            name: patient.employer_name || "Empresa não cadastrada",
            trade_name: null,
            email: null,
            phone: null,
            address: null,
            city: null,
            state: null,
            notes: null,
            is_active: true,
            created_at: new Date().toISOString(),
            category_id: null,
            patients: [],
          };
        }
        acc[cnpj].patients!.push({ id: patient.id, name: patient.name });
        return acc;
      }, {} as Record<string, Employer>);

      setEmployers([...employersWithPatients, ...Object.values(orphanGroups)]);
    } catch (error) {
      console.error("Error fetching employers:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 14);
    return cleaned
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  };

  const handleOpenDialog = (employer?: Employer) => {
    if (employer && !employer.id.startsWith("virtual-")) {
      setSelectedEmployer(employer);
      setFormData({
        cnpj: formatCNPJ(employer.cnpj),
        name: employer.name,
        trade_name: employer.trade_name || "",
        email: employer.email || "",
        phone: employer.phone ? formatPhone(employer.phone) : "",
        address: employer.address || "",
        city: employer.city || "",
        state: employer.state || "",
        notes: employer.notes || "",
        is_active: employer.is_active,
        category_id: employer.category_id || "",
      });
    } else if (employer?.id.startsWith("virtual-")) {
      setSelectedEmployer(null);
      setFormData({
        ...initialFormData,
        cnpj: formatCNPJ(employer.cnpj),
        name: employer.name !== "Empresa não cadastrada" ? employer.name : "",
      });
    } else {
      setSelectedEmployer(null);
      setFormData(initialFormData);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentClinic) return;
    
    if (!formData.cnpj || !formData.name) {
      toast.error("CNPJ e Nome são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const cleanedCnpj = formData.cnpj.replace(/\D/g, "");
      const cleanedPhone = formData.phone.replace(/\D/g, "");

      const payload = {
        clinic_id: currentClinic.id,
        cnpj: cleanedCnpj,
        name: formData.name.trim(),
        trade_name: formData.trade_name.trim() || null,
        email: formData.email.trim() || null,
        phone: cleanedPhone || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
        category_id: formData.category_id || null,
      };

      if (selectedEmployer) {
        const { error } = await supabase
          .from("employers")
          .update(payload)
          .eq("id", selectedEmployer.id);
        
        if (error) throw error;
        toast.success("Empresa atualizada com sucesso");
      } else {
        const { error } = await supabase
          .from("employers")
          .insert(payload);
        
        if (error) {
          if (error.message.includes("unique")) {
            toast.error("Este CNPJ já está cadastrado");
            return;
          }
          throw error;
        }
        toast.success("Empresa cadastrada com sucesso");
      }

      setDialogOpen(false);
      fetchEmployers();
    } catch (error) {
      console.error("Error saving employer:", error);
      toast.error("Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployer) return;

    try {
      const { error } = await supabase
        .from("employers")
        .delete()
        .eq("id", selectedEmployer.id);
      
      if (error) throw error;
      
      toast.success("Empresa excluída com sucesso");
      setDeleteDialogOpen(false);
      setSelectedEmployer(null);
      fetchEmployers();
    } catch (error) {
      console.error("Error deleting employer:", error);
      toast.error("Erro ao excluir empresa");
    }
  };

  const filteredEmployers = useMemo(() => {
    return employers.filter((employer) => {
      // Filter by category
      if (categoryFilter !== "all") {
        if (categoryFilter === "none" && employer.category_id !== null) return false;
        if (categoryFilter !== "none" && employer.category_id !== categoryFilter) return false;
      }
      
      // Filter by search term
      const search = searchTerm.toLowerCase();
      return (
        employer.name.toLowerCase().includes(search) ||
        employer.cnpj.includes(search.replace(/\D/g, "")) ||
        employer.trade_name?.toLowerCase().includes(search) ||
        employer.patients?.some((p) => p.name.toLowerCase().includes(search))
      );
    });
  }, [employers, searchTerm, categoryFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredEmployers.length / ITEMS_PER_PAGE);
  const paginatedEmployers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployers, currentPage]);

  const activeCount = employers.filter(e => e.is_active).length;
  const inactiveCount = employers.filter(e => !e.is_active).length;
  const virtualCount = employers.filter(e => e.id.startsWith("virtual-")).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            Empresas
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie empresas e seus colaboradores vinculados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setCategoryDialogOpen(true)}
            className="gap-2"
          >
            <Tag className="h-4 w-4" />
            Categorias
          </Button>
          <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{employers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Ativas</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500 bg-rose-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-medium text-muted-foreground">Inativas</span>
            </div>
            <p className="text-xl font-bold text-rose-600 mt-1">{inactiveCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-1">{virtualCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Badge variant="outline" className="text-xs">
          {filteredEmployers.length} resultado{filteredEmployers.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Table */}
      {filteredEmployers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma empresa encontrada
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Cadastre uma nova empresa ou verifique os filtros
            </p>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Empresa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="font-semibold">Empresa</TableHead>
                  <TableHead className="font-semibold">CNPJ</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Contato</TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell">Localização</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-center">Pacientes</TableHead>
                  <TableHead className="font-semibold text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmployers.map((employer) => {
                  const isExpanded = expandedEmployer === employer.id;
                  const isVirtual = employer.id.startsWith("virtual-");
                  
                  return (
                    <Collapsible key={employer.id} open={isExpanded} onOpenChange={() => setExpandedEmployer(isExpanded ? null : employer.id)} asChild>
                      <>
                        <TableRow className={`h-12 ${!employer.is_active ? "opacity-60" : ""} hover:bg-muted/30 transition-colors`}>
                          <TableCell className="p-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                isVirtual 
                                  ? "bg-amber-100 text-amber-600" 
                                  : employer.is_active 
                                    ? "bg-primary/10 text-primary" 
                                    : "bg-muted text-muted-foreground"
                              }`}>
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                {isVirtual ? (
                                  <p className="font-medium text-sm truncate max-w-[200px]">
                                    {employer.name}
                                  </p>
                                ) : (
                                  <button
                                    onClick={() => navigate(`/dashboard/empresas/${employer.id}`)}
                                    className="font-medium text-sm truncate max-w-[200px] text-primary hover:underline text-left"
                                  >
                                    {employer.name}
                                  </button>
                                )}
                                {employer.trade_name && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {employer.trade_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {formatCNPJ(employer.cnpj)}
                            </code>
                          </TableCell>
                          <TableCell className="py-2 hidden md:table-cell">
                            <div className="flex flex-col gap-0.5">
                              {employer.phone && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {formatPhone(employer.phone)}
                                </span>
                              )}
                              {employer.email && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[150px]">
                                  <Mail className="h-3 w-3" />
                                  {employer.email}
                                </span>
                              )}
                              {!employer.phone && !employer.email && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 hidden lg:table-cell">
                            {employer.city ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {employer.city}{employer.state ? ` - ${employer.state}` : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            {isVirtual ? (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                Pendente
                              </Badge>
                            ) : employer.is_active ? (
                              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                Ativa
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200">
                                Inativa
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                (employer.patients?.length || 0) > 0 
                                  ? "bg-blue-50 text-blue-700" 
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              {employer.patients?.length || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <TooltipProvider>
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() => handleOpenDialog(employer)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                                {!isVirtual && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                        onClick={() => {
                                          setSelectedEmployer(employer);
                                          setDeleteDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Excluir</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-3 border-t">
                                {employer.patients && employer.patients.length > 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      Colaboradores vinculados:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                      {employer.patients.map((patient) => (
                                        <button
                                          key={patient.id}
                                          onClick={() => navigate(`/dashboard/patients/${patient.id}/edit`)}
                                          className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-primary/5 border border-border/50 transition-colors text-left"
                                        >
                                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Users className="h-3 w-3 text-primary" />
                                          </div>
                                          <span className="text-xs font-medium truncate">{patient.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    Nenhum colaborador vinculado a esta empresa
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployers.length)} de {filteredEmployers.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedEmployer ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da empresa
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) =>
                    setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })
                  }
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label htmlFor="name">Razão Social *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Nome da empresa"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="trade_name">Nome Fantasia</Label>
                <Input
                  id="trade_name"
                  value={formData.trade_name}
                  onChange={(e) =>
                    setFormData({ ...formData, trade_name: e.target.value })
                  }
                  placeholder="Nome fantasia"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: formatPhone(e.target.value) })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Rua, número, bairro"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })
                  }
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
            {/* Category Selection */}
            {categories.length > 0 && (
              <div>
                <Label>Categoria</Label>
                <Select 
                  value={formData.category_id || "none"} 
                  onValueChange={(value) => setFormData({ ...formData, category_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Observações sobre a empresa"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Empresa ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedEmployer ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A empresa será removida do sistema,
              mas os pacientes vinculados manterão o CNPJ no cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Management Dialog */}
      {currentClinic && (
        <EmployerCategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          clinicId={currentClinic.id}
          onCategoriesChange={fetchCategories}
        />
      )}
    </div>
  );
}
