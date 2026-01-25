import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FileText, Eye, Trash2, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TissGuidesPanelProps {
  clinicId: string;
}

interface TissGuide {
  id: string;
  clinic_id: string;
  patient_id: string;
  insurance_plan_id: string | null;
  guide_type: string;
  guide_number: string;
  beneficiary_name: string | null;
  beneficiary_card: string | null;
  authorization_number: string | null;
  execution_date: string | null;
  status: string;
  total_value: number;
  created_at: string;
  patient?: { name: string } | null;
  insurance_plan?: { name: string } | null;
}

const guideTypeLabels: Record<string, string> = {
  SP_SADT: "SP/SADT",
  CONSULTA: "Consulta",
  INTERNACAO: "Internação",
  HONORARIOS: "Honorários",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  sent: "Enviada",
  approved: "Aprovada",
  rejected: "Rejeitada",
  paid: "Paga",
  glossed: "Glosada",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  paid: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  glossed: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

export function TissGuidesPanel({ clinicId }: TissGuidesPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState({
    patient_id: "",
    insurance_plan_id: "_all",
    guide_type: "SP_SADT",
    beneficiary_name: "",
    beneficiary_card: "",
    authorization_number: "",
    execution_date: new Date().toISOString().split("T")[0],
  });

  // Fetch guides
  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["tiss-guides", clinicId, statusFilter],
    queryFn: async () => {
      if (!clinicId) return [];

      let query = supabase
        .from("tiss_guides")
        .select(`
          *,
          patient:patients(name),
          insurance_plan:insurance_plans(name)
        `)
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching TISS guides:", error);
        throw error;
      }
      return data as TissGuide[];
    },
    enabled: !!clinicId,
  });

  // Fetch patients
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-for-tiss", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .order("name")
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Fetch insurance plans
  const { data: insurancePlans = [] } = useQuery({
    queryKey: ["insurance-plans-for-tiss", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_plans")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate guide number
      const { data: guideNumber } = await supabase.rpc("generate_tiss_guide_number", {
        p_clinic_id: clinicId,
        p_guide_type: data.guide_type,
      });

      const { error } = await supabase.from("tiss_guides").insert({
        clinic_id: clinicId,
        patient_id: data.patient_id,
        insurance_plan_id: data.insurance_plan_id === "_all" ? null : data.insurance_plan_id,
        guide_type: data.guide_type,
        guide_number: guideNumber,
        beneficiary_name: data.beneficiary_name || null,
        beneficiary_card: data.beneficiary_card || null,
        authorization_number: data.authorization_number || null,
        execution_date: data.execution_date || null,
        status: "draft",
        total_value: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiss-guides", clinicId] });
      toast.success("Guia criada com sucesso");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao criar guia");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tiss_guides")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiss-guides", clinicId] });
      toast.success("Guia removida");
    },
    onError: () => {
      toast.error("Erro ao remover guia");
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({
      patient_id: "",
      insurance_plan_id: "_all",
      guide_type: "SP_SADT",
      beneficiary_name: "",
      beneficiary_card: "",
      authorization_number: "",
      execution_date: new Date().toISOString().split("T")[0],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id) {
      toast.error("Selecione um paciente");
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredGuides = guides.filter((guide) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      guide.guide_number?.toLowerCase().includes(searchLower) ||
      guide.patient?.name?.toLowerCase().includes(searchLower) ||
      guide.beneficiary_name?.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Guias TISS
          </CardTitle>
          <CardDescription>Gerencie guias SP/SADT, Consultas e Internações</CardDescription>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Guia
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredGuides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma guia encontrada
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuides.map((guide) => (
                  <TableRow key={guide.id}>
                    <TableCell className="font-mono font-medium">{guide.guide_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {guideTypeLabels[guide.guide_type] || guide.guide_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{guide.patient?.name || "-"}</TableCell>
                    <TableCell>{guide.insurance_plan?.name || "-"}</TableCell>
                    <TableCell>
                      {guide.execution_date
                        ? format(parseISO(guide.execution_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(guide.total_value || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[guide.status]}>
                        {statusLabels[guide.status] || guide.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(guide.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Guia TISS</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Guia *</Label>
              <Select
                value={formData.guide_type}
                onValueChange={(value) => setFormData({ ...formData, guide_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(guideTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select
                value={formData.patient_id}
                onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Convênio</Label>
              <Select
                value={formData.insurance_plan_id}
                onValueChange={(value) => setFormData({ ...formData, insurance_plan_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Nenhum</SelectItem>
                  {insurancePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carteirinha</Label>
                <Input
                  value={formData.beneficiary_card}
                  onChange={(e) => setFormData({ ...formData, beneficiary_card: e.target.value })}
                  placeholder="Número da carteirinha"
                />
              </div>
              <div className="space-y-2">
                <Label>Autorização</Label>
                <Input
                  value={formData.authorization_number}
                  onChange={(e) =>
                    setFormData({ ...formData, authorization_number: e.target.value })
                  }
                  placeholder="Número da autorização"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome do Beneficiário</Label>
              <Input
                value={formData.beneficiary_name}
                onChange={(e) => setFormData({ ...formData, beneficiary_name: e.target.value })}
                placeholder="Nome conforme carteirinha"
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Execução</Label>
              <Input
                type="date"
                value={formData.execution_date}
                onChange={(e) => setFormData({ ...formData, execution_date: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Criar Guia
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
