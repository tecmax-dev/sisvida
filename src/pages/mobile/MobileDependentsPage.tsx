import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Eye,
  Calendar,
  Phone,
  Mail,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  FileText,
  Info,
} from "lucide-react";
import { format, differenceInYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Dependent {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string | null;
  phone: string | null;
  is_active: boolean;
  card_number: string | null;
  card_expires_at: string | null;
  created_at: string;
}

interface DependentRequest {
  id: string;
  type: "inclusion" | "alteration" | "removal";
  status: "pending" | "approved" | "rejected";
  created_at: string;
  notes: string | null;
}

export default function MobileDependentsPage() {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [requests, setRequests] = useState<DependentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDependent, setSelectedDependent] = useState<Dependent | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const patientId = sessionStorage.getItem("mobile_patient_id");

      if (!patientId) {
        navigate("/app/login");
        return;
      }

      // Fetch dependents
      const { data: dependentsData, error: dependentsError } = await supabase
        .from("patient_dependents")
        .select("id, name, cpf, birth_date, relationship, phone, is_active, card_number, card_expires_at, created_at")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("name");

      if (dependentsError) {
        console.error("Error fetching dependents:", dependentsError);
      } else {
        setDependents(dependentsData || []);
      }

      // Simulated requests - in production this would come from a dedicated table
      const pendingDependents: typeof dependentsData = [];
      const simulatedRequests: DependentRequest[] = pendingDependents.map((d) => ({
        id: d.id,
        type: "inclusion" as const,
        status: "pending" as const,
        created_at: d.created_at,
        notes: null,
      }));
      setRequests(simulatedRequests);
    } catch (err) {
      console.error("Error loading data:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dependentes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAge = (birthDate: string | null): string => {
    if (!birthDate) return "-";
    try {
      const age = differenceInYears(new Date(), parseISO(birthDate));
      return `${age} anos`;
    } catch {
      return "-";
    }
  };

  const isCardExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return true;
    try {
      return new Date(expiresAt) < new Date();
    } catch {
      return true;
    }
  };

  const getRelationshipLabel = (relationship: string | null): string => {
    const labels: Record<string, string> = {
      spouse: "Cônjuge",
      child: "Filho(a)",
      parent: "Pai/Mãe",
      sibling: "Irmão(ã)",
      grandchild: "Neto(a)",
      grandparent: "Avô/Avó",
      other: "Outro",
    };
    return labels[relationship || ""] || relationship || "Não informado";
  };

  const getStatusBadge = (dependent: Dependent) => {
    if (!dependent.is_active) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
          Inativo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Ativo
      </Badge>
    );
  };

  const handleViewDependent = (dependent: Dependent) => {
    setSelectedDependent(dependent);
    setShowDetailDialog(true);
  };

  const handleRequestInclusion = () => {
    // Navigate to request form or show dialog
    toast({
      title: "Solicitação de Inclusão",
      description: "Para incluir um novo dependente, entre em contato com o sindicato.",
    });
    setShowRequestDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/app/home")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Meus Dependentes</h1>
          <p className="text-xs text-white/80">Gerencie seus dependentes vinculados</p>
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Users className="h-5 w-5" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Stats Card */}
        <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-sm opacity-90">Total de Dependentes</p>
                <p className="text-3xl font-bold">{dependents.length}</p>
              </div>
              <Users className="h-12 w-12 opacity-30" />
            </div>
            {requests.filter((r) => r.status === "pending").length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>
                    {requests.filter((r) => r.status === "pending").length} solicitação(ões)
                    pendente(s)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-12 border-emerald-200"
            onClick={handleRequestInclusion}
          >
            <UserPlus className="h-4 w-4 mr-2 text-emerald-600" />
            <span className="text-sm">Solicitar Inclusão</span>
          </Button>
          <Button
            variant="outline"
            className="h-12 px-4 border-emerald-200"
            onClick={() => setShowHistoryDialog(true)}
          >
            <FileText className="h-4 w-4 text-emerald-600" />
          </Button>
        </div>

        {/* Dependents List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">DEPENDENTES ATIVOS</h3>

          {dependents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="font-medium text-foreground mb-2">Nenhum dependente cadastrado</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Você ainda não possui dependentes vinculados à sua associação.
                </p>
                <Button size="sm" onClick={handleRequestInclusion}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Solicitar Inclusão
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {dependents.map((dependent) => (
                <Card
                  key={dependent.id}
                  className="overflow-hidden active:scale-[0.98] transition-transform"
                  onClick={() => handleViewDependent(dependent)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                          <span className="text-emerald-700 font-semibold text-lg">
                            {dependent.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">{dependent.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {getRelationshipLabel(dependent.relationship)} •{" "}
                            {getAge(dependent.birth_date)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      {getStatusBadge(dependent)}

                      {dependent.card_number && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CreditCard className="h-3 w-3" />
                          <span>
                            Carteira{" "}
                            {isCardExpired(dependent.card_expires_at) ? "vencida" : "válida"}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 text-sm mb-1">Informações importantes</h4>
                <p className="text-xs text-blue-700">
                  Para solicitar inclusão, alteração ou remoção de dependentes, entre em contato
                  com o sindicato. Todas as solicitações serão analisadas e você receberá uma
                  resposta em até 5 dias úteis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-700 font-semibold">
                  {selectedDependent?.name.charAt(0)}
                </span>
              </div>
              <span>{selectedDependent?.name}</span>
            </DialogTitle>
            <DialogDescription>Informações do dependente</DialogDescription>
          </DialogHeader>

          {selectedDependent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Parentesco</p>
                  <p className="font-medium">
                    {getRelationshipLabel(selectedDependent.relationship)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Idade</p>
                  <p className="font-medium">{getAge(selectedDependent.birth_date)}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {selectedDependent.birth_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                      <p className="text-sm font-medium">
                        {format(parseISO(selectedDependent.birth_date), "dd 'de' MMMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {selectedDependent.cpf && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">CPF</p>
                      <p className="text-sm font-medium">{selectedDependent.cpf}</p>
                    </div>
                  </div>
                )}

                {selectedDependent.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium">{selectedDependent.phone}</p>
                    </div>
                  </div>
                )}

              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Status da Carteirinha</h4>
                {selectedDependent.card_number ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Nº da Carteira</span>
                      <span className="font-mono font-medium">{selectedDependent.card_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Validade</span>
                      <span
                        className={`text-sm font-medium ${
                          isCardExpired(selectedDependent.card_expires_at)
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {selectedDependent.card_expires_at
                          ? format(parseISO(selectedDependent.card_expires_at), "dd/MM/yyyy")
                          : "-"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700">Carteirinha não emitida</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Solicitações</DialogTitle>
            <DialogDescription>Acompanhe suas solicitações de dependentes</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            {requests.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {request.type === "inclusion"
                              ? "Inclusão"
                              : request.type === "alteration"
                                ? "Alteração"
                                : "Remoção"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(request.created_at), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        </div>
                        <Badge
                          variant={
                            request.status === "approved"
                              ? "default"
                              : request.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {request.status === "approved"
                            ? "Aprovada"
                            : request.status === "rejected"
                              ? "Recusada"
                              : "Pendente"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Inclusion Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Solicitar Inclusão de Dependente</DialogTitle>
            <DialogDescription>
              Entre em contato com o sindicato para solicitar a inclusão de um novo dependente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-lg p-4">
              <h4 className="font-medium text-emerald-900 mb-2">Documentos Necessários</h4>
              <ul className="text-sm text-emerald-700 space-y-1">
                <li>• Documento de identidade (RG ou CNH)</li>
                <li>• CPF do dependente</li>
                <li>• Comprovante de parentesco</li>
                <li>• Foto 3x4 recente</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Canais de Atendimento</h4>
              <div className="space-y-2 text-sm text-blue-700">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>(73) 3281-1234</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>atendimento@secmi.org.br</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => window.open("https://wa.me/5573999999999", "_blank")}
            >
              <Phone className="h-4 w-4 mr-2" />
              Falar no WhatsApp
            </Button>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
