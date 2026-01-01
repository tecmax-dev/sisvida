import { useEffect, useRef, useState, useCallback } from "react";

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  data: T;
  initialData: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
  validateBeforeSave?: (data: T) => boolean;

  // Optional: for sendBeacon fallback when tab loses focus
  beaconEndpoint?: string;
  prepareBeaconData?: (data: T) => Record<string, unknown>;

  // Optional: local draft persistence (prevents data loss if the browser reloads the page)
  storageKey?: string;
  onRestoreDraft?: (draft: T) => void;
}

export function useAutoSave<T>({
  data,
  initialData,
  onSave,
  debounceMs = 3000,
  enabled = true,
  validateBeforeSave,
  beaconEndpoint,
  prepareBeaconData,
  storageKey,
  onRestoreDraft,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isSavingRef = useRef(false);
  const dataRef = useRef(data);
  const initialDataRef = useRef(initialData);
  const pendingSaveRef = useRef(false);

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
    pendingSaveRef.current = false;
    if (!silent) setStatus('saving');

    try {
      await onSave(dataToSave);
      
      if (isMountedRef.current) {
        // Update initialData ref after successful save to prevent duplicate saves
        initialDataRef.current = dataToSave;

        // Clear draft after successful save
        if (storageKey) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // ignore
          }
        }
        
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

  // Restore draft from localStorage (if provided)
  useEffect(() => {
    if (!enabled || !storageKey || !onRestoreDraft) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { data: T; updatedAt: number };
      if (!parsed?.data) return;

      // Only restore if it differs from the last saved initial data
      if (hasChanged(parsed.data, initialDataRef.current)) {
        onRestoreDraft(parsed.data);
        dataRef.current = parsed.data;
        pendingSaveRef.current = true;
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageKey]);

  // Track pending changes + persist draft to localStorage
  useEffect(() => {
    if (enabled && hasLoadedRef.current && hasChanged(data, initialData)) {
      pendingSaveRef.current = true;

      if (storageKey) {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ data, updatedAt: Date.now() })
          );
        } catch {
          // ignore
        }
      }
    }
  }, [data, initialData, enabled, hasChanged, storageKey]);

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
        
        // Check if there are unsaved changes
        if (!hasChanged(dataRef.current, initialDataRef.current)) {
          return;
        }

        // Validate before saving
        if (validateBeforeSave && !validateBeforeSave(dataRef.current)) {
          return;
        }

        // Try beacon API first (more reliable for background saves)
        if (beaconEndpoint && prepareBeaconData) {
          try {
            const beaconData = prepareBeaconData(dataRef.current);
            const blob = new Blob([JSON.stringify(beaconData)], { type: 'application/json' });
            const sent = navigator.sendBeacon(beaconEndpoint, blob);
            if (sent) {
              initialDataRef.current = dataRef.current;
              pendingSaveRef.current = false;
              return;
            }
          } catch (e) {
            console.warn('Beacon failed, falling back to async save:', e);
          }
        }

        // Fallback: try async save (may not complete but worth trying)
        if (!isSavingRef.current) {
          performSave(dataRef.current, true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, performSave, hasChanged, validateBeforeSave, beaconEndpoint, prepareBeaconData]);

  // Save on focus return if there was a pending save
  useEffect(() => {
    if (!enabled) return;

    const handleFocus = () => {
      // When tab regains focus, check if we have unsaved changes
      if (hasLoadedRef.current && pendingSaveRef.current && !isSavingRef.current) {
        if (hasChanged(dataRef.current, initialDataRef.current)) {
          // Save immediately when focus returns
          performSave(dataRef.current, false);
        }
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, performSave, hasChanged]);

  // Save before page unload (closing browser/tab)
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasLoadedRef.current && hasChanged(dataRef.current, initialDataRef.current)) {
        // Validate before showing warning
        if (validateBeforeSave && !validateBeforeSave(dataRef.current)) {
          return;
        }

        // Try beacon first
        if (beaconEndpoint && prepareBeaconData) {
          try {
            const beaconData = prepareBeaconData(dataRef.current);
            const blob = new Blob([JSON.stringify(beaconData)], { type: 'application/json' });
            navigator.sendBeacon(beaconEndpoint, blob);
          } catch (e) {
            console.warn('Beacon on unload failed:', e);
          }
        }
        
        // Show browser's native "unsaved changes" dialog
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, hasChanged, validateBeforeSave, beaconEndpoint, prepareBeaconData]);

  // Cleanup on unmount - try to save pending changes
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Last attempt to save on unmount
      if (pendingSaveRef.current && hasChanged(dataRef.current, initialDataRef.current)) {
        if (!validateBeforeSave || validateBeforeSave(dataRef.current)) {
          if (beaconEndpoint && prepareBeaconData) {
            try {
              const beaconData = prepareBeaconData(dataRef.current);
              const blob = new Blob([JSON.stringify(beaconData)], { type: 'application/json' });
              navigator.sendBeacon(beaconEndpoint, blob);
            } catch (e) {
              console.warn('Beacon on unmount failed:', e);
            }
          }
        }
      }
    };
  }, [hasChanged, validateBeforeSave, beaconEndpoint, prepareBeaconData]);

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
