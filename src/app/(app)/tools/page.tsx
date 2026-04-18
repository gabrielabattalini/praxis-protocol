"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  TimerReset,
  Waves,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";

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

const themes: Record<ToolAppId, { accent: string; panel: string; chip: string; glow: string }> = {
  "focus-timer": { accent: "#00e38a", panel: "radial-gradient(circle at top, rgba(0,227,138,0.08), transparent 58%), #141416", chip: "rgba(0,227,138,0.16)", glow: "0 0 22px rgba(0,227,138,0.18)" },
  "white-noise": { accent: "#72d7ff", panel: "radial-gradient(circle at top, rgba(114,215,255,0.08), transparent 58%), #141416", chip: "rgba(114,215,255,0.16)", glow: "0 0 22px rgba(114,215,255,0.18)" },
  "breathing-reset": { accent: "#c084fc", panel: "radial-gradient(circle at top, rgba(192,132,252,0.09), transparent 58%), #141416", chip: "rgba(192,132,252,0.16)", glow: "0 0 22px rgba(192,132,252,0.18)" },
};

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
  { id: "focus-timer" as const, title: "Focus Timer", status: "LIVE", desc: "Otimize seus blocos de trabalho.", icon: TimerReset },
  { id: "white-noise" as const, title: "Ruído branco", status: "LIVE", desc: "Camadas sonoras para entrar em foco.", icon: Waves },
  { id: "breathing-reset" as const, title: "Reset respiratório", status: "LIVE", desc: "Protocolo guiado para voltar ao eixo.", icon: RotateCcw },
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
  const theme = themes[activeAppId];
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

  const main = () => {
    if (activeAppId === "white-noise") {
      return (
        <>
          <section className="rounded-sm border border-zinc-800 px-6 py-6 sm:px-8 sm:py-8" style={{ background: themes["white-noise"].panel }}>
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[0.56rem] uppercase tracking-[0.24em] text-zinc-600">Paisagem sonora ativa</p>
              <div className="rounded-sm border border-zinc-800 bg-[#101012] px-3 py-2"><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Estado</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: themes["white-noise"].accent }}>{noiseState.playing ? "Tocando" : "Pronto"}</p></div>
            </div>
            <div className="mt-8 text-center">
              <p className="font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl" style={{ color: themes["white-noise"].accent }}>{sound.label}</p>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-400">{sound.desc}</p>
              <div className="mt-8 flex min-h-[7rem] items-end justify-center gap-3">{Array.from({ length: 12 }, (_, i) => <span key={i} className="w-2 rounded-full transition-all duration-700" style={{ height: noiseState.playing ? `${22 + ((i * 17) % 44)}px` : "18px", backgroundColor: themes["white-noise"].accent, opacity: noiseState.playing ? 0.35 + ((i % 5) * 0.12) : 0.16, boxShadow: noiseState.playing ? `0 0 18px ${themes["white-noise"].accent}33` : "none" }} />)}</div>
              <div className="mt-8 flex w-full max-w-[30rem] flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button type="button" onClick={() => void toggleNoise()} className="inline-flex h-14 min-w-[14rem] items-center justify-center gap-2 rounded-sm px-6 font-semibold text-[#051015] transition hover:brightness-105" style={{ backgroundColor: themes["white-noise"].accent, boxShadow: themes["white-noise"].glow }}>{noiseState.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{noiseState.playing ? "Pausar camada" : "Iniciar camada"}</button>
              </div>
              <div className="mt-4 grid w-full max-w-[30rem] gap-3 sm:grid-cols-2">
                <button type="button" onClick={silenceNoise} className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-[#202023] px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700"><RotateCcw className="h-4 w-4" />Silenciar</button>
                <div className="inline-flex h-12 items-center justify-center rounded-sm border border-zinc-800 bg-[#171719] px-4 text-sm font-semibold text-zinc-100">Volume {noiseState.volume}%</div>
              </div>
            </div>
          </section>
          <section className="grid gap-4 rounded-sm border border-zinc-800 bg-[linear-gradient(180deg,#141416,#101012)] px-6 py-5 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="space-y-3">
              <p className="font-display text-3xl font-bold uppercase tracking-tight text-zinc-100 sm:text-4xl">Sustente o ambiente certo</p>
              <p className="max-w-2xl text-sm leading-7 text-zinc-400">O objetivo aqui é reduzir ruído mental, não distrair com música. Você liga, escolhe a textura e deixa o ambiente trabalhar por você.</p>
              <div className="grid gap-3 pt-1 sm:grid-cols-3">
                <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Preset</p><p className="mt-2 text-lg font-semibold text-zinc-100">{sound.label}</p></div>
                <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Volume</p><p className="mt-2 text-2xl font-semibold text-zinc-100">{noiseState.volume}%</p></div>
                <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Camada</p><p className="mt-2 text-lg font-semibold text-zinc-100">{noiseState.playing ? "Ativa" : "Pronta"}</p></div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-sm border border-zinc-800 bg-[#111113] px-4 py-5 text-center"><p className="font-display text-4xl font-bold tracking-tight" style={{ color: themes["white-noise"].accent }}>3x</p><p className="mt-2 font-mono text-[0.52rem] uppercase tracking-[0.2em] text-zinc-600">Perfis de som</p></div>
          </section>
        </>
      );
    }
    if (activeAppId === "breathing-reset") {
      return (
        <>
          <section className="rounded-sm border border-zinc-800 px-6 py-6 sm:px-8 sm:py-8" style={{ background: themes["breathing-reset"].panel }}>
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[0.56rem] uppercase tracking-[0.24em] text-zinc-600">Reset respiratório</p>
              <div className="rounded-sm border border-zinc-800 bg-[#101012] px-3 py-2"><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Estado</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: themes["breathing-reset"].accent }}>{breathState.running ? "Guiando" : "Pronto"}</p></div>
            </div>
            <div className="mt-8 flex flex-col items-center text-center">
              <div className="relative grid h-52 w-52 place-items-center rounded-full border border-zinc-800 transition-transform duration-700 sm:h-60 sm:w-60" style={{ transform: `scale(${orbScale})`, boxShadow: `0 0 0 14px ${themes["breathing-reset"].chip}, 0 0 42px rgba(192,132,252,0.16)`, background: "radial-gradient(circle at center, rgba(192,132,252,0.18), rgba(14,14,16,0.96) 68%)" }}>
                <div className="space-y-2"><p className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl" style={{ color: themes["breathing-reset"].accent }}>{activePhase?.label ?? "Inspirar"}</p><p className="text-5xl font-semibold text-zinc-100 sm:text-6xl">{String(breathState.remaining).padStart(2, "0")}</p></div>
              </div>
              <p className="mt-8 max-w-xl text-sm leading-7 text-zinc-400">{activePhase?.hint ?? "Puxe o ar com ritmo e presença."}</p>
              <div className="mt-8 flex w-full max-w-[30rem] flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button type="button" onClick={toggleBreath} className="inline-flex h-14 min-w-[14rem] items-center justify-center gap-2 rounded-sm px-6 font-semibold text-[#15081d] transition hover:brightness-105" style={{ backgroundColor: themes["breathing-reset"].accent, boxShadow: themes["breathing-reset"].glow }}>{breathState.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{breathState.running ? "Pausar guia" : "Iniciar protocolo"}</button>
              </div>
              <div className="mt-4 grid w-full max-w-[30rem] gap-3 sm:grid-cols-2">
                <button type="button" onClick={resetBreath} className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-[#202023] px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700"><RotateCcw className="h-4 w-4" />Reiniciar</button>
                <button type="button" onClick={skipBreath} className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-[#171719] px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700"><SkipForward className="h-4 w-4" />Próxima fase</button>
              </div>
            </div>
          </section>
          <section className="grid gap-4 rounded-sm border border-zinc-800 bg-[linear-gradient(180deg,#141416,#101012)] px-6 py-5 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="space-y-3">
              <p className="font-display text-3xl font-bold uppercase tracking-tight text-zinc-100 sm:text-4xl">Volte ao eixo sem drama</p>
              <p className="max-w-2xl text-sm leading-7 text-zinc-400">Quando o cérebro acelera demais, o objetivo não é performar. É baixar o ruído fisiológico e retomar com mais clareza.</p>
              <div className="grid gap-3 pt-1 sm:grid-cols-3">
                <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Ciclos</p><p className="mt-2 text-2xl font-semibold text-zinc-100">{breathState.cycles}</p></div>
                <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Min guiados</p><p className="mt-2 text-2xl font-semibold text-zinc-100">{breathState.minutes}</p></div>
                <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Protocolo</p><p className="mt-2 text-lg font-semibold text-zinc-100">{breath.label}</p></div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-sm border border-zinc-800 bg-[#111113] px-4 py-5 text-center"><p className="font-display text-4xl font-bold tracking-tight" style={{ color: themes["breathing-reset"].accent }}>{cycleSeconds}s</p><p className="mt-2 font-mono text-[0.52rem] uppercase tracking-[0.2em] text-zinc-600">por ciclo</p></div>
          </section>
        </>
      );
    }
    return (
      <>
        <section className="rounded-sm border border-zinc-800 px-6 py-6 sm:px-8 sm:py-8" style={{ background: themes["focus-timer"].panel }}>
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[0.56rem] uppercase tracking-[0.24em] text-zinc-600">{focus.mode === "focus" ? "Bloco de foco do dia" : "Bloco de pausa"}</p>
            <div className="rounded-sm border border-zinc-800 bg-[#101012] px-3 py-2"><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Estado</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: themes["focus-timer"].accent }}>{focus.running ? (focus.mode === "focus" ? "Em foco" : "Em pausa") : "Pronto"}</p></div>
          </div>
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="font-display text-[5rem] font-bold leading-none tracking-tight sm:text-[7rem]" style={{ color: themes["focus-timer"].accent }}>{fmt(focus.remaining)}</div>
            <div className="mt-7 h-[3px] w-full max-w-[17rem] overflow-hidden rounded-full bg-white/12"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, focusProgress * 100))}%`, backgroundColor: themes["focus-timer"].accent, boxShadow: "0 0 18px rgba(0,227,138,0.38)" }} /></div>
            <div className="mt-8 flex w-full max-w-[30rem] flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button type="button" onClick={toggleFocus} className="inline-flex h-14 min-w-[14rem] items-center justify-center gap-2 rounded-sm px-6 font-semibold text-[#07110c] transition hover:brightness-105" style={{ backgroundColor: themes["focus-timer"].accent, boxShadow: themes["focus-timer"].glow }}>{focus.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{focus.running ? "Pausar" : focus.mode === "focus" ? "Iniciar foco" : "Iniciar pausa"}</button>
            </div>
            <div className="mt-4 grid w-full max-w-[30rem] gap-3 sm:grid-cols-2">
              <button type="button" onClick={resetFocus} className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-[#202023] px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700"><RotateCcw className="h-4 w-4" />Reiniciar</button>
              <button type="button" onClick={skipFocus} className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-[#171719] px-4 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700"><SkipForward className="h-4 w-4" />{focus.mode === "focus" ? "Nova pausa" : "Novo foco"}</button>
            </div>
          </div>
          {toast ? <div className="mt-6 rounded-sm border px-4 py-3 text-sm text-zinc-100" style={{ borderColor: "rgba(0,227,138,0.24)", backgroundColor: "rgba(0,227,138,0.08)" }}>{toast}</div> : null}
        </section>
        <section className="grid gap-4 rounded-sm border border-zinc-800 bg-[linear-gradient(180deg,#141416,#101012)] px-6 py-5 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div className="space-y-3">
            <p className="font-display text-3xl font-bold uppercase tracking-tight text-zinc-100 sm:text-4xl">Potencialize sua execução</p>
            <p className="max-w-2xl text-sm leading-7 text-zinc-400">Cada ciclo concluído reforça ritmo, reduz atrito na retomada e mantém o dia em protocolo.</p>
            <div className="grid gap-3 pt-1 sm:grid-cols-3">
              <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Sessões hoje</p><p className="mt-2 text-2xl font-semibold text-zinc-100">{focus.sessions}</p></div>
              <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Min focados</p><p className="mt-2 text-2xl font-semibold text-zinc-100">{focus.minutes}</p></div>
              <div><p className="font-mono text-[0.5rem] uppercase tracking-[0.18em] text-zinc-600">Preset ativo</p><p className="mt-2 text-lg font-semibold text-zinc-100">{focus.presetId === "custom" ? "Custom" : focusActivePreset?.label ?? "Custom"}</p></div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-sm border border-zinc-800 bg-[#111113] px-4 py-5 text-center"><p className="font-display text-4xl font-bold tracking-tight" style={{ color: themes["focus-timer"].accent }}>+{focusXp}</p><p className="mt-2 font-mono text-[0.52rem] uppercase tracking-[0.2em] text-zinc-600">XP por ritmo</p></div>
        </section>
      </>
    );
  };

  const side = () => {
    if (activeAppId === "white-noise") {
      return (
        <>
          <section className="rounded-sm border border-zinc-800 bg-[#141416] p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="h-4 w-4" style={{ color: themes["white-noise"].accent }} />
              <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">Configuração rápida</p>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3"><span className="font-mono text-[0.52rem] uppercase tracking-[0.18em] text-zinc-600">Volume</span><span className="text-sm font-semibold text-zinc-100">{noiseState.volume}%</span></div>
              <input type="range" min={0} max={100} value={noiseState.volume} onChange={(event) => setNoiseState((current) => ({ ...current, volume: Number(event.target.value) }))} className="mt-3 w-full" style={{ accentColor: themes["white-noise"].accent }} />
            </div>
          </section>
          <section className="rounded-sm border border-zinc-800 bg-[#141416] p-5">
            <div className="flex items-center gap-3">
              <Waves className="h-4 w-4" style={{ color: themes["white-noise"].accent }} />
              <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">Perfis sonoros</p>
            </div>
            <div className="mt-4 space-y-3">
              {noisePresets.map((preset) => {
                const active = noiseState.presetId === preset.id;
                return (
                  <button key={preset.id} type="button" onClick={() => setNoiseState((current) => ({ ...current, presetId: preset.id }))} className={["w-full rounded-sm border px-4 py-4 text-left transition", active ? "border-[rgba(114,215,255,0.26)] bg-[rgba(114,215,255,0.08)]" : "border-zinc-800 bg-[#0f0f11] hover:border-zinc-700"].join(" ")}>
                    <p className="text-base font-semibold text-zinc-100">{preset.label}</p>
                    <p className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-zinc-600">{preset.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      );
    }
    if (activeAppId === "breathing-reset") {
      return (
        <>
          <section className="rounded-sm border border-zinc-800 bg-[#141416] p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="h-4 w-4" style={{ color: themes["breathing-reset"].accent }} />
              <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">Protocolo ativo</p>
            </div>
            <div className="mt-4 space-y-3">
              {phases.map((phase) => (
                <div key={phase.phase} className={["rounded-sm border px-4 py-3", phase.phase === breathState.phase ? "border-[rgba(192,132,252,0.26)] bg-[rgba(192,132,252,0.08)]" : "border-zinc-800 bg-[#0f0f11]"].join(" ")}>
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-zinc-100">{phase.label}</p><span className="text-sm font-semibold text-zinc-400">{phase.duration}s</span></div>
                  <p className="mt-1 text-xs leading-6 text-zinc-500">{phase.hint}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-sm border border-zinc-800 bg-[#141416] p-5">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-4 w-4" style={{ color: themes["breathing-reset"].accent }} />
              <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">Presets respiratórios</p>
            </div>
            <div className="mt-4 space-y-3">
              {breathPresets.map((preset) => {
                const active = breathState.presetId === preset.id;
                return (
                  <button key={preset.id} type="button" onClick={() => setBreathPreset(preset.id)} className={["w-full rounded-sm border px-4 py-4 text-left transition", active ? "border-[rgba(192,132,252,0.26)] bg-[rgba(192,132,252,0.08)]" : "border-zinc-800 bg-[#0f0f11] hover:border-zinc-700"].join(" ")}>
                    <div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-zinc-100">{preset.label}</p><p className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-zinc-600">{preset.desc}</p></div><span className="text-sm font-semibold text-zinc-400">{preset.inhale}/{preset.hold}/{preset.exhale}</span></div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      );
    }
    return (
      <>
        <section className="rounded-sm border border-zinc-800 bg-[#141416] p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="h-4 w-4" style={{ color: themes["focus-timer"].accent }} />
            <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">Configuração rápida</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="space-y-2"><span className="font-mono text-[0.52rem] uppercase tracking-[0.18em] text-zinc-600">Foco (min)</span><input type="number" min={1} value={focus.focus} onChange={(event) => setFocusMinutes(event.target.value)} className="h-16 w-full rounded-sm border border-zinc-800 bg-[#0d0d0f] px-4 text-2xl font-semibold text-zinc-100 outline-none transition focus:border-[rgba(0,227,138,0.45)]" /></label>
            <label className="space-y-2"><span className="font-mono text-[0.52rem] uppercase tracking-[0.18em] text-zinc-600">Pausa (min)</span><input type="number" min={1} value={focus.pause} onChange={(event) => setPauseMinutes(event.target.value)} className="h-16 w-full rounded-sm border border-zinc-800 bg-[#0d0d0f] px-4 text-2xl font-semibold text-zinc-100 outline-none transition focus:border-[rgba(0,227,138,0.45)]" /></label>
          </div>
        </section>
        <section className="rounded-sm border border-zinc-800 bg-[#141416] p-5">
          <div className="flex items-center gap-3">
            <TimerReset className="h-4 w-4" style={{ color: themes["focus-timer"].accent }} />
            <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">Presets de sessão</p>
          </div>
          <div className="mt-4 space-y-3">
            {focusPresets.map((preset) => {
              const active = focus.presetId === preset.id;
              return (
                <button key={preset.id} type="button" onClick={() => setFocusPreset(preset.id)} className={["w-full rounded-sm border px-4 py-4 text-left transition", active ? "border-[rgba(0,227,138,0.26)] bg-[rgba(0,227,138,0.08)]" : "border-zinc-800 bg-[#0f0f11] hover:border-zinc-700"].join(" ")}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-zinc-100">{preset.label}</p><p className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.16em] text-zinc-600">{preset.desc}</p></div><span className="text-sm font-semibold text-zinc-400">{preset.focus}/{preset.pause}</span></div>
                </button>
              );
            })}
          </div>
        </section>
      </>
    );
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="space-y-3">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-zinc-600">Ferramentas internas</p>
          <h1 className="font-display text-5xl font-bold uppercase tracking-tight text-zinc-100 sm:text-6xl">Ferramentas<span style={{ color: theme.accent }}>.</span></h1>
          <p className="max-w-xl text-base leading-7 text-zinc-400">Apps rápidos para entrar em execução e manter o estado de flow contínuo.</p>
        </div>
        <div className="flex flex-wrap gap-3 xl:justify-end">
          <Link href="/tasks" className="inline-flex h-12 items-center gap-2 rounded-sm border border-zinc-800 bg-[#171719] px-5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-100 transition hover:border-[color:color-mix(in_srgb,white_18%,transparent)]"><span className="grid h-5 w-5 place-items-center rounded-full border text-[10px]" style={{ borderColor: "color-mix(in srgb, var(--accent) 38%, transparent)", color: theme.accent }}><ArrowRight className="h-3 w-3" /></span>Abrir tarefas</Link>
          <Link href="/agenda" className="inline-flex h-12 items-center rounded-sm border border-zinc-800 px-5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-100">Voltar para agenda</Link>
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="space-y-3">
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.24em] text-zinc-600">Ferramentas internas</p>
          <div className="space-y-3">
            {apps.map((app) => {
              const active = app.id === activeAppId;
              const Icon = app.icon;
              const appTheme = themes[app.id];
              return (
                <button key={app.id} type="button" onClick={() => setActiveAppId(app.id)} className={["w-full rounded-sm border bg-[#141416] px-4 py-4 text-left transition", active ? "border-transparent" : "border-zinc-800 opacity-72 hover:opacity-100 hover:border-zinc-700"].join(" ")} style={active ? { boxShadow: `inset 3px 0 0 0 ${appTheme.accent}` } : undefined}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-zinc-800 bg-[#0d0d0f]" style={active ? { color: appTheme.accent } : undefined}><Icon className="h-4 w-4" /></span>
                    <span className="rounded-sm border px-2 py-1 font-mono text-[0.48rem] uppercase tracking-[0.14em]" style={{ borderColor: active ? "transparent" : "#27272a", backgroundColor: active ? appTheme.chip : "transparent", color: active ? appTheme.accent : "#71717a" }}>{app.status}</span>
                  </div>
                  <div className="mt-4"><p className="text-sm font-semibold text-zinc-100">{app.title}</p><p className="mt-1 text-xs leading-6 text-zinc-500">{app.desc}</p></div>
                </button>
              );
            })}
          </div>
        </aside>
        <div className="space-y-4">{main()}</div>
        <aside className="space-y-4">{side()}</aside>
      </section>
      {toast ? <div className="fixed bottom-24 right-4 z-40 rounded-sm border px-4 py-3 text-sm text-zinc-100 shadow-xl lg:right-8" style={{ borderColor: `${theme.accent}40`, backgroundColor: "#111113" }}>{toast}</div> : null}
    </div>
  );
}
