"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Hourglass,
  Pause,
  PenSquare,
  Play,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Sparkles,
  TimerReset,
  Trash2,
  Waves,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { MiniStat, RxPBar } from "@/components/redesign/primitives";

type ToolAppId = "focus-timer" | "white-noise" | "breathing-reset" | "quick-diary" | "countdown";
type TimerMode = "focus" | "break";
type BreathPhase = "inhale" | "hold" | "exhale" | "reset";

type FocusPreset = { id: string; label: string; focus: number; pause: number; desc: string };
type FocusState = {
  presetId: string;
  focus: number;
  pause: number;
  mode: TimerMode;
  remaining: number;
  running: boolean;
  startedAt?: number;
  sessions: number;
  minutes: number;
  day: string;
};
type NoisePreset = { id: string; label: string; desc: string; type: BiquadFilterType; freq: number; q?: number; rate?: number };
type NoiseState = { presetId: string; volume: number; playing: boolean };
type BreathPreset = { id: string; label: string; desc: string; inhale: number; hold: number; exhale: number; reset: number };
type BreathState = { presetId: string; phase: BreathPhase; remaining: number; running: boolean; cycles: number; minutes: number };

const focusPresets: FocusPreset[] = [
  { id: "classic", label: "Clássico 25/5", focus: 25, pause: 5, desc: "Ideal para vencer a fricção inicial." },
  { id: "deep", label: "Profundo 50/10", focus: 50, pause: 10, desc: "Bom para blocos longos de execução." },
  { id: "sprint", label: "Sprint 90/20", focus: 90, pause: 20, desc: "Alta intensidade com recuperação maior." },
];
const noisePresets: NoisePreset[] = [
  { id: "studio-air", label: "Studio Air", desc: "Ruído mais aberto para leitura e escrita.", type: "lowpass", freq: 6200, q: 0.7 },
  { id: "brown-flow", label: "Brown Flow", desc: "Base mais grave para reduzir distrações secas.", type: "lowpass", freq: 1200, q: 0.9, rate: 0.95 },
  { id: "focus-rain", label: "Focus Rain", desc: "Camada mais leve e brilhante para blocos rápidos.", type: "bandpass", freq: 1800, q: 0.75, rate: 1.04 },
];
const breathPresets: BreathPreset[] = [
  { id: "box", label: "Box 4-4-4-4", desc: "Boa para estabilizar antes de voltar ao trabalho.", inhale: 4, hold: 4, exhale: 4, reset: 4 },
  { id: "calm", label: "Calm 4-2-6", desc: "Expiração maior para baixar a agitação.", inhale: 4, hold: 2, exhale: 6, reset: 0 },
  { id: "restore", label: "Restore 4-4-8", desc: "Mais profundo para sair de tensão acumulada.", inhale: 4, hold: 4, exhale: 8, reset: 0 },
];
const apps = [
  { id: "focus-timer" as const, title: "Focus Timer", status: "ATIVO", desc: "Otimize seus blocos de trabalho.", icon: TimerReset },
  { id: "white-noise" as const, title: "Ruído branco", status: "ATIVO", desc: "Camadas sonoras para entrar em foco.", icon: Waves },
  { id: "breathing-reset" as const, title: "Reset respiratório", status: "ATIVO", desc: "Protocolo guiado para voltar ao eixo.", icon: RotateCcw },
  { id: "quick-diary" as const, title: "Diário rápido", status: "ATIVO", desc: "Captura de notas e foco do dia.", icon: BookOpen },
  { id: "countdown" as const, title: "Cronômetro reverso", status: "ATIVO", desc: "Contagem regressiva para deadlines.", icon: Hourglass },
] as const;

// Future tools render as elegant ghost slots so the grid stays balanced
// and the system reads as extensible. Add real tools to `apps` above.
const upcomingTools: readonly { title: string; desc: string }[] = [] as const;

const breathCopy: Record<BreathPhase, { label: string; hint: string }> = {
  inhale: { label: "Inspirar", hint: "Puxe o ar com ritmo e presença." },
  hold: { label: "Segurar", hint: "Mantenha o corpo estável por alguns segundos." },
  exhale: { label: "Expirar", hint: "Solte o ar de forma longa e controlada." },
  reset: { label: "Reset", hint: "Fique neutro antes do próximo ciclo." },
};

const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fmt = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
const skey = (scope: string, userId: string) => `praxis-tools-${scope}:${userId}`;
const focusPreset = (id: string) => focusPresets.find((p) => p.id === id) ?? focusPresets[0];
const noisePreset = (id: string) => noisePresets.find((p) => p.id === id) ?? noisePresets[0];
const breathPreset = (id: string) => breathPresets.find((p) => p.id === id) ?? breathPresets[0];
const breathPhases = (preset: BreathPreset) =>
  (["inhale", "hold", "exhale", "reset"] as BreathPhase[])
    .map((phase) => ({ phase, duration: preset[phase], ...breathCopy[phase] }))
    .filter((phase) => phase.duration > 0);

const defaultFocus = (presetId = focusPresets[0].id): FocusState => {
  const preset = focusPreset(presetId);
  return { presetId: preset.id, focus: preset.focus, pause: preset.pause, mode: "focus", remaining: preset.focus * 60, running: false, sessions: 0, minutes: 0, day: todayKey() };
};
const defaultNoise = (): NoiseState => ({ presetId: noisePresets[0].id, volume: 62, playing: false });
const defaultBreath = (presetId = breathPresets[0].id): BreathState => {
  const preset = breathPreset(presetId);
  return { presetId: preset.id, phase: "inhale", remaining: preset.inhale, running: false, cycles: 0, minutes: 0 };
};

const normalizeFocus = (raw: unknown): FocusState => {
  if (!raw || typeof raw !== "object") return defaultFocus();
  const value = raw as Partial<FocusState>;
  const preset = focusPreset(value.presetId ?? focusPresets[0].id);
  const focus = Math.max(1, Number(value.focus ?? preset.focus));
  const pause = Math.max(1, Number(value.pause ?? preset.pause));
  const mode: TimerMode = value.mode === "break" ? "break" : "focus";
  return {
    presetId: preset.id,
    focus,
    pause,
    mode,
    remaining: typeof value.remaining === "number" && Number.isFinite(value.remaining) ? Math.max(0, Math.round(value.remaining)) : (mode === "focus" ? focus : pause) * 60,
    running: Boolean(value.running),
    startedAt: typeof value.startedAt === "number" && Number.isFinite(value.startedAt) ? value.startedAt : undefined,
    sessions: Math.max(0, Math.round(value.sessions ?? 0)),
    minutes: Math.max(0, Math.round(value.minutes ?? 0)),
    day: typeof value.day === "string" && value.day ? value.day : todayKey(),
  };
};
const refreshFocusDay = (state: FocusState, day: string): FocusState =>
  state.day === day ? state : { ...state, sessions: 0, minutes: 0, day };
