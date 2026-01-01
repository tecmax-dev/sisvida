import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ModalType = 
  | 'patientRecords'
  | 'patientAnamnesis'
  | 'patientPrescription'
  | 'patientAppointments'
  | 'patientCards'
  | 'patientOdontogram';

interface ModalData {
  patientId?: string;
  patientName?: string;
  clinicId?: string;
  [key: string]: any;
}

interface ModalState {
  isOpen: boolean;
  data: ModalData;
}

interface ModalContextValue {
  modals: Record<ModalType, ModalState>;
  openModal: (type: ModalType, data?: ModalData) => void;
  closeModal: (type: ModalType) => void;
  isModalOpen: (type: ModalType) => boolean;
  getModalData: (type: ModalType) => ModalData;
}

const defaultModalState: ModalState = {
  isOpen: false,
  data: {},
};

const defaultModals: Record<ModalType, ModalState> = {
  patientRecords: { ...defaultModalState },
  patientAnamnesis: { ...defaultModalState },
  patientPrescription: { ...defaultModalState },
  patientAppointments: { ...defaultModalState },
  patientCards: { ...defaultModalState },
  patientOdontogram: { ...defaultModalState },
};

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<Record<ModalType, ModalState>>(defaultModals);

  const openModal = useCallback((type: ModalType, data: ModalData = {}) => {
    setModals(prev => ({
      ...prev,
      [type]: { isOpen: true, data },
    }));
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    // Only close if document has focus (prevents closing on tab switch)
    if (document.hasFocus()) {
      setModals(prev => ({
        ...prev,
        [type]: { ...prev[type], isOpen: false },
      }));
    }
  }, []);

  const isModalOpen = useCallback((type: ModalType) => {
    return modals[type]?.isOpen ?? false;
  }, [modals]);

  const getModalData = useCallback((type: ModalType) => {
    return modals[type]?.data ?? {};
  }, [modals]);

  return (
    <ModalContext.Provider value={{ modals, openModal, closeModal, isModalOpen, getModalData }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

// Convenience hooks for specific modals
export function usePatientModals() {
  const { openModal, closeModal, isModalOpen, getModalData } = useModal();

  return {
    // Records
    openRecordsModal: (patientId: string, patientName: string) => 
      openModal('patientRecords', { patientId, patientName }),
    closeRecordsModal: () => closeModal('patientRecords'),
    isRecordsModalOpen: isModalOpen('patientRecords'),
    recordsModalData: getModalData('patientRecords'),

    // Anamnesis
    openAnamnesisModal: (patientId: string, patientName: string) => 
      openModal('patientAnamnesis', { patientId, patientName }),
    closeAnamnesisModal: () => closeModal('patientAnamnesis'),
    isAnamnesisModalOpen: isModalOpen('patientAnamnesis'),
    anamnesisModalData: getModalData('patientAnamnesis'),

    // Prescription
    openPrescriptionModal: (patientId: string, patientName: string) => 
      openModal('patientPrescription', { patientId, patientName }),
    closePrescriptionModal: () => closeModal('patientPrescription'),
    isPrescriptionModalOpen: isModalOpen('patientPrescription'),
    prescriptionModalData: getModalData('patientPrescription'),

    // Appointments
    openAppointmentsModal: (patientId: string, patientName: string) => 
      openModal('patientAppointments', { patientId, patientName }),
    closeAppointmentsModal: () => closeModal('patientAppointments'),
    isAppointmentsModalOpen: isModalOpen('patientAppointments'),
    appointmentsModalData: getModalData('patientAppointments'),

    // Cards
    openCardsModal: (patientId: string, patientName: string) => 
      openModal('patientCards', { patientId, patientName }),
    closeCardsModal: () => closeModal('patientCards'),
    isCardsModalOpen: isModalOpen('patientCards'),
    cardsModalData: getModalData('patientCards'),

    // Odontogram
    openOdontogramModal: (patientId: string, clinicId: string) => 
      openModal('patientOdontogram', { patientId, clinicId }),
    closeOdontogramModal: () => closeModal('patientOdontogram'),
    isOdontogramModalOpen: isModalOpen('patientOdontogram'),
    odontogramModalData: getModalData('patientOdontogram'),
  };
}
