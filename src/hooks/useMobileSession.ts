import { useState, useEffect, useCallback } from "react";

// Keys for mobile session persistence
const STORAGE_KEYS = {
  patientId: "mobile_patient_id",
  clinicId: "mobile_clinic_id",
  patientName: "mobile_patient_name",
  // Backup keys with different prefix (redundancy)
  backupPatientId: "pwa_session_patient_id",
  backupClinicId: "pwa_session_clinic_id",
  backupPatientName: "pwa_session_patient_name",
  // Timestamp to track session age
  sessionTimestamp: "mobile_session_timestamp",
};

// IndexedDB configuration for maximum persistence
const IDB_NAME = "MobileAppSession";
const IDB_STORE = "session";
const IDB_VERSION = 1;

interface MobileSession {
  patientId: string | null;
  clinicId: string | null;
  patientName: string | null;
  isLoggedIn: boolean;
}

/**
 * Opens IndexedDB connection
 */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

/**
 * Saves value to IndexedDB
 */
async function saveToIDB(key: string, value: string | null): Promise<void> {
  try {
    const db = await openIDB();
    const transaction = db.transaction(IDB_STORE, "readwrite");
    const store = transaction.objectStore(IDB_STORE);
    
    if (value === null) {
      store.delete(key);
    } else {
      store.put(value, key);
    }
    
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    
    db.close();
  } catch (err) {
    console.warn("[MobileSession] IDB save error:", err);
  }
}

/**
 * Reads value from IndexedDB
 */
async function readFromIDB(key: string): Promise<string | null> {
  try {
    const db = await openIDB();
    const transaction = db.transaction(IDB_STORE, "readonly");
    const store = transaction.objectStore(IDB_STORE);
    const request = store.get(key);
    
    const result = await new Promise<string | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    return result;
  } catch (err) {
    console.warn("[MobileSession] IDB read error:", err);
    return null;
  }
}

/**
 * Saves session data to all storage layers (redundancy)
 */
async function persistSession(patientId: string, clinicId: string, patientName: string): Promise<void> {
  const timestamp = Date.now().toString();
  
  // Layer 1: Primary localStorage
  try {
    localStorage.setItem(STORAGE_KEYS.patientId, patientId);
    localStorage.setItem(STORAGE_KEYS.clinicId, clinicId);
    localStorage.setItem(STORAGE_KEYS.patientName, patientName);
    localStorage.setItem(STORAGE_KEYS.sessionTimestamp, timestamp);
  } catch (err) {
    console.warn("[MobileSession] localStorage save error:", err);
  }
  
  // Layer 2: Backup localStorage with different keys
  try {
    localStorage.setItem(STORAGE_KEYS.backupPatientId, patientId);
    localStorage.setItem(STORAGE_KEYS.backupClinicId, clinicId);
    localStorage.setItem(STORAGE_KEYS.backupPatientName, patientName);
  } catch (err) {
    console.warn("[MobileSession] backup localStorage save error:", err);
  }
  
  // Layer 3: IndexedDB (most persistent)
  await saveToIDB("patientId", patientId);
  await saveToIDB("clinicId", clinicId);
  await saveToIDB("patientName", patientName);
  await saveToIDB("sessionTimestamp", timestamp);
  
  console.log("[MobileSession] Session persisted successfully");
}

/**
 * Clears session from all storage layers
 */
async function clearSession(): Promise<void> {
  // Layer 1: Primary localStorage
  try {
    localStorage.removeItem(STORAGE_KEYS.patientId);
    localStorage.removeItem(STORAGE_KEYS.clinicId);
    localStorage.removeItem(STORAGE_KEYS.patientName);
    localStorage.removeItem(STORAGE_KEYS.sessionTimestamp);
  } catch (err) {
    console.warn("[MobileSession] localStorage clear error:", err);
  }
  
  // Layer 2: Backup localStorage
  try {
    localStorage.removeItem(STORAGE_KEYS.backupPatientId);
    localStorage.removeItem(STORAGE_KEYS.backupClinicId);
    localStorage.removeItem(STORAGE_KEYS.backupPatientName);
  } catch (err) {
    console.warn("[MobileSession] backup localStorage clear error:", err);
  }
  
  // Layer 3: IndexedDB
  await saveToIDB("patientId", null);
  await saveToIDB("clinicId", null);
  await saveToIDB("patientName", null);
  await saveToIDB("sessionTimestamp", null);
  
  console.log("[MobileSession] Session cleared successfully");
}

