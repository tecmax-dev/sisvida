// Tracks recent tab visibility changes to prevent accidental dismiss events
// when returning to the app (e.g., Radix DismissableLayer firing on focus restore).

let lastBecameVisibleAt = 0;
let started = false;

function start() {
  if (started || typeof document === "undefined") return;
  started = true;

  const update = () => {
    if (document.visibilityState === "visible") {
      lastBecameVisibleAt = Date.now();
    }
  };

  document.addEventListener("visibilitychange", update, { passive: true });
  // Initialize
  update();
}

export function becameVisibleRecently(withinMs = 500) {
  start();
  return Date.now() - lastBecameVisibleAt <= withinMs;
}
