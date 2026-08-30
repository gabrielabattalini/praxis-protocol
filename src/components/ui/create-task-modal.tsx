"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Sparkles, X, Zap } from "lucide-react";
import { moduleCatalog } from "@/lib/mock-data";
import {
  getTaskCreationConfig,
  type TaskCreationKey,
} from "@/lib/task-creation";
import { useAppStore } from "@/components/providers/app-store-provider";
import { useCreateTask } from "@/components/providers/create-task-provider";
import { QuickTaskForm } from "@/components/ui/quick-task-form";
import { useToast } from "@/components/ui/toast";

/**
 * Modal global de 2 passos do fluxo "Nova meta":
 *   passo 1 — "qual o tipo?": meta avulsa + módulos ativos, com badge
 *             honesto (⚡ cria aqui / ↗ abre o módulo);
 *   passo 2 — form rápido (tipos seguros) OU navegação pro módulo.
 *
 * Portal em document.body (padrão do picker de coluna do módulo Work).
 * z-[160]: acima do FAB (150) e abaixo de palette/toasts (200).
 *
 * Só renderiza com o modal aberto — abertura é sempre ação do usuário
 * (pós-hidratação), então o portal nunca roda no servidor. O corpo é
 * remontado via key={openNonce} pra cada abertura começar zerada (o
 * useState inicial faz o papel do reset, sem setState em effect).
 */
export function CreateTaskModal() {
  const { state: modal, closeCreateTask } = useCreateTask();

  useEffect(() => {
    if (!modal.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCreateTask();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal.open, closeCreateTask]);

  if (!modal.open) return null;

  return createPortal(
    <ModalBody key={modal.openNonce} preselected={modal.preselected} />,
    document.body,
  );
}

function ModalBody({
  preselected,
}: {
  preselected: TaskCreationKey | null;
}) {
  const router = useRouter();
  const { closeCreateTask } = useCreateTask();
  const { state } = useAppStore();
  const { push } = useToast();
  // Pré-seleção só vale pra quick-form: chave navigate pré-selecionada
  // renderizaria header sem corpo (o branch navigate vive no choose());
  // nesse caso cai no passo 1, onde o clique navega corretamente.
  const [selected, setSelected] = useState<TaskCreationKey | null>(
    preselected && getTaskCreationConfig(preselected).mode === "quick-form"
      ? preselected
      : null,
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  // A11y: com aria-modal, o leitor de tela esconde a página — se o foco
  // ficar no botão disparador atrás do backdrop, o fluxo fica inoperável
  // por teclado. Move o foco pro dialog ao montar (sem roubar o autoFocus
  // do form no passo 2) e devolve ao disparador quando fechar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    if (node && !node.contains(document.activeElement)) {
      node.focus();
    }
    return () => previous?.focus?.();
  }, []);

  function trapTab(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const activeModules = moduleCatalog.filter(
    (module) => state.settings.activeModules[module.id],
  );

  function choose(key: TaskCreationKey) {
    const config = getTaskCreationConfig(key);
    if (config.mode === "navigate") {
      closeCreateTask();
      router.push(config.route);
      return;
    }
    setSelected(key);
  }

  const selectedConfig = selected ? getTaskCreationConfig(selected) : null;
  const selectedModule =
    selected && selected !== "custom"
      ? moduleCatalog.find((module) => module.id === selected)
      : null;

  const backdropMouseDown = useRef(false);

  function onBackdropMouseDown(event: React.MouseEvent) {
    // Só conta como "clique fora" se o gesto COMEÇOU no backdrop —
    // selecionar texto no input e soltar fora da sheet dispara o click
    // no overlay e fechava o modal, descartando o form.
    backdropMouseDown.current = event.target === event.currentTarget;
  }

  function onBackdropClick(event: React.MouseEvent) {
    if (!backdropMouseDown.current || event.target !== event.currentTarget) {
      return;
    }
    // Mobile: com o teclado virtual aberto (input focado), o toque fora
    // da sheet só dispensa o teclado — fechava o modal inteiro e perdia
    // o que foi digitado. O segundo toque fecha de verdade.
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
    ) {
      active.blur();
      return;
    }
    closeCreateTask();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Criar nova meta"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={trapTab}
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/70 backdrop-blur-sm outline-none sm:items-center"
      onMouseDown={onBackdropMouseDown}
      onClick={onBackdropClick}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-zinc-800 bg-[#0b0b0d] p-5 pb-[calc(20px+var(--mobile-bottom-nav-space,0px))] sm:rounded-xl sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {selected && selectedConfig?.mode === "quick-form" ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-8 w-8 place-items-center rounded-sm border border-zinc-800 bg-black/40 text-zinc-400 hover:text-white"
                aria-label="Trocar tipo"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <h2 className="text-lg font-semibold text-white">
              {selected
                ? selected === "custom"
                  ? "Meta avulsa"
                  : `Meta de ${selectedModule?.name ?? ""}`
                : "Qual o tipo da meta?"}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCreateTask}
            className="grid h-8 w-8 place-items-center rounded-sm border border-zinc-800 bg-black/40 text-zinc-400 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!selected ? (
          <div className="grid gap-2.5">
            {/* Meta avulsa sempre no topo — o caminho mais rápido. */}
            <button
              type="button"
              onClick={() => choose("custom")}
              className="rounded-md border border-amber-300/25 bg-amber-300/5 p-4 text-left transition hover:border-amber-300/50"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-100">
                  <Sparkles className="mr-1.5 inline h-4 w-4" />
                  Meta avulsa
                </p>
                <QuickBadge quick />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Entra direto na sua agenda, sem módulo.
              </p>
            </button>

            {activeModules.map((module) => {
              const config = getTaskCreationConfig(module.id);
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => choose(module.id)}
                  className="rounded-md border border-zinc-800 bg-black/40 p-4 text-left transition hover:border-white/25"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${module.accent}`}>
                      {module.name}
                    </p>
                    <QuickBadge quick={config.mode === "quick-form"} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{config.hint}</p>
                </button>
              );
            })}
          </div>
        ) : selectedConfig?.mode === "quick-form" ? (
          <QuickTaskForm
            moduleId={selected === "custom" ? null : selected}
            config={selectedConfig}
            onCreated={(title) => {
              closeCreateTask();
              push({
                message: `Meta "${title}" criada${selectedModule ? ` em ${selectedModule.name}` : ""}`,
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function QuickBadge({ quick }: { quick: boolean }) {
  return quick ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
      <Zap className="h-3 w-3" />
      Criar aqui
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-zinc-700 bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
      <ArrowUpRight className="h-3 w-3" />
      Abre o módulo
    </span>
  );
}
