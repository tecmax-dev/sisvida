import { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";

type SystemModalType = 'sessionExpiry';

interface SystemModalData {
  timeRemaining?: number;
  [key: string]: any;
}

interface SystemModalState {
  isOpen: boolean;
  data: SystemModalData;
}

interface SystemModalContextValue {
  isOpen: (type: SystemModalType) => boolean;
  getData: (type: SystemModalType) => SystemModalData;
  open: (type: SystemModalType, data?: SystemModalData) => void;
  close: (type: SystemModalType) => void;
  update: (type: SystemModalType, data: Partial<SystemModalData>) => void;
}

const defaultState: Record<SystemModalType, SystemModalState> = {
  sessionExpiry: { isOpen: false, data: {} },
};

const SystemModalContext = createContext<SystemModalContextValue | undefined>(undefined);

export function SystemModalProvider({ children }: { children: ReactNode }) {
  // Use ref to store state to prevent external re-renders from affecting it
  const stateRef = useRef<Record<SystemModalType, SystemModalState>>(defaultState);
  const [, forceUpdate] = useState({});

  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  const isOpen = useCallback((type: SystemModalType) => {
    return stateRef.current[type]?.isOpen ?? false;
  }, []);

  const getData = useCallback((type: SystemModalType) => {
    return stateRef.current[type]?.data ?? {};
  }, []);

  const open = useCallback((type: SystemModalType, data: SystemModalData = {}) => {
    stateRef.current = {
      ...stateRef.current,
      [type]: { isOpen: true, data },
    };
    triggerUpdate();
  }, [triggerUpdate]);

  const close = useCallback((type: SystemModalType) => {
    stateRef.current = {
      ...stateRef.current,
      [type]: { ...stateRef.current[type], isOpen: false },
    };
    triggerUpdate();
  }, [triggerUpdate]);

  const update = useCallback((type: SystemModalType, data: Partial<SystemModalData>) => {
    stateRef.current = {
      ...stateRef.current,
      [type]: {
        ...stateRef.current[type],
        data: { ...stateRef.current[type].data, ...data },
      },
    };
    triggerUpdate();
  }, [triggerUpdate]);

  return (
    <SystemModalContext.Provider value={{ isOpen, getData, open, close, update }}>
      {children}
    </SystemModalContext.Provider>
  );
}

export function useSystemModal() {
  const context = useContext(SystemModalContext);
  if (!context) {
    throw new Error("useSystemModal must be used within a SystemModalProvider");
  }
  return context;
}

// Convenience hook for session expiry modal
export function useSessionExpiryModal() {
  const { isOpen, getData, open, close, update } = useSystemModal();

  return {
    isOpen: isOpen('sessionExpiry'),
    data: getData('sessionExpiry'),
    open: (timeRemaining: number) => open('sessionExpiry', { timeRemaining }),
    close: () => close('sessionExpiry'),
    updateTime: (timeRemaining: number) => update('sessionExpiry', { timeRemaining }),
  };
}
