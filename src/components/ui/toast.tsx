"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Undo2, X } from "lucide-react";

type Toast = {
  id: string;
  message: string;
  variant?: "success" | "info" | "error";
  undo?: () => void;
  durationMs?: number;
};

type ToastContextValue = {
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Toast simples com suporte a "Desfazer" inline. Auto-dismiss configurável
 * (default 5s). Uma única fila visível por vez na base da tela.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastContextValue["push"]>(
    (toast) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current.slice(-2), { id, ...toast }]);
      const timer = window.setTimeout(() => dismiss(id), toast.durationMs ?? 5000);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--mobile-bottom-nav-space,0px)+5rem)] z-[200] flex flex-col items-center gap-2 px-4 sm:bottom-8"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-sm border border-zinc-700 bg-[rgba(14,14,17,0.98)] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.55)] animate-in fade-in-0 slide-in-from-bottom-3"
          >
            {toast.variant === "error" ? (
              <X className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            )}
            <p className="flex-1 text-sm text-zinc-100">{toast.message}</p>
            {toast.undo ? (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  dismiss(toast.id);
                }}
                className="inline-flex items-center gap-1 rounded-sm border border-[var(--accent)] bg-[rgba(251,146,60,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)] transition hover:bg-[rgba(251,146,60,0.2)]"
              >
                <Undo2 className="h-3 w-3" />
                Desfazer
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Fechar"
              className="text-zinc-500 transition hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback silencioso pra contextos onde o provider não está montado
    // (ex.: testes, server components) — sem crash.
    return {
      push: () => {},
      dismiss: () => {},
    } satisfies ToastContextValue;
  }
  return context;
}
