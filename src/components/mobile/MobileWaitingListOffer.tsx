import { useState } from "react";
import { useWaitingListOffer } from "@/hooks/useWaitingListOffer";
import { WaitingListOfferDialog } from "./WaitingListOfferDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Bell, ChevronRight } from "lucide-react";

export function MobileWaitingListOffer() {
  const { offer, isLoading } = useWaitingListOffer();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading || !offer) return null;

  return (
    <>
      <div className="mx-4 mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
        <Card className="bg-emerald-600 border-none shadow-lg shadow-emerald-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-1 opacity-20 translate-x-4 -translate-y-4">
            <Bell className="h-24 w-24 text-white" />
          </div>
          
          <CardContent className="p-4 relative z-10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              
              <div className="flex-1">
                <h4 className="text-white font-bold text-base">Vaga disponível!</h4>
                <p className="text-emerald-50 text-xs mt-0.5">
                  Uma vaga abriu na agenda de {offer.offered_professional_name.split(" ")[0]}.
                </p>
                
                <Button 
                  size="sm"
                  className="mt-3 bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg h-8 px-4 font-bold"
                  onClick={() => setDialogOpen(true)}
                >
                  Ver Detalhes
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <WaitingListOfferDialog 
        offer={offer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