const restoreFocus = (userId: string, day: string): FocusState => {
  if (typeof window === "undefined") return defaultFocus();
  const raw = window.localStorage.getItem(skey("focus-timer", userId));
  const base = raw ? (() => { try { return normalizeFocus(JSON.parse(raw)); } catch { return defaultFocus(); } })() : defaultFocus();
  const next = refreshFocusDay(base, day);
  if (!next.running || !next.startedAt) return next;
  const remaining = next.remaining - Math.floor((Date.now() - next.startedAt) / 1000);
  if (remaining > 0) return { ...next, remaining, startedAt: Date.now() };
  return next.mode === "focus"
    ? { ...next, mode: "break" as TimerMode, remaining: next.pause * 60, running: false, startedAt: undefined, sessions: next.sessions + 1, minutes: next.minutes + next.focus }
    : { ...next, mode: "focus" as TimerMode, remaining: next.focus * 60, running: false, startedAt: undefined };
};

/* ── Quick diary ────────────────────────────────────────────────── */

type DiaryTag = "execucao" | "trava" | "insight" | "livre";
type DiaryEntry = { id: string; createdAt: string; content: string; tag: DiaryTag };
type QuickDiaryState = { entries: DiaryEntry[]; draft: string; activeTag: DiaryTag };

const diaryTagPresets: { id: DiaryTag; label: string; desc: string }[] = [
  { id: "execucao", label: "Execução", desc: "O que saiu do papel hoje." },
  { id: "trava", label: "Trava", desc: "O que travou e precisa atenção." },
  { id: "insight", label: "Insight", desc: "Aprendizado ou ideia para reaproveitar." },
  { id: "livre", label: "Livre", desc: "Captura sem tag específica." },
];
const diaryTagLabel = (tag: DiaryTag) =>
  diaryTagPresets.find((preset) => preset.id === tag)?.label ?? "Livre";

const defaultDiary = (): QuickDiaryState => ({ entries: [], draft: "", activeTag: "execucao" });

const normalizeDiary = (raw: unknown): QuickDiaryState => {
  if (!raw || typeof raw !== "object") return defaultDiary();
  const value = raw as Partial<QuickDiaryState>;
  const entries = Array.isArray(value.entries) ? value.entries : [];
  const safeEntries: DiaryEntry[] = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Partial<DiaryEntry>;
      const tag: DiaryTag =
        candidate.tag === "trava" || candidate.tag === "insight" || candidate.tag === "livre"
          ? candidate.tag
          : "execucao";
      return {
        id: typeof candidate.id === "string" && candidate.id ? candidate.id : `diary-${Math.random().toString(36).slice(2, 10)}`,
        createdAt:
          typeof candidate.createdAt === "string" && candidate.createdAt
            ? candidate.createdAt
            : new Date().toISOString(),
        content: typeof candidate.content === "string" ? candidate.content.trim() : "",
        tag,
      };
    })
    .filter((entry): entry is DiaryEntry => Boolean(entry && entry.content));
  return {
    entries: safeEntries,
    draft: typeof value.draft === "string" ? value.draft : "",
    activeTag:
      value.activeTag === "trava" || value.activeTag === "insight" || value.activeTag === "livre"
        ? value.activeTag
        : "execucao",
  };
};

/* ── Countdown ──────────────────────────────────────────────────── */

type CountdownItem = { id: string; label: string; targetAt: string; createdAt: string };
type CountdownState = { items: CountdownItem[]; draftLabel: string; draftTarget: string };

const defaultCountdown = (): CountdownState => ({ items: [], draftLabel: "", draftTarget: "" });

const normalizeCountdown = (raw: unknown): CountdownState => {
  if (!raw || typeof raw !== "object") return defaultCountdown();
  const value = raw as Partial<CountdownState>;
  const items = Array.isArray(value.items) ? value.items : [];
  const safeItems: CountdownItem[] = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<CountdownItem>;
      if (typeof candidate.targetAt !== "string" || !candidate.targetAt) return null;
      const targetDate = new Date(candidate.targetAt);
      if (Number.isNaN(targetDate.getTime())) return null;
      return {
        id: typeof candidate.id === "string" && candidate.id ? candidate.id : `cd-${Math.random().toString(36).slice(2, 10)}`,
        label:
          typeof candidate.label === "string" && candidate.label.trim()
            ? candidate.label.trim().slice(0, 80)
            : "Deadline sem nome",
        targetAt: targetDate.toISOString(),
        createdAt:
          typeof candidate.createdAt === "string" && candidate.createdAt
            ? candidate.createdAt
            : new Date().toISOString(),
      };
    })
    .filter((item): item is CountdownItem => Boolean(item));
  return {
    items: safeItems,
    draftLabel: typeof value.draftLabel === "string" ? value.draftLabel : "",
    draftTarget: typeof value.draftTarget === "string" ? value.draftTarget : "",
  };
};

// Returns a tuple of {days, hours, minutes, seconds, totalSeconds}.
// totalSeconds is signed — negative when the deadline has passed.
const splitDuration = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const abs = Math.abs(total);
  return {
    days: Math.floor(abs / 86400),
    hours: Math.floor((abs % 86400) / 3600),
    minutes: Math.floor((abs % 3600) / 60),
    seconds: abs % 60,
    totalSeconds: total,
  };
};

