import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, CheckCircle2, XCircle } from "lucide-react";
import { useWaitingListOffer, WaitingListOffer } from "@/hooks/useWaitingListOffer";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  offer: WaitingListOffer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitingListOfferDialog({ offer, open, onOpenChange }: Props) {
  const { respondToOffer } = useWaitingListOffer();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    const result = await respondToOffer("confirmed");
    setLoading(false);
    
    if (result?.success) {
      toast({
        title: "Vaga confirmada!",
        description: "Sua consulta foi agendada com sucesso.",
      });
      onOpenChange(false);
    } else {
      toast({
        title: "Erro ao confirmar",
        description: "Não foi possível confirmar sua vaga. Tente novamente ou entre em contato.",
        variant: "destructive",
      });
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    const result = await respondToOffer("declined");
    setLoading(false);
    
    if (result?.success) {
      toast({
        title: "Oferta recusada",
        description: "A vaga será oferecida para o próximo da lista.",
      });
      onOpenChange(false);
    }
  };

  const formattedDate = offer.offered_appointment_date 
    ? format(new Date(offer.offered_appointment_date + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <Calendar className="h-6 w-6 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            Vaga Disponível!
          </DialogTitle>
          <DialogDescription className="text-center">
            Uma vaga abriu e você é o próximo da lista. Gostaria de confirmar este agendamento?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-50 rounded-xl p-4 space-y-3 mt-4">
          <div className="flex items-center gap-3 text-gray-700">
            <User className="h-5 w-5 text-emerald-600" />
            <span className="font-medium">{offer.offered_professional_name}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <Calendar className="h-5 w-5 text-emerald-600" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <Clock className="h-5 w-5 text-emerald-600" />
            <span>{offer.offered_appointment_time?.slice(0, 5)}</span>
          </div>
        </div>

        <div className="text-xs text-center text-gray-400 mt-2">
          * Esta vaga expira em breve se não for confirmada.
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-6">
          <Button
            variant="outline"
            className="w-full sm:flex-1 rounded-xl"
            onClick={handleDecline}
            disabled={loading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Agora não
          </Button>
          <Button
            className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            onClick={handleConfirm}
            disabled={loading}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirmar Vaga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
