import React, { createContext, useContext, ReactNode } from 'react';
import { useMobileAuthSession } from '@/hooks/useMobileAuthSession';

interface MobileAuthContextType {
  isLoggedIn: boolean;
  patientId: string | null;
  clinicId: string | null;
  patientName: string | null;
  loading: boolean;
  initialized: boolean;
  login: (cpf: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    patientId?: string;
    patientName?: string;
    clinicId?: string;
  }>;
  logout: () => Promise<void>;
  verifySession: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const MobileAuthContext = createContext<MobileAuthContextType | null>(null);

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const auth = useMobileAuthSession();
  
  return (
    <MobileAuthContext.Provider value={auth}>
      {children}
    </MobileAuthContext.Provider>
  );
}

export function useMobileAuth() {
  const context = useContext(MobileAuthContext);
  if (!context) {
    throw new Error('useMobileAuth must be used within MobileAuthProvider');
  }
  return context;
}