import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

type ModalType = 
  | 'patientRecords'
  | 'patientAnamnesis'
  | 'patientPrescription'
  | 'patientAppointments'
  | 'patientCards'
  | 'patientOdontogram'
  | 'anamneseTemplateCreate'
  | 'anamneseTemplateEdit'
  | 'anamneseTemplatePreview'
  | 'anamneseTemplateDelete'
  | 'anamneseTemplateSend';

interface ModalData {
  patientId?: string;
  patientName?: string;
  clinicId?: string;
  templateId?: string;
  templateTitle?: string;
  templateDescription?: string | null;
  templateIsActive?: boolean;
  questions?: any[];
  previewQuestions?: any[];
  previewAnswers?: any[];
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
  updateModalData: (type: ModalType, data: Partial<ModalData>) => void;
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
  anamneseTemplateCreate: { ...defaultModalState },
  anamneseTemplateEdit: { ...defaultModalState },
  anamneseTemplatePreview: { ...defaultModalState },
  anamneseTemplateDelete: { ...defaultModalState },
  anamneseTemplateSend: { ...defaultModalState },
};

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<Record<ModalType, ModalState>>(defaultModals);

  // Debug: track provider mount/unmount
  useEffect(() => {
    console.log("🟢 ModalProvider mount");
    return () => console.log("🔴 ModalProvider unmount");
  }, []);

  const openModal = useCallback((type: ModalType, data: ModalData = {}) => {
    setModals(prev => ({
      ...prev,
      [type]: { isOpen: true, data },
    }));
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    console.trace("🔥 closeModal chamado", type, "hasFocus:", document.hasFocus());
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

  const updateModalData = useCallback((type: ModalType, data: Partial<ModalData>) => {
    setModals(prev => ({
      ...prev,
      [type]: { 
        ...prev[type], 
        data: { ...prev[type].data, ...data } 
      },
    }));
  }, []);

  return (
    <ModalContext.Provider value={{ modals, openModal, closeModal, isModalOpen, getModalData, updateModalData }}>
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

// Hook for anamnese template modals
export function useAnamneseTemplateModals() {
  const { openModal, closeModal, isModalOpen, getModalData, updateModalData } = useModal();

  return {
    // Create
    openCreateModal: (data?: ModalData) => 
      openModal('anamneseTemplateCreate', data),
    closeCreateModal: () => closeModal('anamneseTemplateCreate'),
    isCreateModalOpen: isModalOpen('anamneseTemplateCreate'),
    createModalData: getModalData('anamneseTemplateCreate'),
    updateCreateModalData: (data: Partial<ModalData>) => updateModalData('anamneseTemplateCreate', data),

    // Edit
    openEditModal: (templateId: string, title: string, description: string | null, isActive: boolean, questions: any[]) => 
      openModal('anamneseTemplateEdit', { templateId, templateTitle: title, templateDescription: description, templateIsActive: isActive, questions }),
    closeEditModal: () => closeModal('anamneseTemplateEdit'),
    isEditModalOpen: isModalOpen('anamneseTemplateEdit'),
    editModalData: getModalData('anamneseTemplateEdit'),
    updateEditModalData: (data: Partial<ModalData>) => updateModalData('anamneseTemplateEdit', data),

    // Preview
    openPreviewModal: (templateId: string, title: string, previewQuestions: any[]) => 
      openModal('anamneseTemplatePreview', { templateId, templateTitle: title, previewQuestions, previewAnswers: [] }),
    closePreviewModal: () => closeModal('anamneseTemplatePreview'),
    isPreviewModalOpen: isModalOpen('anamneseTemplatePreview'),
    previewModalData: getModalData('anamneseTemplatePreview'),
    updatePreviewModalData: (data: Partial<ModalData>) => updateModalData('anamneseTemplatePreview', data),

    // Delete
    openDeleteModal: (templateId: string, title: string) => 
      openModal('anamneseTemplateDelete', { templateId, templateTitle: title }),
    closeDeleteModal: () => closeModal('anamneseTemplateDelete'),
    isDeleteModalOpen: isModalOpen('anamneseTemplateDelete'),
    deleteModalData: getModalData('anamneseTemplateDelete'),

    // Send WhatsApp
    openSendModal: (templateId: string, title: string) => 
      openModal('anamneseTemplateSend', { templateId, templateTitle: title }),
    closeSendModal: () => closeModal('anamneseTemplateSend'),
    isSendModalOpen: isModalOpen('anamneseTemplateSend'),
    sendModalData: getModalData('anamneseTemplateSend'),
  };
}
