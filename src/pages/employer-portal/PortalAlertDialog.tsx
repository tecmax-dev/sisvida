import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PortalAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}

export function PortalAlertDialog({ open, onOpenChange, message }: PortalAlertDialogProps) {
  const showAlertDialog = open;
  const setShowAlertDialog = onOpenChange;
  const alertMessage = message;
  return (
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-center text-xl text-slate-900">Atenção!</DialogTitle>
            <DialogDescription className="text-center text-base text-slate-600">
              {alertMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowAlertDialog(false)} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
