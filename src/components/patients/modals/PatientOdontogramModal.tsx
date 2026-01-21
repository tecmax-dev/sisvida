import { PopupBase, PopupHeader, PopupTitle } from "@/components/ui/popup-base";
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
    <PopupBase
      open={open}
      onClose={() => onOpenChange(false)}
      maxWidth="6xl"
    >
      <PopupHeader>
        <PopupTitle>Odontograma do Paciente</PopupTitle>
      </PopupHeader>
      
      <RealisticOdontogram
        patientId={patientId}
        clinicId={clinicId}
        readOnly={false}
      />
    </PopupBase>
  );
}
