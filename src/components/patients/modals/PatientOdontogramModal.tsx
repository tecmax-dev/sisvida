import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RealisticOdontogram } from "@/components/medical/RealisticOdontogram";

interface PatientOdontogramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  clinicId: string;
}

export function PatientOdontogramModal({
  open,
  onOpenChange,
  patientId,
  clinicId,
}: PatientOdontogramModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          // Prevent closing when document doesn't have focus (tab switching)
          if (!document.hasFocus()) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (!document.hasFocus()) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Odontograma do Paciente</DialogTitle>
        </DialogHeader>
        
        <RealisticOdontogram
          patientId={patientId}
          clinicId={clinicId}
          readOnly={false}
        />
      </DialogContent>
    </Dialog>
  );
}
