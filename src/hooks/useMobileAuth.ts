import { useState, useEffect, useCallback } from "react";
import { restoreSession, clearSession, STORAGE_KEYS } from "./useMobileSession";

export function useMobileAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Use robust session restoration that checks multiple storage layers
      const session = await restoreSession();
      
      setPatientId(session.patientId);
      setClinicId(session.clinicId);
      setPatientName(session.patientName);
      setIsLoggedIn(session.isLoggedIn);
      setLoading(false);
      
      if (session.isLoggedIn) {
        console.log("[MobileAuth] Session restored for:", session.patientName);
      }
    };
    
    init();
  }, []);

  // Logout function that clears all storage layers
  const logout = useCallback(async () => {
    await clearSession();
    setPatientId(null);
    setClinicId(null);
    setPatientName(null);
    setIsLoggedIn(false);
  }, []);

  return {
    isLoggedIn,
    patientId,
    clinicId,
    patientName,
    loading,
    logout,
  };
}

// Tabs that are accessible without login
export const PUBLIC_TAB_KEYS = [
  "diretoria",
  "galeria",
  "jornais",
  "radios",
  "videos",
];