const formatCountdownClock = (ms: number) => {
  const parts = splitDuration(ms);
  const hh = String(parts.hours).padStart(2, "0");
  const mm = String(parts.minutes).padStart(2, "0");
  const ss = String(parts.seconds).padStart(2, "0");
  return parts.days > 0 ? `${parts.days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
};

const formatTargetForInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/* ── Shared design-system style fragments ─────────────────────── */

const microLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: 10,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--fg-3)",
};

const heroBtnPrimary: React.CSSProperties = {
  height: 52,
  minWidth: 220,
  fontSize: 13,
  letterSpacing: "0.08em",
};

const heroBtnGhost: React.CSSProperties = {
  height: 46,
  fontSize: 12,
};

function PresetRow({
  active,
  label,
  desc,
  trailing,
  onClick,
}: {
  active: boolean;
  label: string;
  desc: string;
  trailing?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: 14,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "border-color 120ms ease, background 120ms ease",
        border: `1px solid ${active ? "rgba(251,146,60,0.45)" : "var(--line)"}`,
        background: active ? "rgba(251,146,60,0.08)" : "rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p
            className="rx-display"
            style={{ fontSize: 15, fontWeight: 600, color: active ? "var(--accent)" : "var(--fg)", letterSpacing: "-0.01em" }}
          >
            {label}
          </p>
          <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: "var(--fg-3)" }}>{desc}</p>
        </div>
        {trailing ? (
          <span className="rx-mono" style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--accent)" : "var(--fg-3)", whiteSpace: "nowrap" }}>
            {trailing}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function SidePanel({ Icon, label, children }: { Icon: typeof Clock3; label: string; children: React.ReactNode }) {
  return (
    <section className="rx-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
        <p style={microLabel}>{label}</p>
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

export default function ToolsPage() {
  const { state: appState, actions } = useAppStore();
  const state = appState;
  const [activeAppId, setActiveAppId] = useState<ToolAppId>("focus-timer");
  const [toast, setToast] = useState("");
  const [focusState, setFocusState] = useState<FocusState>(() => defaultFocus());
  const [noiseState, setNoiseState] = useState<NoiseState>(() => defaultNoise());
  const [breathState, setBreathState] = useState<BreathState>(() => defaultBreath());
  const [diaryState, setDiaryState] = useState<QuickDiaryState>(() => defaultDiary());
  const [countdownState, setCountdownState] = useState<CountdownState>(() => defaultCountdown());
  // Countdown clock ticks once per second via this counter, which forces
  // a re-render so the displayed remaining time stays current. We only
  // bother running the interval while the user is looking at the
  // countdown tool — for the other tools it would be a wasted timer.
  const [countdownTick, setCountdownTick] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);

  const userId = state.session.userId || state.session.email || "guest";
  const day = todayKey();
  const focus = useMemo(() => refreshFocusDay(focusState, day), [day, focusState]);
  const focusActivePreset = focus.presetId === "custom" ? null : focusPreset(focus.presetId);
  const focusPhaseMinutes = focus.mode === "focus" ? focus.focus : focus.pause;
  const focusProgress = focusPhaseMinutes > 0 ? 1 - focus.remaining / (focusPhaseMinutes * 60) : 0;
  const focusXp = Math.max(40, focus.sessions * 40);
  const sound = useMemo(() => noisePreset(noiseState.presetId), [noiseState.presetId]);
  const breath = useMemo(() => breathPreset(breathState.presetId), [breathState.presetId]);
  const phases = useMemo(() => breathPhases(breath), [breath]);
  const activePhase = phases.find((phase) => phase.phase === breathState.phase) ?? phases[0];
  const cycleSeconds = phases.reduce((total, phase) => total + phase.duration, 0);
  const phaseProgress = activePhase ? 1 - breathState.remaining / activePhase.duration : 0;
  const orbScale = activePhase?.phase === "inhale" ? 0.92 + phaseProgress * 0.26 : activePhase?.phase === "hold" ? 1.18 : activePhase?.phase === "exhale" ? 1.18 - phaseProgress * 0.3 : 0.94 + (1 - phaseProgress) * 0.08;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFocusState(restoreFocus(userId, day)));
    return () => window.cancelAnimationFrame(frame);
  }, [day, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(skey("focus-timer", userId), JSON.stringify(focus));
  }, [focus, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawNoise = window.localStorage.getItem(skey("white-noise", userId));
    const rawBreath = window.localStorage.getItem(skey("breathing-reset", userId));
    const frame = window.requestAnimationFrame(() => {
      if (rawNoise) { try { const parsed = JSON.parse(rawNoise) as Partial<NoiseState>; setNoiseState({ presetId: noisePreset(parsed.presetId ?? noisePresets[0].id).id, volume: Math.min(100, Math.max(0, Math.round(Number(parsed.volume ?? 62) || 62))), playing: Boolean(parsed.playing) }); } catch { setNoiseState(defaultNoise()); } }
      if (rawBreath) { try { const parsed = JSON.parse(rawBreath) as Partial<BreathState>; const preset = breathPreset(parsed.presetId ?? breathPresets[0].id); const phase = parsed.phase === "hold" || parsed.phase === "exhale" || parsed.phase === "reset" ? parsed.phase : "inhale"; setBreathState({ presetId: preset.id, phase, remaining: typeof parsed.remaining === "number" && Number.isFinite(parsed.remaining) ? Math.max(1, Math.round(parsed.remaining)) : preset[phase], running: Boolean(parsed.running), cycles: Math.max(0, Math.round(parsed.cycles ?? 0)), minutes: Math.max(0, Math.round(parsed.minutes ?? 0)) }); } catch { setBreathState(defaultBreath()); } }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [userId]);

  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem(skey("white-noise", userId), JSON.stringify(noiseState)); }, [noiseState, userId]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem(skey("breathing-reset", userId), JSON.stringify(breathState)); }, [breathState, userId]);

  // Quick-diary + countdown now live in the central KV-backed bucket
  // (state.moduleState) so they sync across devices. The userId scope
  // is preserved inside the module key. First load migrates from the
  // legacy localStorage key once, then clears it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const diaryKey = `quick-diary-${userId}`;
    const countdownKey = `countdown-${userId}`;
    const storeDiary = appState.moduleState?.[diaryKey];
    const storeCountdown = appState.moduleState?.[countdownKey];

    if (storeDiary) {
      try { setDiaryState(normalizeDiary(storeDiary)); } catch {}
    } else {
      const rawDiary = window.localStorage.getItem(skey("quick-diary", userId));
      if (rawDiary) {
        try {
          const parsed = normalizeDiary(JSON.parse(rawDiary));
          setDiaryState(parsed);
          actions.setModuleState(diaryKey, parsed);
        } catch {}
      }
    }
    if (storeCountdown) {
      try { setCountdownState(normalizeCountdown(storeCountdown)); } catch {}
    } else {
      const rawCountdown = window.localStorage.getItem(skey("countdown", userId));
      if (rawCountdown) {
        try {
          const parsed = normalizeCountdown(JSON.parse(rawCountdown));
          setCountdownState(parsed);
          actions.setModuleState(countdownKey, parsed);
        } catch {}
      }
    }
    try {
      window.localStorage.removeItem(skey("quick-diary", userId));
      window.localStorage.removeItem(skey("countdown", userId));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    actions.setModuleState(`quick-diary-${userId}`, diaryState);
  }, [actions, diaryState, userId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    actions.setModuleState(`countdown-${userId}`, countdownState);
  }, [actions, countdownState, userId]);

  useEffect(() => {
    if (activeAppId !== "countdown") return;
    const interval = window.setInterval(() => setCountdownTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, [activeAppId]);

  useEffect(() => {
    if (!focus.running) return;
    const interval = window.setInterval(() => {
      setFocusState((current) => {
        const fresh = refreshFocusDay(current, todayKey());
        if (!fresh.running) return fresh;
        if (fresh.remaining <= 1) {
          if (fresh.mode === "focus") {
            setToast("Sessão de foco concluída. Pausa pronta para iniciar.");
            return { ...fresh, mode: "break", remaining: fresh.pause * 60, running: false, startedAt: undefined, sessions: fresh.sessions + 1, minutes: fresh.minutes + fresh.focus };
          }
          setToast("Pausa concluída. Próxima sessão pronta.");
          return { ...fresh, mode: "focus", remaining: fresh.focus * 60, running: false, startedAt: undefined };
        }
        return { ...fresh, remaining: fresh.remaining - 1, startedAt: Date.now() };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focus.running]);

  useEffect(() => {
    if (!breathState.running) return;
    const interval = window.setInterval(() => {
      setBreathState((current) => {
        if (current.remaining > 1) return { ...current, remaining: current.remaining - 1 };
        const currentPreset = breathPreset(current.presetId);
        const currentPhases = breathPhases(currentPreset);
        const index = currentPhases.findIndex((phase) => phase.phase === current.phase);
        const next = currentPhases[index + 1];
        if (!next) {
          setToast("Um ciclo respiratório foi concluído.");
          return { ...current, phase: currentPhases[0].phase, remaining: currentPhases[0].duration, cycles: current.cycles + 1, minutes: current.minutes + Math.max(1, Math.round(cycleSeconds / 60)) };
        }
        return { ...current, phase: next.phase, remaining: next.duration };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [breathState.running, cycleSeconds]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const stopNoise = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {}
    sourceRef.current?.disconnect();
    filterRef.current?.disconnect();
    gainRef.current?.disconnect();
    sourceRef.current = null;
    filterRef.current = null;
    gainRef.current = null;
  }, []);

  const ensureNoiseContext = useCallback(async () => {
    if (!ctxRef.current) ctxRef.current = new window.AudioContext();
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    if (!bufferRef.current) {
      const context = ctxRef.current;
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      bufferRef.current = buffer;
    }
    return ctxRef.current;
  }, []);

  useEffect(() => {
    if (!noiseState.playing) {
      stopNoise();
      return;
    }
    let cancelled = false;
    const start = async () => {
      const context = await ensureNoiseContext();
      if (cancelled) return;
      stopNoise();
      const preset = noisePreset(noiseState.presetId);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = bufferRef.current;
      source.loop = true;
      source.playbackRate.value = preset.rate ?? 1;
      filter.type = preset.type;
      filter.frequency.value = preset.freq;
      filter.Q.value = preset.q ?? 0.7;
      gain.gain.value = Math.max(0.02, noiseState.volume / 100);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
      sourceRef.current = source;
      filterRef.current = filter;
      gainRef.current = gain;
    };
    void start();
    return () => {
      cancelled = true;
      stopNoise();
    };
  }, [ensureNoiseContext, noiseState.playing, noiseState.presetId, noiseState.volume, stopNoise]);

  useEffect(() => () => { stopNoise(); void ctxRef.current?.close(); }, [stopNoise]);

  const setFocusPreset = (presetId: string) => {
    const preset = focusPreset(presetId);
    setFocusState((current) => ({ ...refreshFocusDay(current, day), presetId: preset.id, focus: preset.focus, pause: preset.pause, mode: "focus", remaining: preset.focus * 60, running: false, startedAt: undefined }));
  };
  const toggleFocus = () =>
    setFocusState((current) => {
      const fresh = refreshFocusDay(current, day);
      return fresh.running ? { ...fresh, running: false, startedAt: undefined } : { ...fresh, running: true, startedAt: Date.now() };
    });
  const resetFocus = () => {
    setFocusState((current) => {
      const fresh = refreshFocusDay(current, day);
      const duration = fresh.mode === "focus" ? fresh.focus : fresh.pause;
      return { ...fresh, remaining: duration * 60, running: false, startedAt: undefined };
    });
    setToast("Bloco reiniciado.");
  };
  const skipFocus = () => {
    setFocusState((current) => {
      const fresh = refreshFocusDay(current, day);
      return fresh.mode === "focus" ? { ...fresh, mode: "break", remaining: fresh.pause * 60, running: false, startedAt: undefined } : { ...fresh, mode: "focus", remaining: fresh.focus * 60, running: false, startedAt: undefined };
    });
    setToast(focus.mode === "focus" ? "Pulou para a pausa." : "Voltou para uma nova sessão de foco.");
  };
  const setFocusMinutes = (value: string) => {
    const num = Math.max(1, Number(value) || 1);
    setFocusState((current) => {
      const fresh = refreshFocusDay(current, day);
      return { ...fresh, presetId: "custom", focus: num, remaining: fresh.mode === "focus" && !fresh.running ? num * 60 : fresh.remaining };
    });
  };
  const setPauseMinutes = (value: string) => {
    const num = Math.max(1, Number(value) || 1);
    setFocusState((current) => {
      const fresh = refreshFocusDay(current, day);
      return { ...fresh, presetId: "custom", pause: num, remaining: fresh.mode === "break" && !fresh.running ? num * 60 : fresh.remaining };
    });
  };
  const toggleNoise = async () => {
    if (!noiseState.playing) {
      await ensureNoiseContext();
      setToast("Camada sonora ligada.");
    }
    setNoiseState((current) => ({ ...current, playing: !current.playing }));
  };
  const silenceNoise = () => {
    setNoiseState((current) => ({ ...current, playing: false }));
    setToast("Camada sonora pausada.");
  };
  const setBreathPreset = (presetId: string) => {
    const preset = breathPreset(presetId);
    setBreathState({ presetId: preset.id, phase: "inhale", remaining: preset.inhale, running: false, cycles: 0, minutes: 0 });
  };
  const toggleBreath = () => setBreathState((current) => ({ ...current, running: !current.running }));
  const resetBreath = () => {
    const preset = breathPreset(breathState.presetId);
    setBreathState((current) => ({ ...current, phase: "inhale", remaining: preset.inhale, running: false }));
    setToast("Protocolo respiratório reiniciado.");
  };
  const skipBreath = () => {
    setBreathState((current) => {
      const currentPhases = breathPhases(breathPreset(current.presetId));
      const index = currentPhases.findIndex((phase) => phase.phase === current.phase);
      const next = currentPhases[index + 1] ?? currentPhases[0];
      return { ...current, phase: next.phase, remaining: next.duration, running: false };
    });
    setToast("Fase respiratória ajustada.");
  };

  const setDiaryDraft = (value: string) =>
    setDiaryState((current) => ({ ...current, draft: value }));
  const setDiaryTag = (tag: DiaryTag) =>
    setDiaryState((current) => ({ ...current, activeTag: tag }));
  const saveDiaryEntry = () => {
    setDiaryState((current) => {
      const trimmed = current.draft.trim();
      if (!trimmed) return current;
      const entry: DiaryEntry = {
        id: `diary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        content: trimmed,
        tag: current.activeTag,
      };
      return { ...current, draft: "", entries: [entry, ...current.entries].slice(0, 200) };
    });
    setToast("Nota registrada no diário.");
  };
  const removeDiaryEntry = (id: string) => {
    setDiaryState((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }));
    setToast("Entrada removida do diário.");
  };

  const setCountdownDraftLabel = (value: string) =>
    setCountdownState((current) => ({ ...current, draftLabel: value }));
  const setCountdownDraftTarget = (value: string) =>
    setCountdownState((current) => ({ ...current, draftTarget: value }));
  const addCountdown = () => {
    setCountdownState((current) => {
      const trimmedLabel = current.draftLabel.trim();
      if (!current.draftTarget) {
        setToast("Escolha uma data e hora para o deadline.");
        return current;
      }
      const target = new Date(current.draftTarget);
      if (Number.isNaN(target.getTime())) {
        setToast("Data inválida — confira o campo.");
        return current;
      }
      const item: CountdownItem = {
        id: `cd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: trimmedLabel || "Deadline sem nome",
        targetAt: target.toISOString(),
        createdAt: new Date().toISOString(),
      };
      setToast("Deadline adicionado.");
      // Sort by soonest-first so the top card is always the most urgent
      // — independent of when the user added it to the list.
      return {
        items: [...current.items, item].sort(
          (a, b) => new Date(a.targetAt).getTime() - new Date(b.targetAt).getTime(),
        ),
        draftLabel: "",
        draftTarget: "",
      };
    });
  };
  const removeCountdown = (id: string) => {
    setCountdownState((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setToast("Deadline removido.");
  };

  const activeApp = apps.find((a) => a.id === activeAppId) ?? apps[0];

  // Derived: the soonest deadline drives the hero countdown card. `_tick`
  // is here only to make this memo recompute every second while the
  // countdown view is open — see the interval above.
  const { primaryCountdown, primaryRemainingMs } = useMemo(() => {
    void countdownTick;
    const sorted = [...countdownState.items].sort(
      (a, b) => new Date(a.targetAt).getTime() - new Date(b.targetAt).getTime(),
    );
    // Prefer the next still-future deadline. If everything is overdue,
    // surface the most recently-passed one so the user can see it and
    // dismiss it.
    const upcoming = sorted.find((item) => new Date(item.targetAt).getTime() > Date.now());
    const primary = upcoming ?? sorted[sorted.length - 1] ?? null;
    const remaining = primary ? new Date(primary.targetAt).getTime() - Date.now() : 0;
    return { primaryCountdown: primary, primaryRemainingMs: remaining };
  }, [countdownState.items, countdownTick]);

  const main = () => {
    if (activeAppId === "white-noise") {
      return (
        <>
          <section className="rx-panel-hot" style={{ padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <p style={microLabel}>Paisagem sonora ativa</p>
              <span className="rx-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent)" }}>
                {noiseState.playing ? "Tocando" : "Pronto"}
              </span>
            </div>
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <p className="rx-display" style={{ fontSize: "clamp(2.4rem, 6vw, 3.4rem)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--accent)" }}>
                {sound.label}
              </p>
              <p style={{ margin: "14px auto 0", maxWidth: 460, fontSize: 14, lineHeight: 1.7, color: "var(--fg-3)" }}>{sound.desc}</p>
              <div style={{ marginTop: 28, display: "flex", minHeight: 96, alignItems: "flex-end", justifyContent: "center", gap: 8 }}>
                {Array.from({ length: 14 }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 6,
                      borderRadius: 999,
                      transition: "all 700ms ease",
                      height: noiseState.playing ? `${20 + ((i * 17) % 52)}px` : "14px",
                      background: "var(--accent)",
                      opacity: noiseState.playing ? 0.4 + ((i % 5) * 0.1) : 0.16,
                      boxShadow: noiseState.playing ? "0 0 16px var(--accent-glow)" : "none",
                    }}
                  />
                ))}
              </div>
              <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => void toggleNoise()} className="rx-btn-primary" style={heroBtnPrimary}>
                  {noiseState.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {noiseState.playing ? "Pausar camada" : "Iniciar camada"}
                </button>
                <button type="button" onClick={silenceNoise} className="rx-btn-ghost" style={{ ...heroBtnGhost, minWidth: 220 }}>
                  <RotateCcw className="h-4 w-4" />
                  Silenciar
                </button>
              </div>
            </div>
          </section>
          <section className="rx-panel" style={{ padding: 22 }}>
            <p className="rx-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>
              Sustente o ambiente certo
            </p>
            <p style={{ marginTop: 8, maxWidth: 560, fontSize: 13, lineHeight: 1.7, color: "var(--fg-3)" }}>
              O objetivo aqui é reduzir ruído mental, não distrair com música. Você liga, escolhe a textura e deixa o ambiente trabalhar por você.
            </p>
            <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
              <MiniStat label="Preset" value={sound.label} />
              <MiniStat label="Volume" value={`${noiseState.volume}%`} />
              <MiniStat label="Camada" value={noiseState.playing ? "Ativa" : "Pronta"} />
            </div>
          </section>
        </>
      );
    }
    if (activeAppId === "quick-diary") {
      const todayEntries = diaryState.entries.filter((entry) =>
        entry.createdAt.startsWith(todayKey()),
      );
      return (
        <>
          <section className="rx-panel-hot" style={{ padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <p style={microLabel}>Diário rápido</p>
              <span className="rx-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent)" }}>
                {todayEntries.length} hoje
              </span>
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {diaryTagPresets.map((preset) => {
                  const active = preset.id === diaryState.activeTag;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDiaryTag(preset.id)}
                      className={active ? "rx-btn-primary" : "rx-btn-ghost"}
                      style={{ height: 36, padding: "0 14px", fontSize: 12, letterSpacing: "0.06em" }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={diaryState.draft}
                onChange={(event) => setDiaryDraft(event.target.value)}
                placeholder={`Captura como "${diaryTagLabel(diaryState.activeTag)}"... pode ser curto.`}
                rows={4}
                style={{
                  marginTop: 14,
                  width: "100%",
                  resize: "vertical",
                  minHeight: 96,
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "rgba(0,0,0,0.3)",
                  padding: "12px 14px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--fg)",
                  outline: "none",
                }}
              />
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={saveDiaryEntry}
                  className="rx-btn-primary"
                  style={heroBtnPrimary}
                  disabled={!diaryState.draft.trim()}
                >
                  <Save className="h-4 w-4" />
                  Salvar entrada
                </button>
                <button
                  type="button"
                  onClick={() => setDiaryDraft("")}
                  className="rx-btn-ghost"
                  style={{ ...heroBtnGhost, minWidth: 180 }}
                  disabled={!diaryState.draft}
                >
                  <RotateCcw className="h-4 w-4" />
                  Limpar rascunho
                </button>
              </div>
            </div>
          </section>
          <section className="rx-panel" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <p className="rx-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>
                Últimas capturas
              </p>
              <span className="rx-mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                {diaryState.entries.length} no total
              </span>
            </div>
            {diaryState.entries.length === 0 ? (
              <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.7, color: "var(--fg-3)" }}>
                Nada registrado ainda. Use o campo acima para capturar execuções, travas e insights do dia. Tudo fica salvo no seu navegador.
              </p>
            ) : (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {diaryState.entries.slice(0, 8).map((entry) => {
                  const when = new Date(entry.createdAt);
                  const stamp = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: "1px solid var(--line)",
                        background: "rgba(0,0,0,0.28)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span className="rx-mono" style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)" }}>
                          {diaryTagLabel(entry.tag)} · {stamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDiaryEntry(entry.id)}
                          className="rx-btn-ghost"
                          style={{ height: 28, padding: "0 10px", fontSize: 11 }}
                          aria-label="Remover entrada"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: "var(--fg)", whiteSpace: "pre-wrap" }}>
                        {entry.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      );
    }
    if (activeAppId === "countdown") {
      const isOverdue = primaryRemainingMs < 0;
      return (
        <>
          <section className="rx-panel-hot" style={{ padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <p style={microLabel}>Cronômetro reverso</p>
              <span className="rx-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: isOverdue ? "#f87171" : "var(--accent)" }}>
                {primaryCountdown ? (isOverdue ? "Vencido" : "Ativo") : "Sem deadline"}
              </span>
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              {primaryCountdown ? (
                <>
                  <p className="rx-display" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)" }}>
                    {primaryCountdown.label}
                  </p>
                  <div
                    className="rx-display"
                    style={{
                      marginTop: 14,
                      fontSize: "clamp(3.4rem, 11vw, 5.6rem)",
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                      color: isOverdue ? "#f87171" : "var(--accent)",
                      textShadow: isOverdue ? "0 0 32px rgba(248,113,113,0.5)" : "0 0 32px var(--accent-glow)",
                    }}
                  >
                    {formatCountdownClock(primaryRemainingMs)}
                  </div>
                  <p style={{ marginTop: 14, fontSize: 12, color: "var(--fg-3)" }}>
                    Alvo: {new Date(primaryCountdown.targetAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {isOverdue ? " (vencido)" : ""}
                  </p>
                </>
              ) : (
                <p style={{ marginTop: 8, maxWidth: 440, fontSize: 14, lineHeight: 1.7, color: "var(--fg-3)" }}>
                  Sem deadlines cadastrados. Use o painel ao lado para criar a primeira contagem regressiva — entrega de projeto, prova, evento, lançamento.
                </p>
              )}
            </div>
          </section>
          <section className="rx-panel" style={{ padding: 22 }}>
            <p className="rx-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>
              Deadlines ativos
            </p>
            {countdownState.items.length === 0 ? (
              <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "var(--fg-3)" }}>
                Nada na fila. Adicione um deadline no painel ao lado.
              </p>
            ) : (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {countdownState.items.map((item) => {
                  const remaining = new Date(item.targetAt).getTime() - Date.now();
                  const overdue = remaining < 0;
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: `1px solid ${overdue ? "rgba(248,113,113,0.45)" : "var(--line)"}`,
                        background: overdue ? "rgba(248,113,113,0.06)" : "rgba(0,0,0,0.28)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <p className="rx-display" style={{ fontSize: 14, fontWeight: 600, color: overdue ? "#f87171" : "var(--fg)" }}>
                            {item.label}
                          </p>
                          <p style={{ marginTop: 4, fontSize: 11, color: "var(--fg-3)" }}>
                            {new Date(item.targetAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            className="rx-mono"
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: overdue ? "#f87171" : "var(--accent)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {overdue ? "-" : ""}{formatCountdownClock(remaining)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCountdown(item.id)}
                            className="rx-btn-ghost"
                            style={{ height: 28, padding: "0 10px", fontSize: 11 }}
                            aria-label="Remover deadline"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      );
    }
    if (activeAppId === "breathing-reset") {
      return (
        <>
          <section className="rx-panel-hot" style={{ padding: "28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <p style={microLabel}>Reset respiratório</p>
              <span className="rx-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent)" }}>
                {breathState.running ? "Guiando" : "Pronto"}
              </span>
            </div>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div
                style={{
                  position: "relative",
                  display: "grid",
                  placeItems: "center",
                  height: 224,
                  width: 224,
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  transition: "transform 700ms ease",
                  transform: `scale(${orbScale})`,
                  boxShadow: "0 0 0 14px rgba(251,146,60,0.08), 0 0 48px var(--accent-glow)",
                  background: "radial-gradient(circle at center, rgba(251,146,60,0.16), rgba(10,10,12,0.96) 68%)",
                }}
              >
                <div>
                  <p className="rx-display" style={{ fontSize: "clamp(1.8rem, 5vw, 2.4rem)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--accent)" }}>
                    {activePhase?.label ?? "Inspirar"}
                  </p>
                  <p className="rx-display" style={{ fontSize: 52, fontWeight: 600, color: "var(--fg)" }}>
                    {String(breathState.remaining).padStart(2, "0")}
                  </p>
                </div>
              </div>
              <p style={{ marginTop: 28, maxWidth: 440, fontSize: 14, lineHeight: 1.7, color: "var(--fg-3)" }}>
                {activePhase?.hint ?? "Puxe o ar com ritmo e presença."}
              </p>
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={toggleBreath} className="rx-btn-primary" style={heroBtnPrimary}>
                  {breathState.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {breathState.running ? "Pausar guia" : "Iniciar protocolo"}
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={resetBreath} className="rx-btn-ghost" style={heroBtnGhost}>
                    <RotateCcw className="h-4 w-4" />
                    Reiniciar
                  </button>
                  <button type="button" onClick={skipBreath} className="rx-btn-ghost" style={heroBtnGhost}>
                    <SkipForward className="h-4 w-4" />
                    Próxima fase
                  </button>
                </div>
              </div>
            </div>
          </section>
          <section className="rx-panel" style={{ padding: 22 }}>
            <p className="rx-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>
              Volte ao eixo sem drama
            </p>
            <p style={{ marginTop: 8, maxWidth: 560, fontSize: 13, lineHeight: 1.7, color: "var(--fg-3)" }}>
              Quando o cérebro acelera demais, o objetivo não é performar. É baixar o ruído fisiológico e retomar com mais clareza.
            </p>
            <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
              <MiniStat label="Ciclos" value={String(breathState.cycles)} />
              <MiniStat label="Min guiados" value={String(breathState.minutes)} />
              <MiniStat label="Por ciclo" value={`${cycleSeconds}s`} />
            </div>
          </section>
        </>
      );
    }
    return (
      <>
        <section className="rx-panel-hot" style={{ padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <p style={microLabel}>{focus.mode === "focus" ? "Bloco de foco do dia" : "Bloco de pausa"}</p>
            <span className="rx-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent)" }}>
              {focus.running ? (focus.mode === "focus" ? "Em foco" : "Em pausa") : "Pronto"}
            </span>
          </div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div className="rx-display" style={{ fontSize: "clamp(4rem, 13vw, 7rem)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", color: "var(--accent)", textShadow: "0 0 32px var(--accent-glow)" }}>
              {fmt(focus.remaining)}
            </div>
            <div style={{ marginTop: 24, width: "100%", maxWidth: 280 }}>
              <RxPBar value={Math.min(100, Math.max(0, focusProgress * 100))} />
            </div>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <button type="button" onClick={toggleFocus} className="rx-btn-primary" style={heroBtnPrimary}>
                {focus.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {focus.running ? "Pausar" : focus.mode === "focus" ? "Iniciar foco" : "Iniciar pausa"}
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={resetFocus} className="rx-btn-ghost" style={heroBtnGhost}>
                  <RotateCcw className="h-4 w-4" />
                  Reiniciar
                </button>
                <button type="button" onClick={skipFocus} className="rx-btn-ghost" style={heroBtnGhost}>
                  <SkipForward className="h-4 w-4" />
                  {focus.mode === "focus" ? "Nova pausa" : "Novo foco"}
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="rx-panel" style={{ padding: 22 }}>
          <p className="rx-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>
            Potencialize sua execução
          </p>
          <p style={{ marginTop: 8, maxWidth: 560, fontSize: 13, lineHeight: 1.7, color: "var(--fg-3)" }}>
            Cada ciclo concluído reforça ritmo, reduz atrito na retomada e mantém o dia em protocolo.
          </p>
          <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            <MiniStat label="Sessões hoje" value={String(focus.sessions)} />
            <MiniStat label="Min focados" value={String(focus.minutes)} />
            <MiniStat label="XP por ritmo" value={`+${focusXp}`} />
          </div>
        </section>
      </>
    );
  };

  const side = () => {
    if (activeAppId === "white-noise") {
      return (
        <>
          <SidePanel Icon={Clock3} label="Configuração rápida">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={microLabel}>Volume</span>
              <span className="rx-display" style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>{noiseState.volume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={noiseState.volume}
              onChange={(event) => setNoiseState((current) => ({ ...current, volume: Number(event.target.value) }))}
              style={{ marginTop: 14, width: "100%", accentColor: "var(--accent)" }}
            />
          </SidePanel>
          <SidePanel Icon={Waves} label="Perfis sonoros">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {noisePresets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  active={noiseState.presetId === preset.id}
                  label={preset.label}
                  desc={preset.desc}
                  onClick={() => setNoiseState((current) => ({ ...current, presetId: preset.id }))}
                />
              ))}
            </div>
          </SidePanel>
        </>
      );
    }
    if (activeAppId === "quick-diary") {
      const recentEntries = diaryState.entries.slice(0, 3);
      return (
        <>
          <SidePanel Icon={PenSquare} label="Tipo de captura">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {diaryTagPresets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  active={diaryState.activeTag === preset.id}
                  label={preset.label}
                  desc={preset.desc}
                  onClick={() => setDiaryTag(preset.id)}
                />
              ))}
            </div>
          </SidePanel>
          <SidePanel Icon={BookOpen} label="Resumo">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <MiniStat
                label="Hoje"
                value={String(
                  diaryState.entries.filter((entry) => entry.createdAt.startsWith(todayKey())).length,
                )}
              />
              <MiniStat label="Total" value={String(diaryState.entries.length)} />
            </div>
            {recentEntries.length > 0 ? (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={microLabel}>Últimas 3</p>
                {recentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      background: "rgba(0,0,0,0.24)",
                    }}
                  >
                    <p className="rx-mono" style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)" }}>
                      {diaryTagLabel(entry.tag)}
                    </p>
                    <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4, color: "var(--fg-3)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {entry.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </SidePanel>
        </>
      );
    }
    if (activeAppId === "countdown") {
      const minTarget = formatTargetForInput(new Date(Date.now() + 60_000));
      return (
        <>
          <SidePanel Icon={Hourglass} label="Novo deadline">
            <label style={{ display: "block" }}>
              <span style={microLabel}>Rótulo</span>
              <input
                type="text"
                value={countdownState.draftLabel}
                onChange={(event) => setCountdownDraftLabel(event.target.value)}
                placeholder="Ex.: Entrega cliente X"
                maxLength={80}
                className="rx-display"
                style={{ marginTop: 8, height: 48, width: "100%", borderRadius: 14, border: "1px solid var(--line)", background: "rgba(0,0,0,0.3)", padding: "0 14px", fontSize: 14, fontWeight: 500, color: "var(--fg)", outline: "none" }}
              />
            </label>
            <label style={{ display: "block", marginTop: 14 }}>
              <span style={microLabel}>Data e hora</span>
              <input
                type="datetime-local"
                value={countdownState.draftTarget}
                min={minTarget}
                onChange={(event) => setCountdownDraftTarget(event.target.value)}
                className="rx-display"
                style={{ marginTop: 8, height: 48, width: "100%", borderRadius: 14, border: "1px solid var(--line)", background: "rgba(0,0,0,0.3)", padding: "0 14px", fontSize: 14, fontWeight: 500, color: "var(--fg)", outline: "none" }}
              />
            </label>
            <button
              type="button"
              onClick={addCountdown}
              className="rx-btn-primary"
              style={{ marginTop: 16, height: 44, width: "100%", fontSize: 12, letterSpacing: "0.08em" }}
              disabled={!countdownState.draftTarget}
            >
              <Plus className="h-4 w-4" />
              Adicionar deadline
            </button>
          </SidePanel>
          <SidePanel Icon={Clock3} label="Resumo">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <MiniStat label="Total" value={String(countdownState.items.length)} />
              <MiniStat
                label="Vencidos"
                value={String(
                  countdownState.items.filter((item) => new Date(item.targetAt).getTime() < Date.now()).length,
                )}
              />
            </div>
            <p style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, color: "var(--fg-3)" }}>
              O cronômetro destaca o próximo deadline ainda em aberto. Vencidos viram chamados em vermelho — bom pra ver o que ficou para trás.
            </p>
          </SidePanel>
        </>
      );
    }
    if (activeAppId === "breathing-reset") {
      return (
        <>
          <SidePanel Icon={Clock3} label="Protocolo ativo">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {phases.map((phase) => {
                const isActive = phase.phase === breathState.phase;
                return (
                  <div
                    key={phase.phase}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: `1px solid ${isActive ? "rgba(251,146,60,0.45)" : "var(--line)"}`,
                      background: isActive ? "rgba(251,146,60,0.08)" : "rgba(0,0,0,0.3)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <p className="rx-display" style={{ fontSize: 14, fontWeight: 600, color: isActive ? "var(--accent)" : "var(--fg)" }}>{phase.label}</p>
                      <span className="rx-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-3)" }}>{phase.duration}s</span>
                    </div>
                    <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: "var(--fg-3)" }}>{phase.hint}</p>
                  </div>
                );
              })}
            </div>
          </SidePanel>
          <SidePanel Icon={RotateCcw} label="Presets respiratórios">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {breathPresets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  active={breathState.presetId === preset.id}
                  label={preset.label}
                  desc={preset.desc}
                  trailing={`${preset.inhale}/${preset.hold}/${preset.exhale}`}
                  onClick={() => setBreathPreset(preset.id)}
                />
              ))}
            </div>
          </SidePanel>
        </>
      );
    }
    return (
      <>
        <SidePanel Icon={Clock3} label="Configuração rápida">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span style={microLabel}>Foco (min)</span>
              <input
                type="number"
                min={1}
                value={focus.focus}
                onChange={(event) => setFocusMinutes(event.target.value)}
                className="rx-display"
                style={{ marginTop: 8, height: 58, width: "100%", borderRadius: 14, border: "1px solid var(--line)", background: "rgba(0,0,0,0.3)", padding: "0 16px", fontSize: 24, fontWeight: 600, color: "var(--fg)", outline: "none" }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={microLabel}>Pausa (min)</span>
              <input
                type="number"
                min={1}
                value={focus.pause}
                onChange={(event) => setPauseMinutes(event.target.value)}
                className="rx-display"
                style={{ marginTop: 8, height: 58, width: "100%", borderRadius: 14, border: "1px solid var(--line)", background: "rgba(0,0,0,0.3)", padding: "0 16px", fontSize: 24, fontWeight: 600, color: "var(--fg)", outline: "none" }}
              />
            </label>
          </div>
        </SidePanel>
        <SidePanel Icon={TimerReset} label="Presets de sessão">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {focusPresets.map((preset) => (
              <PresetRow
                key={preset.id}
                active={focus.presetId === preset.id}
                label={preset.label}
                desc={preset.desc}
                trailing={`${preset.focus}/${preset.pause}`}
                onClick={() => setFocusPreset(preset.id)}
              />
            ))}
          </div>
        </SidePanel>
      </>
    );
  };

  return (
    <div className="space-y-5">
      <section className="glass glass-hot overflow-hidden" style={{ padding: 0 }}>
        <div
          className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-end md:justify-between lg:px-8"
          style={{
            background:
              "radial-gradient(circle at 12% 0%, rgba(251,146,60,0.14), transparent 42%)",
          }}
        >
          <div>
            <div className="page-eyebrow">PRAXIS / UTILITÁRIOS</div>
            <h1 className="page-title-v2">Utilitários</h1>
            <p className="page-description-v2">
              Ferramentas rápidas para foco, ambiente e retomada. Ativo agora:{" "}
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                {activeApp.title}
              </span>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tasks" className="rx-btn-primary">
              Abrir tarefas <ArrowRight className="h-3 w-3" />
            </Link>
            <Link href="/agenda" className="rx-btn-ghost">
              Agenda
            </Link>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))",
        }}
      >
        {apps.map((app) => {
          const active = app.id === activeAppId;
          const Icon = app.icon;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => setActiveAppId(app.id)}
              className={active ? "rx-panel-hot" : "rx-panel"}
              style={{
                minHeight: 168,
                padding: 22,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
                transition: "transform 140ms ease, border-color 140ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <span
                  style={{
                    display: "grid",
                    height: 44,
                    width: 44,
                    flexShrink: 0,
                    placeItems: "center",
                    borderRadius: 14,
                    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    background: active ? "rgba(251,146,60,0.10)" : "rgba(0,0,0,0.3)",
                    color: active ? "var(--accent)" : "var(--fg-3)",
                  }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 9,
                    padding: "4px 9px",
                    borderRadius: 999,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    background: active ? "rgba(251,146,60,0.10)" : "transparent",
                    color: active ? "var(--accent)" : "var(--fg-4)",
                  }}
                >
                  {app.status}
                </span>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 22 }}>
                <p className="rx-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: active ? "var(--accent)" : "var(--fg)" }}>
                  {app.title}
                </p>
                <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "var(--fg-3)" }}>
                  {app.desc}
                </p>
              </div>
            </button>
          );
        })}

        {upcomingTools.map((tool) => (
          <div
            key={tool.title}
            aria-disabled
            style={{
              minHeight: 168,
              padding: 22,
              borderRadius: 20,
              display: "flex",
              flexDirection: "column",
              border: "1px dashed var(--line-bright)",
              background: "rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <span
                style={{
                  display: "grid",
                  height: 44,
                  width: 44,
                  flexShrink: 0,
                  placeItems: "center",
                  borderRadius: 14,
                  border: "1px dashed var(--line-bright)",
                  background: "transparent",
                  color: "var(--fg-4)",
                }}
              >
                <Plus className="h-5 w-5" />
              </span>
              <span
                className="rx-mono"
                style={{
                  fontSize: 9,
                  padding: "4px 9px",
                  borderRadius: 999,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  border: "1px solid var(--line)",
                  color: "var(--fg-4)",
                }}
              >
                EM BREVE
              </span>
            </div>
            <div style={{ marginTop: "auto", paddingTop: 22 }}>
              <p className="rx-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--fg-3)" }}>
                {tool.title}
              </p>
              <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "var(--fg-4)" }}>
                {tool.desc}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 14,
          border: "1px solid var(--line)",
          background: "rgba(0,0,0,0.22)",
        }}
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent)", flexShrink: 0 }} />
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-3)" }}>
          Novas ferramentas entram aqui conforme o protocolo evolui — o painel
          se ajusta automaticamente.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{main()}</div>
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>{side()}</aside>
      </section>

      {toast ? (
        <div
          className="rx-mono"
          style={{
            position: "fixed",
            bottom: "calc(96px + var(--mobile-bottom-nav-space, 0px))",
            right: 16,
            zIndex: 40,
            padding: "10px 14px",
            border: "1px solid var(--accent)",
            background: "rgba(20,20,24,0.96)",
            color: "var(--fg)",
            fontSize: 11,
            letterSpacing: "0.12em",
            borderRadius: 12,
            boxShadow: "0 0 20px var(--accent-glow)",
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
