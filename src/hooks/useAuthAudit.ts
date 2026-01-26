/**
 * AUDIT HOOK - Instrumentação de sessão mobile
 * 
 * Este arquivo contém utilitários para auditar e logar
 * todos os pontos onde a sessão pode ser destruída.
 * 
 * USAR para debugging de problemas de sessão.
 */

/**
 * Log de auditoria para qualquer operação que afete a sessão
 */
export function auditLogSessionOperation(
  operation: 'logout' | 'clearSession' | 'signOut' | 'redirect' | 'navigate',
  source: string,
  details?: Record<string, any>
) {
  const stack = new Error().stack?.split('\n').slice(2, 6).join('\n');
  
  console.warn(`[AUTH AUDIT] ${operation.toUpperCase()} disparado`, {
    source,
    timestamp: new Date().toISOString(),
    details,
    callStack: stack,
  });
  
  // Salvar no sessionStorage para análise posterior
  try {
    const logs = JSON.parse(sessionStorage.getItem('auth_audit_logs') || '[]');
    logs.push({
      operation,
      source,
      timestamp: new Date().toISOString(),
      details,
      stack,
    });
    // Manter apenas os últimos 50 logs
    if (logs.length > 50) logs.shift();
    sessionStorage.setItem('auth_audit_logs', JSON.stringify(logs));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Verificar se há logs de auditoria recentes
 */
export function getAuditLogs(): any[] {
  try {
    return JSON.parse(sessionStorage.getItem('auth_audit_logs') || '[]');
  } catch {
    return [];
  }
}

/**
 * Limpar logs de auditoria
 */
export function clearAuditLogs(): void {
  try {
    sessionStorage.removeItem('auth_audit_logs');
  } catch {
    // Ignore
  }
}

/**
 * Dump dos logs para console
 */
export function dumpAuditLogs(): void {
  const logs = getAuditLogs();
  console.group('[AUTH AUDIT] Histórico de operações');
  logs.forEach((log, i) => {
    console.log(`${i + 1}. [${log.timestamp}] ${log.operation} @ ${log.source}`);
    if (log.details) console.log('   Details:', log.details);
    if (log.stack) console.log('   Stack:', log.stack);
  });
  console.groupEnd();
}

// Expor para console do browser
if (typeof window !== 'undefined') {
  (window as any).authAudit = {
    getLogs: getAuditLogs,
    clearLogs: clearAuditLogs,
    dumpLogs: dumpAuditLogs,
  };
}
