import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileImage, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Calendar,
  ArrowRight,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { usePatientPayslipHistory, PatientPayslipHistoryItem } from '@/hooks/usePatientPayslipHistory';
import { PayslipImageViewer } from './PayslipImageViewer';

interface PatientPayslipHistoryProps {
  clinicId: string;
  patientId: string;
}

export function PatientPayslipHistory({ clinicId, patientId }: PatientPayslipHistoryProps) {
  const { history, isLoading, getAttachmentUrl } = usePatientPayslipHistory(clinicId, patientId);
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-12">
        <FileImage className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          Nenhum contracheque validado encontrado.
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="max-h-[50vh]">
        <div className="space-y-3 pr-4">
          {history.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Status and date */}
                    <div className="flex items-center gap-2">
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
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(item.validated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    {/* Card expiry change */}
                    {item.validation_status === 'approved' && (item.previous_card_expiry || item.new_card_expiry) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Validade:</span>
                        <span className={item.previous_card_expiry ? 'line-through text-muted-foreground' : ''}>
                          {formatDate(item.previous_card_expiry)}
                        </span>
                        {item.previous_card_expiry && item.new_card_expiry && (
                          <>
                            <ArrowRight className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 font-medium">
                              {formatDate(item.new_card_expiry)}
                            </span>
                          </>
                        )}
                        {!item.previous_card_expiry && item.new_card_expiry && (
                          <span className="text-green-600 font-medium">
                            {formatDate(item.new_card_expiry)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Validator */}
                    {item.validator_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Validado por: {item.validator_name}</span>
                      </div>
                    )}

                    {/* Notes */}
                    {item.validation_notes && (
                      <p className="text-sm text-muted-foreground italic bg-muted/50 p-2 rounded">
                        {item.validation_notes}
                      </p>
                    )}
                  </div>

                  {/* View button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewImage(item)}
                    className="gap-1 shrink-0"
                  >
                    <Eye className="h-4 w-4" />
                    Ver Documento
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Image Viewer Modal */}
      <PayslipImageViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        imageUrl={viewingImageUrl}
        patientName="Contracheque"
        loading={loadingImage}
      />
    </>
  );
}
