import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  FileImage, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  User,
  Eye,
  CreditCard,
  ShieldAlert,
  Clock,
  Database,
  Users,
  UserPlus,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePatientPayslipHistory, PatientPayslipHistoryItem } from "@/hooks/usePatientPayslipHistory";
import { usePatientDependentAudit, translateRelationship } from "@/hooks/usePatientDependentAudit";
import { PayslipImageViewer } from "@/components/patients/PayslipImageViewer";

interface Patient {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  registration_number: string | null;
}

export default function PatientPayslipHistoryPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClinic, userRoles, isSuperAdmin } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const currentRole = userRoles.find(r => r.clinic_id === currentClinic?.id);
  const isAdmin = isSuperAdmin || currentRole?.role === 'owner' || currentRole?.role === 'admin';

  const { history, isLoading: loadingPayslips, getAttachmentUrl } = usePatientPayslipHistory(
    currentClinic?.id,
    patientId
  );

  const { auditItems: dependentAudit, isLoading: loadingDependents } = usePatientDependentAudit(
    currentClinic?.id,
    patientId
  );

  useEffect(() => {
    async function loadPatient() {
      if (!patientId || !currentClinic?.id) return;
      setLoadingPatient(true);
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, phone, cpf, registration_number")
        .eq("id", patientId)
        .eq("clinic_id", currentClinic.id)
        .single();

      if (error) {
        console.error("Error loading patient:", error);
        navigate("/dashboard/patients");
        return;
      }
      setPatient(data);
      setLoadingPatient(false);
    }
    loadPatient();
  }, [patientId, currentClinic?.id, navigate]);

  const handleViewImage = async (item: PatientPayslipHistoryItem) => {
    if (!item.attachment_path) return;
    setLoadingImage(true);
    setViewerOpen(true);
    const url = await getAttachmentUrl(item.attachment_path);
    setViewingImageUrl(url);
    setLoadingImage(false);
  };

  const handleViewDependentDoc = async (photoUrl: string | null) => {
    if (!photoUrl) return;
    setLoadingImage(true);
    setViewerOpen(true);
    setViewingImageUrl(photoUrl);
    setLoadingImage(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  // Stats
  const payslipApproved = history?.filter(h => h.validation_status === 'approved').length || 0;
  const payslipRejected = history?.filter(h => h.validation_status === 'rejected').length || 0;
  const depApproved = dependentAudit?.filter(d => d.status === 'approved').length || 0;
  const depRejected = dependentAudit?.filter(d => d.status === 'rejected').length || 0;
  const depPending = dependentAudit?.filter(d => d.status === 'pending').length || 0;

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) return null;

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Auditoria do Sócio</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground max-w-md">
              O histórico de auditoria é restrito a administradores.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Auditoria do Sócio
          </h1>
          <p className="text-muted-foreground">
            {patient.name}
            {patient.cpf && <span className="ml-2 text-sm">(CPF: {patient.cpf})</span>}
            {patient.registration_number && (
              <span className="ml-2 text-sm">| Matrícula: {patient.registration_number}</span>
            )}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate(`/dashboard/patients/${patientId}`)}
          className="gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Ver Carteirinha
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="payslips" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payslips" className="gap-2">
            <FileImage className="h-4 w-4" />
            Contracheques
            {(history?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{history?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dependents" className="gap-2">
            <Users className="h-4 w-4" />
            Dependentes
            {(dependentAudit?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{dependentAudit?.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Payslips Tab */}
        <TabsContent value="payslips" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{history?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Aprovados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{payslipApproved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Rejeitados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{payslipRejected}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Histórico de Contracheques
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayslips ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !history || history.length === 0 ? (
                <div className="text-center py-12">
                  <FileImage className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhum contracheque validado encontrado.</p>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data Envio</TableHead>
                          <TableHead>Data/Hora Validação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Validado por</TableHead>
                          <TableHead>Validade Anterior</TableHead>
                          <TableHead>Nova Validade</TableHead>
                          <TableHead>Observações</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDateTime(item.created_at)}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              {formatDateTime(item.validated_at)}
                            </TableCell>
                            <TableCell>
                              {item.validation_status === 'approved' ? (
                                <Badge className="gap-1 bg-green-500">
                                  <CheckCircle className="h-3 w-3" />
                                  Aprovado
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Rejeitado
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.validator_name ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 cursor-help">
                                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span>{item.validator_name}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>ID: {item.validated_by || 'N/A'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.previous_card_expiry ? (
                                <span className="text-muted-foreground">{formatDate(item.previous_card_expiry)}</span>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              {item.validation_status === 'approved' && item.new_card_expiry ? (
                                <div className="flex items-center gap-1">
                                  {item.previous_card_expiry && <ArrowRight className="h-4 w-4 text-green-500" />}
                                  <span className="text-green-600 font-medium">{formatDate(item.new_card_expiry)}</span>
                                </div>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {item.validation_notes ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm text-muted-foreground truncate block cursor-help">
                                      {item.validation_notes}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p>{item.validation_notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="gap-1 text-xs cursor-help">
                                    <Database className="h-3 w-3" />
                                    {item.source === 'history' ? 'Histórico' : 'Solicitação'}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{item.source === 'history' ? 'Registro na tabela de histórico' : 'Registro importado da solicitação original'}</p>
                                  <p className="text-xs mt-1">ID: {item.id}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleViewImage(item)} className="gap-1">
                                <Eye className="h-4 w-4" />
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependents Tab */}
        <TabsContent value="dependents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dependentAudit?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Aprovados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{depApproved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Rejeitados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{depRejected}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{depPending}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Histórico de Aprovações de Dependentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDependents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !dependentAudit || dependentAudit.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma solicitação de dependente encontrada.</p>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data Solicitação</TableHead>
                          <TableHead>Dependente</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Parentesco</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data/Hora Revisão</TableHead>
                          <TableHead>Revisado por</TableHead>
                          <TableHead>Motivo Rejeição</TableHead>
                          <TableHead>Tel. Solicitante</TableHead>
                          <TableHead className="text-right">Documento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dependentAudit.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDateTime(item.created_at)}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                                {item.dependent_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.dependent_cpf || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {translateRelationship(item.dependent_relationship)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.status === 'approved' ? (
                                <Badge className="gap-1 bg-green-500">
                                  <CheckCircle className="h-3 w-3" />
                                  Aprovado
                                </Badge>
                              ) : item.status === 'rejected' ? (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Rejeitado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.reviewed_at ? (
                                <span className="font-medium">{formatDateTime(item.reviewed_at)}</span>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              {item.reviewer_name ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 cursor-help">
                                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span>{item.reviewer_name}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>ID: {item.reviewed_by || 'N/A'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {item.rejection_reason ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm text-destructive truncate block cursor-help">
                                      {item.rejection_reason}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p>{item.rejection_reason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.requester_phone || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.cpf_photo_url ? (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleViewDependentDoc(item.cpf_photo_url)} 
                                  className="gap-1"
                                >
                                  <Eye className="h-4 w-4" />
                                  Ver
                                </Button>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Viewer Modal */}
      <PayslipImageViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        imageUrl={viewingImageUrl}
        patientName="Documento"
        loading={loadingImage}
      />
    </div>
  );
}
