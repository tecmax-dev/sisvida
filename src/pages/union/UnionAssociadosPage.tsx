import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users,
  Eye,
  FileText,
  Phone,
  Mail,
  MapPin,
  Building2,
  Loader2,
  Plus,
  Share2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UnionCreateMemberDialog } from "@/components/union/members/UnionCreateMemberDialog";
import { UnionShareFiliacaoDialog } from "@/components/union/members/UnionShareFiliacaoDialog";

interface Associado {
  id: string;
  sindicato_id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  data_nascimento: string;
  sexo: string | null;
  estado_civil: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  empresa: string | null;
  cargo: string | null;
  tipo_vinculo: string | null;
  categoria_id: string | null;
  valor_contribuicao: number;
  forma_pagamento: string | null;
  documento_foto_url: string | null;
  documento_rg_url: string | null;
  documento_comprovante_url: string | null;
  status: string;
  observacoes: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  aprovado_at: string | null;
  rejeitado_at: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-800", icon: Clock },
  ativo: { label: "Ativo", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  inativo: { label: "Inativo", color: "bg-slate-100 text-slate-800", icon: XCircle },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-800", icon: XCircle },
};

const formatCPF = (cpf: string) => {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPhone = (phone: string) => {
  if (phone.length === 11) {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
};

export default function UnionAssociadosPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  const { canManageMembers } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedAssociado, setSelectedAssociado] = useState<Associado | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [createMemberOpen, setCreateMemberOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const clinicId = currentClinic?.id;

  // Buscar associados
  const { data: associados = [], isLoading } = useQuery({
    queryKey: ["sindical-associados", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("sindical_associados")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Associado[];
    },
  });

  // Aprovar associado e criar/vincular em patients
  const aprovarMutation = useMutation({
    mutationFn: async (associado: Associado) => {
      // 1. Primeiro, verificar se já existe um paciente com esse CPF
      const cpfDigits = associado.cpf.replace(/\D/g, "");
      const { data: existingPatient } = await supabase
        .from("patients")
        .select("id")
        .or(`cpf.eq.${cpfDigits},cpf.eq.${associado.cpf}`)
        .eq("clinic_id", associado.sindicato_id)
        .maybeSingle();

      let patientId = existingPatient?.id;

      // 2. Se não existe, criar novo paciente
      if (!patientId) {
        const { data: newPatient, error: patientError } = await supabase
          .from("patients")
          .insert({
            clinic_id: associado.sindicato_id,
            name: associado.nome,
            cpf: cpfDigits,
            email: associado.email,
            phone: associado.telefone,
            birth_date: associado.data_nascimento,
            gender: associado.sexo === "masculino" ? "male" : associado.sexo === "feminino" ? "female" : null,
            address: associado.logradouro ? `${associado.logradouro}, ${associado.numero || ""}${associado.complemento ? ` - ${associado.complemento}` : ""}` : null,
            city: associado.cidade,
            state: associado.uf,
            cep: associado.cep,
            is_union_member: true,
            union_status: "ativo",
            union_category_id: associado.categoria_id,
            union_contribution_value: associado.valor_contribuicao,
            union_join_date: new Date().toISOString(),
            union_observations: `Aprovado via formulário de filiação em ${new Date().toLocaleDateString("pt-BR")}`,
          })
          .select("id")
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
      } else {
        // 3. Se já existe, atualizar para marcar como membro sindical
        const { error: updateError } = await supabase
          .from("patients")
          .update({
            is_union_member: true,
            union_status: "ativo",
            union_category_id: associado.categoria_id,
            union_contribution_value: associado.valor_contribuicao,
            union_join_date: new Date().toISOString(),
            union_observations: `Aprovado via formulário de filiação em ${new Date().toLocaleDateString("pt-BR")}`,
          })
          .eq("id", patientId);

        if (updateError) throw updateError;
      }

      // 4. Atualizar status na tabela sindical_associados
      const { error } = await supabase
        .from("sindical_associados")
        .update({ 
          status: "ativo",
          aprovado_at: new Date().toISOString(),
        })
        .eq("id", associado.id);
      if (error) throw error;

      // 5. Registrar auditoria
      await supabase.from("union_member_audit_logs").insert({
        patient_id: patientId,
        clinic_id: associado.sindicato_id,
        action: "approved_membership",
        changes: {
          source: "sindical_associados",
          associado_id: associado.id,
          approved_at: new Date().toISOString(),
        },
      });

      return patientId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sindical-associados"] });
      toast({ 
        title: "Associado aprovado com sucesso!", 
        description: "O sócio foi vinculado e já aparece na lista de Sócios." 
      });
      setShowDetailDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    },
  });

  // Rejeitar associado
  const rejeitarMutation = useMutation({
    mutationFn: async ({ associadoId, motivo }: { associadoId: string; motivo: string }) => {
      const { error } = await supabase
        .from("sindical_associados")
        .update({ 
          status: "rejeitado",
          rejeitado_at: new Date().toISOString(),
          motivo_rejeicao: motivo,
        })
        .eq("id", associadoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sindical-associados"] });
      toast({ title: "Solicitação rejeitada" });
      setShowRejectDialog(false);
      setShowDetailDialog(false);
      setRejectReason("");
    },
    onError: (error: any) => {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    },
  });

  // Filtrar por busca
  const filteredAssociados = associados.filter((a) => {
    const searchLower = search.toLowerCase();
    return (
      a.nome.toLowerCase().includes(searchLower) ||
      a.cpf.includes(search.replace(/\D/g, "")) ||
      a.email.toLowerCase().includes(searchLower)
    );
  });

  // Estatísticas
  const stats = {
    total: associados.length,
    pendentes: associados.filter((a) => a.status === "pendente").length,
    ativos: associados.filter((a) => a.status === "ativo").length,
    rejeitados: associados.filter((a) => a.status === "rejeitado").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Associados</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações de filiação e associados ativos
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShareDialogOpen(true)}
            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar Filiação
          </Button>
          {canManageMembers && (
            <Button onClick={() => setCreateMemberOpen(true)} disabled={!clinicId}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Sócio
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendentes}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ativos}</p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejeitados}</p>
                <p className="text-sm text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                <TabsTrigger value="ativo">Ativos</TabsTrigger>
                <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Associados */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAssociados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground">Nenhum associado encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Tente ajustar sua busca" : "Aguardando solicitações de filiação"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssociados.map((associado) => {
                  const status = statusConfig[associado.status] || statusConfig.pendente;
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={associado.id}>
                      <TableCell className="font-medium">{associado.nome}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCPF(associado.cpf)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {associado.email}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {formatPhone(associado.telefone)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(associado.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAssociado(associado);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAssociado && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Detalhes do Associado
                </DialogTitle>
                <DialogDescription>
                  Solicitação de filiação de {selectedAssociado.nome}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge className={statusConfig[selectedAssociado.status]?.color}>
                    {statusConfig[selectedAssociado.status]?.label}
                  </Badge>
                </div>

                {/* Dados Pessoais */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <UserPlus className="h-4 w-4" /> Dados Pessoais
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> {selectedAssociado.nome}</div>
                    <div><span className="text-muted-foreground">CPF:</span> {formatCPF(selectedAssociado.cpf)}</div>
                    <div><span className="text-muted-foreground">Nascimento:</span> {format(new Date(selectedAssociado.data_nascimento), "dd/MM/yyyy")}</div>
                    <div><span className="text-muted-foreground">Sexo:</span> {selectedAssociado.sexo || "-"}</div>
                  </div>
                </div>

                {/* Contato */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Contato
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Telefone:</span> {formatPhone(selectedAssociado.telefone)}</div>
                    <div><span className="text-muted-foreground">E-mail:</span> {selectedAssociado.email}</div>
                  </div>
                </div>

                {/* Endereço */}
                {selectedAssociado.logradouro && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Endereço
                    </h4>
                    <p className="text-sm">
                      {selectedAssociado.logradouro}, {selectedAssociado.numero}
                      {selectedAssociado.complemento && ` - ${selectedAssociado.complemento}`}
                      <br />
                      {selectedAssociado.bairro} - {selectedAssociado.cidade}/{selectedAssociado.uf}
                      <br />
                      CEP: {selectedAssociado.cep}
                    </p>
                  </div>
                )}

                {/* Dados Profissionais */}
                {selectedAssociado.empresa && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Dados Profissionais
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Empresa:</span> {selectedAssociado.empresa}</div>
                      <div><span className="text-muted-foreground">Cargo:</span> {selectedAssociado.cargo || "-"}</div>
                      <div><span className="text-muted-foreground">Vínculo:</span> {selectedAssociado.tipo_vinculo || "-"}</div>
                    </div>
                  </div>
                )}

                {/* Filiação */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Filiação
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Contribuição:</span> R$ {selectedAssociado.valor_contribuicao.toFixed(2)}</div>
                    <div><span className="text-muted-foreground">Forma de Pagamento:</span> {selectedAssociado.forma_pagamento || "-"}</div>
                  </div>
                </div>

                {/* Documentos */}
                {(selectedAssociado.documento_foto_url || selectedAssociado.documento_rg_url || selectedAssociado.documento_comprovante_url) && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Documentos Anexados</h4>
                    <div className="flex gap-2">
                      {selectedAssociado.documento_foto_url && (
                        <a href={selectedAssociado.documento_foto_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" /> Foto
                          </Button>
                        </a>
                      )}
                      {selectedAssociado.documento_rg_url && (
                        <a href={selectedAssociado.documento_rg_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" /> RG
                          </Button>
                        </a>
                      )}
                      {selectedAssociado.documento_comprovante_url && (
                        <a href={selectedAssociado.documento_comprovante_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" /> Comprovante
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Motivo de Rejeição */}
                {selectedAssociado.status === "rejeitado" && selectedAssociado.motivo_rejeicao && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      <strong>Motivo da rejeição:</strong> {selectedAssociado.motivo_rejeicao}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {selectedAssociado.status === "pendente" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={aprovarMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button
                      onClick={() => aprovarMutation.mutate(selectedAssociado)}
                      disabled={aprovarMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {aprovarMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Aprovar Filiação
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Rejeição */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. Esta informação poderá ser enviada ao solicitante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Motivo da rejeição..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedAssociado) {
                  rejeitarMutation.mutate({
                    associadoId: selectedAssociado.id,
                    motivo: rejectReason,
                  });
                }
              }}
              disabled={rejeitarMutation.isPending || !rejectReason.trim()}
            >
              {rejeitarMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnionCreateMemberDialog
        open={createMemberOpen}
        onOpenChange={setCreateMemberOpen}
        clinicId={clinicId || ""}
        onCreated={(patientId) => {
          // Atualiza listagens e abre o detalhe do sócio
          queryClient.invalidateQueries({ queryKey: ["sindical-associados"] });
          queryClient.invalidateQueries({ queryKey: ["union-members"] });
          navigate(`/union/socios/${patientId}`);
        }}
      />

      <UnionShareFiliacaoDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </div>
  );
}
