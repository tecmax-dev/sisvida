import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, Plus, Loader2, FileImage, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { usePatientCards, PatientCard } from '@/hooks/usePatientCards';
import { PatientCardView } from '@/components/patients/PatientCardView';
import { PatientCardDialog } from '@/components/patients/PatientCardDialog';
import { PayslipRequestsList } from '@/components/patients/PayslipRequestsList';

interface PatientCardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export function PatientCardsModal({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientCardsModalProps) {
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { cards, isLoading, createCard, renewCard, isCreating, isRenewing } = usePatientCards(
    currentClinic?.id,
    patientId
  );
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PatientCard | null>(null);
  const [activeTab, setActiveTab] = useState('carteirinha');

  const activeCard = cards?.find(c => c.is_active);

  const handleCreateCard = (data: { patient_id: string; expires_at: string; notes?: string }) => {
    createCard(data, {
      onSuccess: () => setCreateDialogOpen(false),
    });
  };

  const handleRenewCard = (data: { patient_id: string; expires_at: string }) => {
    if (!selectedCard) return;
    renewCard(
      { cardId: selectedCard.id, newExpiresAt: data.expires_at },
      { onSuccess: () => setRenewDialogOpen(false) }
    );
  };

  const openRenewDialog = (card: PatientCard) => {
    setSelectedCard(card);
    setRenewDialogOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
        <DialogContent 
          className="max-w-3xl max-h-[90vh]"
          onPointerDownOutside={(e) => {
            if (!document.hasFocus()) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (!document.hasFocus()) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Carteirinha Digital - {patientName}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="carteirinha" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Carteirinha
              </TabsTrigger>
              <TabsTrigger value="contracheques" className="gap-2">
                <FileImage className="h-4 w-4" />
                Contracheques
              </TabsTrigger>
            </TabsList>

            <TabsContent value="carteirinha" className="mt-4">
              <div className="space-y-4">
                {!activeCard && (
                  <div className="flex justify-end">
                    <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Emitir Carteirinha
                    </Button>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : cards && cards.length > 0 ? (
                  <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-4 pr-4">
                      {cards.map((card) => (
                        <PatientCardView
                          key={card.id}
                          card={card}
                          patientName={card.patient?.name || patientName}
                          patientCpf={card.patient?.cpf}
                          patientPhotoUrl={card.patient?.photo_url}
                          patientTag={card.patient?.tag}
                          clinicName={currentClinic?.name || ''}
                          clinicLogo={currentClinic?.logo_url}
                          insurancePlanName={card.patient?.insurance_plan?.name}
                          onRenew={() => openRenewDialog(card)}
                          onPrint={handlePrint}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Este paciente ainda não possui carteirinha digital.
                    </p>
                    <Button 
                      onClick={() => setCreateDialogOpen(true)} 
                      className="mt-4 gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Emitir Primeira Carteirinha
                    </Button>
                  </div>
                )}

                {/* Link to full history page */}
                <div className="pt-4 border-t">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/dashboard/patients/${patientId}/contracheques`);
                    }}
                  >
                    <History className="h-4 w-4" />
                    Ver Histórico Completo de Contracheques
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contracheques" className="mt-4">
              {currentClinic && (
                <PayslipRequestsList 
                  clinicId={currentClinic.id} 
                  patientId={patientId} 
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Create Card Dialog */}
      <PatientCardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        patientId={patientId}
        patientName={patientName}
        onSubmit={handleCreateCard}
        isLoading={isCreating}
        mode="create"
      />

      {/* Renew Card Dialog */}
      {selectedCard && (
        <PatientCardDialog
          open={renewDialogOpen}
          onOpenChange={setRenewDialogOpen}
          patientId={patientId}
          patientName={patientName}
          onSubmit={handleRenewCard}
          isLoading={isRenewing}
          mode="renew"
          currentExpiresAt={selectedCard.expires_at}
        />
      )}
    </>
  );
}
