import { useState, useEffect } from "react";
import { Building2, Plus, Search, Edit, Trash2, Users, Phone, Mail, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
};

export default function EmployersPage() {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [formData, setFormData] = useState<EmployerFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [expandedEmployers, setExpandedEmployers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentClinic) {
      fetchEmployers();
    }
  }, [currentClinic]);

  const fetchEmployers = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    try {
      // Fetch employers
      const { data: employersData, error: employersError } = await supabase
        .from("employers")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (employersError) throw employersError;

      // Fetch patients with employer_cnpj
      const { data: patientsData, error: patientsError } = await supabase
        .from("patients")
        .select("id, name, employer_cnpj, employer_name")
        .eq("clinic_id", currentClinic.id)
        .not("employer_cnpj", "is", null);

      if (patientsError) throw patientsError;

      // Map patients to employers by CNPJ
      const employersWithPatients = (employersData || []).map((employer) => ({
        ...employer,
        patients: (patientsData || []).filter(
          (p) => p.employer_cnpj === employer.cnpj
        ),
      }));

      // Also find patients with CNPJ but no corresponding employer record
      const employerCnpjs = new Set((employersData || []).map((e) => e.cnpj));
      const orphanPatients = (patientsData || []).filter(
        (p) => p.employer_cnpj && !employerCnpjs.has(p.employer_cnpj)
      );

      // Group orphan patients by CNPJ and create virtual employers
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
      });
    } else if (employer?.id.startsWith("virtual-")) {
      // Creating from virtual employer
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

  const toggleExpanded = (id: string) => {
    setExpandedEmployers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredEmployers = employers.filter((employer) => {
    const search = searchTerm.toLowerCase();
    return (
      employer.name.toLowerCase().includes(search) ||
      employer.cnpj.includes(search.replace(/\D/g, "")) ||
      employer.trade_name?.toLowerCase().includes(search) ||
      employer.patients?.some((p) => p.name.toLowerCase().includes(search))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground">
            Gerencie as empresas e veja os pacientes vinculados
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">{filteredEmployers.length} empresas</Badge>
      </div>

      <div className="grid gap-4">
        {filteredEmployers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhuma empresa encontrada
              </h3>
              <p className="text-muted-foreground mb-4">
                Cadastre uma nova empresa ou verifique os filtros
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Empresa
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredEmployers.map((employer) => (
            <Card key={employer.id} className={!employer.is_active ? "opacity-60" : ""}>
              <Collapsible
                open={expandedEmployers.has(employer.id)}
                onOpenChange={() => toggleExpanded(employer.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{employer.name}</CardTitle>
                        {!employer.is_active && (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                        {employer.id.startsWith("virtual-") && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Não cadastrada
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        <span>CNPJ: {formatCNPJ(employer.cnpj)}</span>
                        {employer.trade_name && (
                          <span>Nome Fantasia: {employer.trade_name}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                        {employer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {formatPhone(employer.phone)}
                          </span>
                        )}
                        {employer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {employer.email}
                          </span>
                        )}
                        {employer.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {employer.city}{employer.state ? `, ${employer.state}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Users className="h-4 w-4 mr-1" />
                          {employer.patients?.length || 0} pacientes
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(employer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!employer.id.startsWith("virtual-") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedEmployer(employer);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {employer.patients && employer.patients.length > 0 ? (
                      <div className="border rounded-lg divide-y">
                        {employer.patients.map((patient) => (
                          <div
                            key={patient.id}
                            className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigate(`/dashboard/patients/${patient.id}/edit`)}
                          >
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{patient.name}</span>
                            </div>
                            <Button variant="ghost" size="sm">
                              Ver cadastro
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum paciente vinculado a esta empresa
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
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
    </div>
  );
}
