// Tracks recent tab visibility changes to prevent accidental dismiss events
// when returning to the app (e.g., Radix DismissableLayer firing on focus restore).

let lastBecameVisibleAt = 0;
let lastBecameHiddenAt = 0;
let started = false;

function start() {
  if (started || typeof document === "undefined") return;
  started = true;

  const update = () => {
    const now = Date.now();
    if (document.visibilityState === "visible") {
      lastBecameVisibleAt = now;
    } else {
      lastBecameHiddenAt = now;
    }
  };

  // Also track window focus/blur events for more reliable detection
  const handleFocus = () => {
    lastBecameVisibleAt = Date.now();
  };

  document.addEventListener("visibilitychange", update, { passive: true });
  window.addEventListener("focus", handleFocus, { passive: true });
  
  // Initialize
  update();
}

export function becameVisibleRecently(withinMs = 1000) {
  start();
  return Date.now() - lastBecameVisibleAt <= withinMs;
}

export function wasHiddenRecently(withinMs = 1000) {
  start();
  return Date.now() - lastBecameHiddenAt <= withinMs;
}

export function isTabInactive() {
  start();
  return document.hidden || document.visibilityState === "hidden" || !document.hasFocus();
}
