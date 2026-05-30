"use client";

import { useEffect } from "react";

// Janela mínima entre auto-reloads pra evitar loop. Se o erro persistir
// (não é skew de deploy, é bug real de chunk), recarregamos no máximo
// uma vez a cada RELOAD_COOLDOWN_MS e paramos.
const RELOAD_COOLDOWN_MS = 30_000;
const RELOAD_FLAG_KEY = "praxis:skew-reloaded-at";

/**
 * Recupera o app de "deployment skew": quando um deploy novo sai com a
 * aba/PWA aberta, a navegação client-side do Next tenta buscar chunks/
 * RSC do build ANTIGO (hashes que não existem mais no deploy novo). Isso
 * quebra a abertura de abas até um hard refresh manual.
 *
 * Aqui escutamos os sintomas (ChunkLoadError, falha de import dinâmico,
 * <script>/<link> que não carrega) e fazemos UM reload — que puxa o build
 * atual e conserta a navegação. Guardado por sessionStorage + cooldown
 * pra nunca entrar em loop de reload.
 */
export function DeploymentSkewRecovery() {
  useEffect(() => {
    function shouldReload(): boolean {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_FLAG_KEY) || 0);
        if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
          return false;
        }
        sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
        return true;
      } catch {
        // sessionStorage indisponível (modo privado etc.) — melhor não
        // arriscar loop; não recarrega.
        return false;
      }
    }

    function looksLikeChunkError(message: string): boolean {
      const m = message.toLowerCase();
      return (
        m.includes("chunkloaderror") ||
        m.includes("loading chunk") ||
        m.includes("loading css chunk") ||
        m.includes("failed to fetch dynamically imported module") ||
        m.includes("error loading dynamically imported module") ||
        m.includes("importing a module script failed")
      );
    }

    function recover(reason: string) {
      if (!shouldReload()) return;
      console.warn(
        `[skew-recovery] erro de chunk detectado (${reason}); recarregando pro build atual.`,
      );
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      // Script/recurso que falhou ao carregar (ex.: <script src=chunk.js>
      // de um build que sumiu) — event.message costuma ser genérico, mas
      // o target carrega a URL.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "SCRIPT" || target.tagName === "LINK")
      ) {
        const src =
          (target as HTMLScriptElement).src ||
          (target as HTMLLinkElement).href ||
          "";
        if (src.includes("/_next/")) {
          recover("script/link _next falhou");
          return;
        }
      }
      if (event.message && looksLikeChunkError(event.message)) {
        recover("window.onerror");
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason?.message || reason?.name || "";
      if (message && looksLikeChunkError(String(message))) {
        recover("unhandledrejection");
      }
    }

    // Captura na fase de capture pra pegar erros de carregamento de
    // <script>/<link>, que não borbulham.
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
