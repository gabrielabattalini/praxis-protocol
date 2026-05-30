"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Dumbbell,
  Home as HomeIcon,
  Search,
  Target,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { useToast } from "@/components/ui/toast";
import { moduleCatalog } from "@/lib/mock-data";

type SearchItem = {
  id: string;
  label: string;
  category: string;
  hint?: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

const STATIC_PAGES: Array<{
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ReactNode;
}> = [
  { id: "page:dashboard", label: "Dashboard", hint: "Visão geral", href: "/dashboard", icon: <HomeIcon className="h-4 w-4" /> },
  { id: "page:tasks", label: "Missões", hint: "Agenda do dia", href: "/tasks", icon: <Target className="h-4 w-4" /> },
  { id: "page:agenda", label: "Agenda", hint: "Cronograma semanal", href: "/agenda", icon: <Calendar className="h-4 w-4" /> },
  { id: "page:profile", label: "Perfil", hint: "Operador", href: "/profile", icon: <HomeIcon className="h-4 w-4" /> },
  { id: "page:settings", label: "Configurações", hint: "Preferências", href: "/settings", icon: <HomeIcon className="h-4 w-4" /> },
  { id: "page:nutrition", label: "Dieta", hint: "Refeições e macros", href: "/modules/nutrition", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: "page:workout", label: "Treino", hint: "Programa de força", href: "/modules/workout", icon: <Dumbbell className="h-4 w-4" /> },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Cmd+K pesquisa global. Indexa páginas estáticas, módulos ativos, tarefas
 * pendentes de hoje e refeições do plano. Ação: navegar pra página ou
 * marcar item rápido. Tem suporte a teclado (arrows + Enter + Esc).
 */
export function CommandPalette() {
  const router = useRouter();
  const { state, actions } = useAppStore();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const todayKey = new Date().toISOString().slice(0, 10);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closePalette = useCallback(() => setOpen(false), []);

  // Hotkey: Cmd+K / Ctrl+K toggle. Esc fecha.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isCmdK) {
        event.preventDefault();
        if (open) closePalette();
        else openPalette();
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        closePalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, openPalette, closePalette]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setCursor(0);
  }, []);

  const items = useMemo<SearchItem[]>(() => {
    const list: SearchItem[] = [];

    // Páginas estáticas
    for (const page of STATIC_PAGES) {
      list.push({
        id: page.id,
        label: page.label,
        category: "Página",
        hint: page.hint,
        icon: page.icon,
        onSelect: () => router.push(page.href),
      });
    }

    // Módulos ativos
    for (const moduleConfig of moduleCatalog) {
      if (!state.settings.activeModules[moduleConfig.id]) continue;
      list.push({
        id: `module:${moduleConfig.id}`,
        label: moduleConfig.name,
        category: "Módulo",
        hint: moduleConfig.detail,
        icon: <Target className="h-4 w-4" />,
        onSelect: () => router.push(moduleConfig.route),
      });
    }

    // Tarefas manuais pendentes de hoje
    for (const task of state.tasks) {
      if (task.completed) continue;
      list.push({
        id: `task:${task.id}`,
        label: task.title,
        category: "Tarefa",
        hint: task.scheduledTime ? `Marcada para ${task.scheduledTime}` : "Sem horário",
        icon: <Target className="h-4 w-4" />,
        onSelect: () => {
          actions.toggleTask(task.id);
          toast.push({
            message: `Concluída: ${task.title}`,
            undo: () => actions.toggleTask(task.id),
          });
        },
      });
    }

    // Refeições / itens pendentes hoje
    for (const block of state.mealPlan ?? []) {
      for (const item of block.items) {
        const done =
          item.completedDates?.includes(todayKey) ||
          item.completedAt?.slice(0, 10) === todayKey;
        if (done) continue;
        list.push({
          id: `meal:${block.id}:${item.id}`,
          label: item.label,
          category: "Refeição",
          hint: block.title + (block.time ? ` · ${block.time}` : ""),
          icon: <UtensilsCrossed className="h-4 w-4" />,
          onSelect: () => {
            actions.toggleMealItemCompleted({
              blockId: block.id,
              itemId: item.id,
              dateKey: todayKey,
            });
            toast.push({
              message: `Concluído: ${item.label}`,
              undo: () =>
                actions.toggleMealItemCompleted({
                  blockId: block.id,
                  itemId: item.id,
                  dateKey: todayKey,
                }),
            });
          },
        });
      }
    }

    return list;
  }, [state.mealPlan, state.settings.activeModules, state.tasks, todayKey, router, actions, toast]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    if (!normalizedQuery) return items.slice(0, 30);
    return items
      .filter((item) => {
        const haystack = normalizeText(`${item.label} ${item.hint ?? ""} ${item.category}`);
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 50);
  }, [items, query]);

  const onListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((current) => Math.min(current + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((current) => Math.max(current - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = filtered[cursor];
        if (item) {
          item.onSelect();
          setOpen(false);
        }
      }
    },
    [cursor, filtered],
  );

  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-cmd-index="${cursor}"]`,
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label="Abrir pesquisa rápida (Ctrl+K)"
        title="Pesquisa rápida (Ctrl+K)"
        className="hidden sm:inline-flex fixed bottom-6 left-6 z-[150] h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-[rgba(14,14,17,0.92)] text-zinc-300 shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Pesquisa rápida"
        className="w-full max-w-xl overflow-hidden rounded-sm border border-zinc-700 bg-[rgba(10,10,12,0.98)] shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={onListKeyDown}
            placeholder="Buscar tarefas, refeições, páginas…"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <span className="hidden text-[10px] uppercase tracking-widest text-zinc-600 sm:inline">
            ESC
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            className="text-zinc-500 transition hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Nada encontrado para “{query}”.
            </p>
          ) : (
            filtered.map((item, index) => {
              const isActive = index === cursor;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-cmd-index={index}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-[rgba(251,146,60,0.1)] text-zinc-100"
                      : "text-zinc-300"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-sm border ${
                      isActive
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-zinc-800 text-zinc-500"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    {item.hint ? (
                      <p className="truncate text-xs text-zinc-500">{item.hint}</p>
                    ) : null}
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-600">
          <span>↑↓ navegar · Enter selecionar</span>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
