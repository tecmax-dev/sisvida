/**
 * UI INTEGRITY GUARD
 * 
 * Monitora o DOM em tempo real para detectar e remover
 * componentes não autorizados (popups, overlays, iframes, scripts)
 * que possam ser injetados sem autorização do administrador.
 * 
 * Funciona via MutationObserver para capturar injeções dinâmicas.
 */

// Lista de palavras-chave que indicam conteúdo não autorizado
const BLOCKED_CONTENT_PATTERNS = [
  /leigosacademy/i,
  /hacke[rd]/i,
  /invadid[ao]/i,
  /sequestrad[ao]/i,
  /ransom/i,
  /aviso\s+de\s+seguran[cç]a/i,
  /sua?\s+conta\s+foi/i,
  /sistema\s+comprometido/i,
  /vazamento\s+de\s+dados/i,
  /phishing/i,
];

// Identificadores de componentes bloqueados (classes, IDs, data-attributes)
const BLOCKED_SELECTORS = [
  '[data-security-popup]',
  '[data-unauthorized]',
  '#security-popup',
  '#hacked-popup',
  '.security-popup',
];

interface IntegrityViolation {
  type: 'blocked_content' | 'blocked_selector' | 'suspicious_overlay';
  element: string;
  content: string;
  timestamp: string;
  action: 'removed';
}

const violations: IntegrityViolation[] = [];

function checkElement(node: Element): boolean {
  // Check blocked selectors
  for (const selector of BLOCKED_SELECTORS) {
    try {
      if (node.matches(selector)) {
        logAndRemove(node, 'blocked_selector', selector);
        return true;
      }
    } catch { /* ignore invalid selector */ }
  }

  // Check text content against blocked patterns
  const textContent = node.textContent || '';
  for (const pattern of BLOCKED_CONTENT_PATTERNS) {
    if (pattern.test(textContent)) {
      // Only block if it looks like an overlay/popup (fixed/absolute positioned, high z-index)
      const style = window.getComputedStyle(node);
      const isOverlay = 
        style.position === 'fixed' || 
        style.position === 'absolute' ||
        parseInt(style.zIndex || '0') > 9000;
      
      if (isOverlay) {
        logAndRemove(node, 'blocked_content', pattern.source);
        return true;
      }
    }
  }

  return false;
}

function logAndRemove(node: Element, type: IntegrityViolation['type'], detail: string) {
  const violation: IntegrityViolation = {
    type,
    element: node.tagName + (node.id ? `#${node.id}` : '') + (node.className ? `.${String(node.className).split(' ')[0]}` : ''),
    content: (node.textContent || '').slice(0, 100),
    timestamp: new Date().toISOString(),
    action: 'removed',
  };

  violations.push(violation);
  if (violations.length > 100) violations.shift();

  console.error(`[UI INTEGRITY] ⚠️ Componente não autorizado REMOVIDO`, {
    type,
    detail,
    element: violation.element,
    preview: violation.content,
  });

  // Remove the unauthorized element
  node.remove();

  // Persist violation log
  try {
    const stored = JSON.parse(localStorage.getItem('ui_integrity_violations') || '[]');
    stored.push(violation);
    if (stored.length > 50) stored.shift();
    localStorage.setItem('ui_integrity_violations', JSON.stringify(stored));
  } catch { /* ignore */ }
}

let observer: MutationObserver | null = null;

export function startUIIntegrityGuard() {
  if (observer) return; // Already running

  // Scan existing DOM
  document.querySelectorAll('*').forEach((el) => checkElement(el));

  // Watch for new injections
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          checkElement(node);
          // Also check children
          node.querySelectorAll('*').forEach((child) => checkElement(child));
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.info('[UI INTEGRITY] Guard ativo - monitorando injeções não autorizadas');
}

export function stopUIIntegrityGuard() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

export function getIntegrityViolations(): IntegrityViolation[] {
  try {
    return JSON.parse(localStorage.getItem('ui_integrity_violations') || '[]');
  } catch {
    return [];
  }
}

// Expose to browser console for admin inspection
if (typeof window !== 'undefined') {
  (window as any).uiIntegrity = {
    getViolations: getIntegrityViolations,
    clearViolations: () => localStorage.removeItem('ui_integrity_violations'),
    isActive: () => observer !== null,
  };
}
