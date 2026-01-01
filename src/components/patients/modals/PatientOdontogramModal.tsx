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
  // Prevent modal from closing when switching browser tabs
  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing via explicit user action (clicking X or outside)
    // Don't close on blur/focus events from tab switching
    if (!newOpen && document.hasFocus()) {
      onOpenChange(newOpen);
    } else if (newOpen) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={true}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside if document doesn't have focus
          if (!document.hasFocus()) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing on interact outside when tab is not focused
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
