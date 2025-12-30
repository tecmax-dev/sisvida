import { useEffect, useRef, useState, useCallback } from "react";

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  data: T;
  initialData: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
  validateBeforeSave?: (data: T) => boolean;
}

export function useAutoSave<T>({
  data,
  initialData,
  onSave,
  debounceMs = 3000,
  enabled = true,
  validateBeforeSave,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Check if data has changed
  const hasChanged = useCallback((current: T, initial: T): boolean => {
    return JSON.stringify(current) !== JSON.stringify(initial);
  }, []);

  // Perform save
  const performSave = useCallback(async (dataToSave: T) => {
    if (!isMountedRef.current) return;
    
    // Validate before saving if validator provided
    if (validateBeforeSave && !validateBeforeSave(dataToSave)) {
      return;
    }

    setStatus('saving');

    try {
      await onSave(dataToSave);
      
      if (isMountedRef.current) {
        setStatus('saved');
        
        // Reset status after 2 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('idle');
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Auto-save error:", error);
      if (isMountedRef.current) {
        setStatus('error');
        
        // Reset status after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('idle');
          }
        }, 3000);
      }
    }
  }, [onSave, validateBeforeSave]);

  // Mark as loaded after initial data is set
  useEffect(() => {
    if (initialData && JSON.stringify(initialData) !== JSON.stringify({})) {
      hasLoadedRef.current = true;
    }
  }, [initialData]);

  // Auto-save effect with debounce
  useEffect(() => {
    if (!enabled || !hasLoadedRef.current || !hasChanged(data, initialData)) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      performSave(data);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, initialData, enabled, debounceMs, performSave, hasChanged]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Force save now (bypass debounce)
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    performSave(data);
  }, [data, performSave]);

  return {
    status,
    saveNow,
    hasUnsavedChanges: hasChanged(data, initialData),
  };
}
