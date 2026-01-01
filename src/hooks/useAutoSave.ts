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
  const isSavingRef = useRef(false);
  const dataRef = useRef(data);
  const initialDataRef = useRef(initialData);

  // Keep refs updated
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  // Check if data has changed
  const hasChanged = useCallback((current: T, initial: T): boolean => {
    return JSON.stringify(current) !== JSON.stringify(initial);
  }, []);

  // Perform save
  const performSave = useCallback(async (dataToSave: T, silent = false) => {
    if (!isMountedRef.current || isSavingRef.current) return;
    
    // Validate before saving if validator provided
    if (validateBeforeSave && !validateBeforeSave(dataToSave)) {
      return;
    }

    // Check if there are actual changes
    if (!hasChanged(dataToSave, initialDataRef.current)) {
      return;
    }

    isSavingRef.current = true;
    if (!silent) setStatus('saving');

    try {
      await onSave(dataToSave);
      
      if (isMountedRef.current) {
        if (!silent) {
          setStatus('saved');
          
          // Reset status after 2 seconds
          setTimeout(() => {
            if (isMountedRef.current) {
              setStatus('idle');
            }
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Auto-save error:", error);
      if (isMountedRef.current && !silent) {
        setStatus('error');
        
        // Reset status after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('idle');
          }
        }, 3000);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, validateBeforeSave, hasChanged]);

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

  // Save on tab switch (visibilitychange) - prevents data loss when switching tabs
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasLoadedRef.current) {
        // Cancel pending debounced save
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Save immediately if there are changes (silent to avoid UI flicker)
        if (hasChanged(dataRef.current, initialDataRef.current)) {
          performSave(dataRef.current, true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, performSave, hasChanged]);

  // Save before page unload (closing browser/tab)
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasLoadedRef.current && hasChanged(dataRef.current, initialDataRef.current)) {
        // Try to save synchronously (may not complete but try)
        performSave(dataRef.current, true);
        
        // Show browser's native "unsaved changes" dialog
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, performSave, hasChanged]);

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
