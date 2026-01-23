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
  Calendar, 
  ArrowRight, 
  User,
  Eye,
  Download,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePatientPayslipHistory, PatientPayslipHistoryItem } from "@/hooks/usePatientPayslipHistory";
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
  const { currentClinic } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const { history, isLoading, getAttachmentUrl } = usePatientPayslipHistory(
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  // Calculate stats
  const approvedCount = history?.filter(h => h.validation_status === 'approved').length || 0;
  const rejectedCount = history?.filter(h => h.validation_status === 'rejected').length || 0;
  const totalCount = history?.length || 0;

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return null;
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
            <FileImage className="h-6 w-6 text-primary" />
            Histórico de Contracheques
          </h1>
          <p className="text-muted-foreground">
            {patient.name}
            {patient.registration_number && (
              <span className="ml-2 text-sm">
                (Matrícula: {patient.registration_number})
              </span>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Validações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
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
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
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
            <div className="text-2xl font-bold text-destructive">{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Validações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="text-center py-12">
              <FileImage className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhum contracheque validado encontrado para este sócio.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Validade Anterior</TableHead>
                    <TableHead>Nova Validade</TableHead>
                    <TableHead>Validado por</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
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
                        {item.previous_card_expiry ? (
                          <span className="text-muted-foreground">
                            {formatDate(item.previous_card_expiry)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.validation_status === 'approved' && item.new_card_expiry ? (
                          <div className="flex items-center gap-1">
                            {item.previous_card_expiry && (
                              <ArrowRight className="h-4 w-4 text-green-500" />
                            )}
                            <span className="text-green-600 font-medium">
                              {formatDate(item.new_card_expiry)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.validator_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {item.validation_notes ? (
                          <span className="text-sm text-muted-foreground truncate block">
                            {item.validation_notes}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewImage(item)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          Ver
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

      {/* Image Viewer Modal */}
      <PayslipImageViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        imageUrl={viewingImageUrl}
        patientName="Contracheque"
        loading={loadingImage}
      />
    </div>
  );
}
