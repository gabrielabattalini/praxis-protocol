/**
 * Gate das rotas/páginas de diagnóstico (/api/debug/*, /debug/*).
 *
 * Auditoria: essas rotas eram acessíveis por QUALQUER usuário logado em
 * produção — algumas rodam Playwright sob demanda e/ou despejam dados em
 * cache (inclusive de outras contas no mesmo dispositivo). São temporárias
 * de desenvolvimento, então em produção ficam DESLIGADAS por padrão; só
 * abrem com a flag explícita ENABLE_DEBUG_ROUTES=true.
 */
export function isDebugAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ENABLE_DEBUG_ROUTES === "true";
}
