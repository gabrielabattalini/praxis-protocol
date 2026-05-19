"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  TimerReset,
  Waves,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { MiniStat, RxPBar } from "@/components/redesign/primitives";

type ToolAppId = "focus-timer" | "white-noise" | "breathing-reset";
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
] as const;

// Future tools render as elegant ghost slots so the grid stays balanced
// and the system reads as extensible. Add real tools to `apps` above.
const upcomingTools = [
  { title: "Diário rápido", desc: "Captura de notas e foco do dia." },
  { title: "Cronômetro reverso", desc: "Contagem regressiva para deadlines." },
] as const;

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
  const { state } = useAppStore();
  const [activeAppId, setActiveAppId] = useState<ToolAppId>("focus-timer");
  const [toast, setToast] = useState("");
  const [focusState, setFocusState] = useState<FocusState>(() => defaultFocus());
  const [noiseState, setNoiseState] = useState<NoiseState>(() => defaultNoise());
  const [breathState, setBreathState] = useState<BreathState>(() => defaultBreath());
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

  const activeApp = apps.find((a) => a.id === activeAppId) ?? apps[0];

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
