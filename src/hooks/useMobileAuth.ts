import { useState, useEffect } from "react";

export function useMobileAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedPatientId = localStorage.getItem("mobile_patient_id");
    setPatientId(storedPatientId);
    setIsLoggedIn(!!storedPatientId);
    setLoading(false);
  }, []);

  return {
    isLoggedIn,
    patientId,
    loading,
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