/**
 * Restores session from any available storage layer
 * Priority: localStorage > backup localStorage > IndexedDB
 */
async function restoreSession(): Promise<MobileSession> {
  let patientId: string | null = null;
  let clinicId: string | null = null;
  let patientName: string | null = null;
  
  // Try Layer 1: Primary localStorage
  try {
    patientId = localStorage.getItem(STORAGE_KEYS.patientId);
    clinicId = localStorage.getItem(STORAGE_KEYS.clinicId);
    patientName = localStorage.getItem(STORAGE_KEYS.patientName);
  } catch (err) {
    console.warn("[MobileSession] localStorage read error:", err);
  }
  
  // Try Layer 2: Backup localStorage if primary failed
  if (!patientId) {
    try {
      patientId = localStorage.getItem(STORAGE_KEYS.backupPatientId);
      clinicId = localStorage.getItem(STORAGE_KEYS.backupClinicId);
      patientName = localStorage.getItem(STORAGE_KEYS.backupPatientName);
      
      if (patientId) {
        console.log("[MobileSession] Restored from backup localStorage");
        // Sync back to primary
        localStorage.setItem(STORAGE_KEYS.patientId, patientId);
        if (clinicId) localStorage.setItem(STORAGE_KEYS.clinicId, clinicId);
        if (patientName) localStorage.setItem(STORAGE_KEYS.patientName, patientName);
      }
    } catch (err) {
      console.warn("[MobileSession] backup localStorage read error:", err);
    }
  }
  
  // Try Layer 3: IndexedDB if both localStorage attempts failed
  if (!patientId) {
    patientId = await readFromIDB("patientId");
    clinicId = await readFromIDB("clinicId");
    patientName = await readFromIDB("patientName");
    
    if (patientId) {
      console.log("[MobileSession] Restored from IndexedDB");
      // Sync back to localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.patientId, patientId);
        localStorage.setItem(STORAGE_KEYS.backupPatientId, patientId);
        if (clinicId) {
          localStorage.setItem(STORAGE_KEYS.clinicId, clinicId);
          localStorage.setItem(STORAGE_KEYS.backupClinicId, clinicId);
        }
        if (patientName) {
          localStorage.setItem(STORAGE_KEYS.patientName, patientName);
          localStorage.setItem(STORAGE_KEYS.backupPatientName, patientName);
        }
      } catch (err) {
        console.warn("[MobileSession] Failed to sync IDB to localStorage:", err);
      }
    }
  }
  
  return {
    patientId,
    clinicId,
    patientName,
    isLoggedIn: !!patientId,
  };
}

/**
 * Hook for managing mobile session with redundant persistence
 */
export function useMobileSession() {
  const [session, setSession] = useState<MobileSession>({
    patientId: null,
    clinicId: null,
    patientName: null,
    isLoggedIn: false,
  });
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const init = async () => {
      const restoredSession = await restoreSession();
      setSession(restoredSession);
      setLoading(false);
      setRestored(true);
      
      if (restoredSession.isLoggedIn) {
        console.log("[MobileSession] Session restored:", restoredSession.patientName);
      } else {
        console.log("[MobileSession] No session found");
      }
    };
    
    init();
  }, []);

  // Login function with redundant persistence
  const login = useCallback(async (patientId: string, clinicId: string, patientName: string) => {
    await persistSession(patientId, clinicId, patientName);
    setSession({
      patientId,
      clinicId,
      patientName,
      isLoggedIn: true,
    });
  }, []);

  // Logout function that clears all storage layers
  const logout = useCallback(async () => {
    await clearSession();
    setSession({
      patientId: null,
      clinicId: null,
      patientName: null,
      isLoggedIn: false,
    });
  }, []);

  // Verify session integrity (can be called periodically)
  const verifySession = useCallback(async (): Promise<boolean> => {
    const restoredSession = await restoreSession();
    
    if (restoredSession.isLoggedIn !== session.isLoggedIn) {
      setSession(restoredSession);
    }
    
    return restoredSession.isLoggedIn;
  }, [session.isLoggedIn]);

  return {
    ...session,
    loading,
    restored,
    login,
    logout,
    verifySession,
  };
}

// Export utility functions for direct use
export { persistSession, clearSession, restoreSession, STORAGE_KEYS };
