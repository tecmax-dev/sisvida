/**
 * HOOK LEGADO - Mantido para compatibilidade
 * 
 * ❌ DEPRECATED: Use useMobileAuth() do MobileAuthContext em vez disso
 * 
 * Este hook existe apenas para não quebrar código existente.
 * Novas implementações devem usar o contexto MobileAuthContext.
 */

import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS } from "./useMobileSession";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

export function useMobileAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apenas leitura passiva do localStorage (bootstrap já validou)
    try {
      const pid = localStorage.getItem(STORAGE_KEYS.patientId);
      const cid = localStorage.getItem(STORAGE_KEYS.clinicId);
      const pname = localStorage.getItem(STORAGE_KEYS.patientName);
      
      setPatientId(pid);
      setClinicId(cid || TARGET_CLINIC_ID);
      setPatientName(pname);
      setIsLoggedIn(!!pid);
      
      if (pid) {
        console.log("[MobileAuth Legacy] Dados carregados:", pname);
      }
    } catch (err) {
      console.warn("[MobileAuth Legacy] Erro ao ler localStorage:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout não deve ser usado aqui - use MobileAuthContext
  const logout = useCallback(async () => {
    console.warn("[MobileAuth Legacy] Use useMobileAuth() do MobileAuthContext para logout");
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

// Tabs que são acessíveis sem login
export const PUBLIC_TAB_KEYS = [
  "diretoria",
  "galeria",
  "jornais",
  "radios",
  "videos",
];
