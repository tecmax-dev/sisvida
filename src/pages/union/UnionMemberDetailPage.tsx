import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2, Users, UserX, UserCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UnionMemberBadge } from "@/components/union/members/UnionMemberBadge";

// Import reusable patient components (excluding medical records)
import { PatientCardsModal } from "@/components/patients/modals/PatientCardsModal";
import { DependentsPanel } from "@/components/patients/DependentsPanel";

interface UnionMember {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  photo_url: string | null;
  notes: string | null;
  registration_number: string | null;
  clinic_id: string;
  // Union specific fields
  is_union_member: boolean;
  union_member_status: string | null;
  union_category_id: string | null;
  union_joined_at: string | null;
  union_contribution_value: number | null;
  union_payment_method: string | null;
  union_observations: string | null;
}

interface Category {
  id: string;
  nome: string;
  valor_contribuicao: number;
}

export default function UnionMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentClinic, user } = useAuth();
  const { canManageMembers } = useUnionPermissions();
  const { toast } = useToast();

  const [member, setMember] = useState<UnionMember | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");

  // Editable union fields
  const [unionStatus, setUnionStatus] = useState("");
  const [unionCategoryId, setUnionCategoryId] = useState("");
  const [unionContribution, setUnionContribution] = useState("");
  const [unionPaymentMethod, setUnionPaymentMethod] = useState("");
  const [unionObservations, setUnionObservations] = useState("");

  // Modal states
  const [cardsModalOpen, setCardsModalOpen] = useState(false);

  const isUnionContext = location.pathname.startsWith("/union");

  const fetchMember = useCallback(async () => {
    if (!id || !currentClinic) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .eq("clinic_id", currentClinic.id)
        .single();

      if (error) throw error;

      if (!data.is_union_member) {
        toast({
          title: "Acesso negado",
          description: "Este paciente não é um associado sindical.",
          variant: "destructive",
        });
        navigate("/union/socios");
        return;
      }

      setMember(data);
      setUnionStatus(data.union_member_status || "pendente");
      setUnionCategoryId(data.union_category_id || "");
      setUnionContribution(data.union_contribution_value?.toString() || "");
      setUnionPaymentMethod(data.union_payment_method || "");
      setUnionObservations(data.union_observations || "");
    } catch (error) {
      console.error("Error fetching member:", error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, currentClinic, navigate, toast]);

  const fetchCategories = async () => {
    if (!currentClinic) return;

    const { data } = await supabase
      .from("sindical_categorias")
      .select("id, nome, valor_contribuicao")
      .eq("sindicato_id", currentClinic.id)
      .eq("ativo", true)
      .order("nome");

    setCategories(data || []);
  };

  useEffect(() => {
    if (currentClinic && id) {
      fetchMember();
      fetchCategories();
    }
  }, [currentClinic, id, fetchMember]);

  const handleSaveUnionData = async () => {
    if (!member || !currentClinic || !user) return;

    setSaving(true);
    try {
      const oldValues = {
        union_member_status: member.union_member_status,
        union_category_id: member.union_category_id,
        union_contribution_value: member.union_contribution_value,
        union_payment_method: member.union_payment_method,
        union_observations: member.union_observations,
      };

      const newValues = {
        union_member_status: unionStatus,
        union_category_id: unionCategoryId || null,
        union_contribution_value: unionContribution ? parseFloat(unionContribution) : null,
        union_payment_method: unionPaymentMethod || null,
        union_observations: unionObservations || null,
      };

      const { error: updateError } = await supabase
        .from("patients")
        .update(newValues)
        .eq("id", member.id);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from("union_member_audit_logs").insert({
        clinic_id: currentClinic.id,
        patient_id: member.id,
        action: "data_update",
        old_values: oldValues,
        new_values: newValues,
        performed_by: user.id,
        module_origin: "sindical",
      });

      toast({ title: "Dados sindicais atualizados!" });
      fetchMember();
    } catch (error: any) {
      console.error("Error updating:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkMember = async () => {
    if (!member || !currentClinic || !user) return;

    if (!confirm("Tem certeza que deseja desvincular este associado? O cadastro como paciente será mantido.")) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("patients")
        .update({
          is_union_member: false,
          union_member_status: null,
          union_category_id: null,
          union_contribution_value: null,
          union_payment_method: null,
          union_observations: null,
        })
        .eq("id", member.id);

      if (error) throw error;

      // Log the action
      await supabase.from("union_member_audit_logs").insert({
        clinic_id: currentClinic.id,
        patient_id: member.id,
        action: "unlink",
        old_values: {
          is_union_member: true,
          union_member_status: member.union_member_status,
        },
        new_values: { is_union_member: false },
        performed_by: user.id,
        module_origin: "sindical",
      });

      toast({ title: "Associado desvinculado com sucesso" });
      navigate("/union/socios");
    } catch (error: any) {
      toast({
        title: "Erro ao desvincular",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Associado não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/union/socios")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    ativo: { label: "Ativo", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    pendente: { label: "Pendente", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    inativo: { label: "Inativo", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
    suspenso: { label: "Suspenso", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  };

  const currentStatus = statusConfig[member.union_member_status || "pendente"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/union/socios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              <Badge variant="outline" className={currentStatus.color}>
                {currentStatus.label}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              CPF: {formatCPF(member.cpf)} • Matrícula: {member.registration_number || "-"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCardsModalOpen(true)}>
            Carteirinha
          </Button>
          {canManageMembers() && (
            <Button variant="destructive" size="sm" onClick={handleUnlinkMember}>
              <UserX className="h-4 w-4 mr-2" />
              Desvincular
            </Button>
          )}
        </div>
      </div>

      {/* Tabs - Excluding sensitive medical tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="sindical">Dados Sindicais</TabsTrigger>
          <TabsTrigger value="dependentes">Dependentes</TabsTrigger>
          {/* NOTE: Prontuários, Anamnese, Atendimentos tabs are NOT shown in union context */}
        </TabsList>

        <TabsContent value="dados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground text-xs">Nome Completo</Label>
                <p className="font-medium">{member.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">CPF</Label>
                <p className="font-medium font-mono">{formatCPF(member.cpf)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">RG</Label>
                <p className="font-medium">{member.rg || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Data de Nascimento</Label>
                <p className="font-medium">
                  {member.birth_date
                    ? format(new Date(member.birth_date), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Telefone</Label>
                <p className="font-medium">{member.phone || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">E-mail</Label>
                <p className="font-medium">{member.email || "-"}</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Endereço</Label>
                <p className="font-medium">
                  {[member.address, member.city, member.state, member.cep]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sindical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Dados Sindicais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status da Filiação</Label>
                  <Select
                    value={unionStatus}
                    onValueChange={setUnionStatus}
                    disabled={!canManageMembers()}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data de Filiação</Label>
                  <Input
                    value={
                      member.union_joined_at
                        ? format(new Date(member.union_joined_at), "dd/MM/yyyy", { locale: ptBR })
                        : "-"
                    }
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={unionCategoryId}
                    onValueChange={setUnionCategoryId}
                    disabled={!canManageMembers()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor da Contribuição (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unionContribution}
                    onChange={(e) => setUnionContribution(e.target.value)}
                    disabled={!canManageMembers()}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select
                    value={unionPaymentMethod}
                    onValueChange={setUnionPaymentMethod}
                    disabled={!canManageMembers()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="debito_folha">Débito em Folha</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={unionObservations}
                  onChange={(e) => setUnionObservations(e.target.value)}
                  placeholder="Observações sobre a filiação..."
                  rows={3}
                  disabled={!canManageMembers()}
                />
              </div>

              {canManageMembers() && (
                <div className="flex justify-end">
                  <Button onClick={handleSaveUnionData} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Alterações
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependentes">
          <Card>
            <CardContent className="pt-6">
              {member && <DependentsPanel patientId={member.id} clinicId={member.clinic_id} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {member && (
        <PatientCardsModal
          open={cardsModalOpen}
          onOpenChange={setCardsModalOpen}
          patientId={member.id}
          patientName={member.name}
        />
      )}
    </div>
  );
}
