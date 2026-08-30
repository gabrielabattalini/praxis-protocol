"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { TaskCreationKey } from "@/lib/task-creation";
import { useAppStore } from "@/components/providers/app-store-provider";

type CreateTaskState = {
  open: boolean;
  /** pré-seleção de tipo (pula o passo 1 quando informada) */
  preselected: TaskCreationKey | null;
  /**
   * Incrementa a cada abertura. O modal usa como `key` do corpo pra
   * remontar com estado zerado — evita useEffect+setState de reset
   * (a regra react-hooks/set-state-in-effect proíbe).
   */
  openNonce: number;
};

type CreateTaskContextValue = {
  state: CreateTaskState;
  openCreateTask: (preselected?: TaskCreationKey) => void;
  closeCreateTask: () => void;
};

const CreateTaskContext = createContext<CreateTaskContextValue | null>(null);

/**
 * Estado global do fluxo "Nova meta" (modal de 2 passos). Montado no
 * AppShell pra qualquer página (FAB, dashboard, /tasks) abrir o MESMO
 * modal sem navegação.
 *
 * GUARD DE PAYWALL: o AppShell fica FORA do PaywallGate (o gate embrulha
 * só o conteúdo da página). Sem este check, o modal aberto pelo FAB
 * deixaria conta free criar tarefa por fora da tela de ativação. Conta
 * sem plano é levada pra /tasks, onde o gate mostra a ativação.
 */
export function CreateTaskProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { entitlement, entitlementLoaded } = useAppStore();
  const [state, setState] = useState<CreateTaskState>({
    open: false,
    preselected: null,
    openNonce: 0,
  });

  const openCreateTask = useCallback(
    (preselected?: TaskCreationKey) => {
      // Só bloqueia quem é COMPROVADAMENTE free. Durante o fetch do
      // entitlement (hasFullAccess começa false), um pagante que acabou
      // de recarregar seria redirecionado à toa — abre o modal; as APIs
      // caras têm gate próprio no servidor de qualquer forma.
      if (entitlementLoaded && !entitlement.hasFullAccess) {
        router.push("/tasks");
        return;
      }
      setState((current) => ({
        open: true,
        preselected: preselected ?? null,
        openNonce: current.openNonce + 1,
      }));
    },
    [entitlement.hasFullAccess, entitlementLoaded, router],
  );

  const closeCreateTask = useCallback(() => {
    setState((current) => ({ ...current, open: false, preselected: null }));
  }, []);

  const value = useMemo(
    () => ({ state, openCreateTask, closeCreateTask }),
    [state, openCreateTask, closeCreateTask],
  );

  return (
    <CreateTaskContext.Provider value={value}>
      {children}
    </CreateTaskContext.Provider>
  );
}

export function useCreateTask() {
  const context = useContext(CreateTaskContext);
  if (!context) {
    throw new Error("useCreateTask precisa estar dentro de CreateTaskProvider");
  }
  return context;
}
