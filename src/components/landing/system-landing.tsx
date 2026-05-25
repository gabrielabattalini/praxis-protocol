"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Briefcase,
  Check,
  ChevronRight,
  Crown,
  Dumbbell,
  Fingerprint,
  HeartPulse,
  House,
  Lock,
  Mars,
  MoonStar,
  Palette,
  Pill,
  ShieldAlert,
  ShoppingBasket,
  Sparkles,
  Star,
  Stethoscope,
  Trophy,
  UtensilsCrossed,
  Venus,
  Wallet,
  Zap,
} from "lucide-react";
import { StripeCheckoutButton } from "@/components/billing/stripe-checkout-button";
import { publicBillingPlan } from "@/lib/billing-config";
import { moduleCatalog } from "@/lib/mock-data";

type Scene = "nexus" | "forge";
type Level = 1 | 2 | 3 | 4 | 5;
type IntelCardId = "prioridade" | "evolucao" | "execucao";
type OperatorGender = "male" | "female";
type IntroStage =
  | "idle"
  | "loading"
  | "alert"
  | "player"
  | "welcome"
  | "chance"
  | "awakening"
  | "complete";
type ToneKind = "click" | "confirm" | "tick" | "alert" | "success";

const SOUNDTRACK_VOLUME = 0.22;
const UI_EFFECT_GAIN = 1.4;

const levels = [
  { id: 1, title: "O Despertar", icon: Star },
  { id: 2, title: "O Protocolo", icon: Zap },
  { id: 3, title: "A Matriz", icon: Palette },
  { id: 4, title: "Os Operadores", icon: Trophy },
  { id: 5, title: "Ativação", icon: Crown },
] as const;

const moduleCards = [
  {
    title: "Treino",
    icon: Dumbbell,
    text: "Treino entra como protocolo: menos decisão, mais repetição útil durante a semana.",
    stat: "FORÇA / +55 XP",
  },
  {
    title: "Nutrição",
    icon: UtensilsCrossed,
    text: "Refeições viram execução mínima com leitura clara de meta, consumo e retomada.",
    stat: "ENERGIA / +40 XP",
  },
  {
    title: "Trabalho",
    icon: Briefcase,
    text: "Entrega deixa de depender de pique. Vira janela definida e próximo passo executável.",
    stat: "FOCO / +40 XP",
  },
  {
    title: "Mente",
    icon: BrainCircuit,
    text: "Clareza e reset mental entram no mesmo fluxo para sustentar constância no resto do dia.",
    stat: "MENTAL / +35 XP",
  },
] as const;

const outdatedSystem = [
  "Pedem decisão nova toda vez que você abre.",
  "Separam rotina, contexto e consequência.",
  "Dependem demais de motivação e memória.",
  "Quando o dia aperta, tudo perde sequência.",
] as const;

const praxisSystem = [
  "Transforma intenção em próximo passo executável.",
  "Reduz negociação mental com janela, prioridade e contexto.",
  "Usa o mesmo histórico para sustentar constância entre módulos.",
  "Quando você falha um dia, puxa retomada antes de virar padrão.",
] as const;

const intelCards = [
  {
    id: "prioridade",
    label: "Prioridade operacional",
    title: "O protocolo protege primeiro o que mais importa.",
    text: "Cada área recebe peso real. Quando uma frente crítica cai, o sistema empurra energia para ela sem depender de hype.",
    metrics: [
      { label: "Treino", value: "S" },
      { label: "Sono", value: "A" },
      { label: "Trabalho", value: "B" },
    ],
    note: "MATRIZ // PESO E RISCO DO DIA",
  },
  {
    id: "evolucao",
    label: "Leitura de consistência",
    title: "Você vê repetição, não só tarefa concluída.",
    text: "O Praxis mostra se a rotina está sustentando identidade, foco e recuperação entre módulos.",
    metrics: [
      { label: "Execução", value: "+03" },
      { label: "Retomada", value: "+02" },
      { label: "Ritmo", value: "+01" },
    ],
    note: "LEITURA // IDENTIDADE EM CONSTRUÇÃO",
  },
  {
    id: "execucao",
    label: "Próximo passo",
    title: "O Arquiteto devolve um passo claro quando você trava.",
    text: "Em vez de lista solta, o sistema define missão, janela e dificuldade para reduzir hesitação.",
    metrics: [
      { label: "Ação", value: "1 PASSO" },
      { label: "XP", value: "+40" },
      { label: "Janela", value: "07:00" },
    ],
    note: "PROTOCOLO // AÇÃO SEM NEGOCIAÇÃO",
  },
] as const;

const testimonials = [
  {
    name: "Lucas Mendes",
    level: "NÍVEL 24",
    text: "Quando parei de acumular tarefa e comecei a seguir protocolo, treino e trabalho ficaram previsíveis.",
  },
  {
    name: "Amanda Soares",
    level: "NÍVEL 41",
    text: "Hoje eu não dependo de empolgação para começar. Eu entro, vejo o próximo passo e executo.",
  },
  {
    name: "Rafael Costa",
    level: "NÍVEL 18",
    text: "Treino, dieta e trabalho deixaram de competir. Agora tudo reforça a mesma rotina.",
  },
] as const;

const communityStats = [
  { value: 20, suffix: "K+", label: "OPERADORES ATIVOS", decimals: 0 },
  { value: 1, suffix: "M+", label: "MISSÕES CONCLUÍDAS", decimals: 0 },
  { value: 240, suffix: "K+", label: "SESSÕES REGISTRADAS", decimals: 0 },
  { value: 4.9, suffix: "", label: "AVALIAÇÃO MÉDIA", decimals: 1 },
] as const;

const frictionCycle = [
  {
    day: "Segunda",
    title: "Você começa forte.",
    text: "Abre vários apps, decide demais e gasta energia antes de executar.",
  },
  {
    day: "Quarta",
    title: "Tudo se espalha.",
    text: "Cada frente pede contexto novo. O cérebro volta para o caminho mais fácil.",
  },
  {
    day: "Sexta",
    title: "Retomar pesa.",
    text: "Dois dias fora e a rotina já parece ter voltado ao zero.",
  },
] as const;

const comparisonApps = [
  { app: "Habitica", price: "Grátis*", module: "Hábitos" },
  { app: "TickTick", price: "~R$30/mês", module: "Tarefas" },
  { app: "MyFitnessPal", price: "~R$45/mês", module: "Nutrição" },
  { app: "Mobills", price: "~R$25/mês", module: "Finanças" },
  { app: "Focus Timer", price: "~R$15/mês", module: "Produtividade" },
  { app: "Google Calendar", price: "Grátis*", module: "Calendário" },
] as const;

const visualSignals = [
  {
    label: "Missão ativa",
    value: "+55 XP",
    text: "recompensa alinhada à prioridade",
  },
  {
    label: "Frente crítica",
    value: "RANK S",
    text: "onde a retomada importa",
  },
  {
    label: "Mesmo núcleo",
    value: String(moduleCatalog.length),
    text: "sem abrir outro app",
  },
] as const;

const moduleVisualState: Record<string, { progress: number; badge: string }> = {
  run: { progress: 72, badge: "pace / consistência" },
  workout: { progress: 68, badge: "força / séries" },
  work: { progress: 81, badge: "foco / entregas" },
  nutrition: { progress: 76, badge: "refeições / meta" },
  finance: { progress: 64, badge: "gastos / leitura" },
  appearance: { progress: 58, badge: "rotina / constância" },
  recovery: { progress: 61, badge: "mobilidade / descanso" },
  health: { progress: 63, badge: "check-up / prevenção" },
  mind: { progress: 66, badge: "clareza / foco" },
  sleep: { progress: 70, badge: "sono / recuperação" },
  home: { progress: 55, badge: "ordem / manutenção" },
};

const featuredModuleIds = [
  "run",
  "workout",
  "nutrition",
  "work",
  "finance",
  "health",
] as const;

const evolutionSnapshotsByGender = {
  male: [
    {
      id: "before",
      image: "/operador-antes-atual.png",
      badge: "Operador antes do Praxis",
      score: "3.4",
      label: "Performance média",
      points: [
        "Rotina reativa",
        "Ritmo instável",
      ],
    },
    {
      id: "after",
      image: "/operador-depois-atual.png",
      badge: "Operador após o Praxis",
      score: "8.1",
      label: "Performance média",
      points: [
        "Foco mais estável",
        "Constância sustentada",
      ],
    },
  ],
  female: [
    {
      id: "before",
      image: "/operadora-antes-landing.png",
      badge: "Operadora antes do Praxis",
      score: "3.4",
      label: "Performance média",
      points: [
        "Rotina reativa",
        "Ritmo instável",
      ],
    },
    {
      id: "after",
      image: "/operadora-depois-landing.png",
      badge: "Operadora após o Praxis",
      score: "8.1",
      label: "Performance média",
      points: [
        "Foco mais estável",
        "Constância sustentada",
      ],
    },
  ],
} as const;

const evolutionTrend = [18, 26, 24, 38, 44, 41, 53, 61, 68, 76, 81] as const;

const bootChecks = [
  "> CHECKING_BIOMETRICS...",
  "> VALIDATING_OPERATOR_ID...",
  "> SYNCING_EVOLUTION_MATRIX...",
  "> ESTABLISHING_SECURE_LINK...",
] as const;

const moduleIcons = {
  run: Activity,
  workout: Dumbbell,
  work: Briefcase,
  nutrition: UtensilsCrossed,
  finance: Wallet,
  appearance: Sparkles,
  recovery: HeartPulse,
  health: Stethoscope,
  mind: BrainCircuit,
  sleep: MoonStar,
  home: House,
  market: ShoppingBasket,
  supplements: Pill,
} as const;

function clampLevel(value: number): Level {
  return Math.min(5, Math.max(1, value)) as Level;
}

function ExecutionButton({
  children,
  href,
  onClick,
  kind = "primary",
  playSound,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "ghost";
  playSound?: () => void;
}) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "14px 22px",
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    cursor: "pointer",
    textDecoration: "none",
    borderRadius: 999,
    transition: "all 0.15s ease",
  };
  const kindStyle: React.CSSProperties =
    kind === "primary"
      ? {
          background:
            "linear-gradient(180deg, var(--accent-bright), var(--accent))",
          color: "#1a0a04",
          border: "1px solid var(--accent)",
          boxShadow:
            "0 0 24px rgba(251,146,60,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
        }
      : kind === "secondary"
        ? {
            background: "rgba(0,0,0,0.4)",
            color: "var(--fg-2)",
            border: "1px solid var(--line)",
          }
        : {
            background: "transparent",
            color: "var(--fg-3)",
            border: "1px solid var(--line-soft)",
          };

  const className = "praxis-landing-cta";

  function handleClick() {
    playSound?.();
    onClick?.();
  }

  if (href) {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className={className}
        style={{ ...baseStyle, ...kindStyle }}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={{ ...baseStyle, ...kindStyle }}
    >
      {children}
    </button>
  );
}

function IdentityBlock({
  protocol,
  title,
  copy,
}: {
  protocol: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="pl-5" style={{ borderLeft: "2px solid var(--accent)" }}>
      <p
        className="font-mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontSize: 11,
          letterSpacing: "0.28em",
          fontWeight: 700,
          color: "var(--accent)",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden>▸</span>
        {protocol}
      </p>
      <h1
        className="mt-4"
        style={{
          fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
          fontSize: "clamp(38px, 6vw, 72px)",
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 0.98,
          color: "var(--fg)",
          margin: "16px 0 0",
        }}
      >
        {title}
      </h1>
      <p
        className="mt-6 max-w-2xl"
        style={{
          fontSize: 18,
          lineHeight: 1.55,
          color: "var(--fg-3)",
          marginTop: 24,
        }}
      >
        {copy}
      </p>
    </div>
  );
}

function Rail({
  active,
  unlocked,
  onSelect,
  playSound,
}: {
  active: Level;
  unlocked: Level;
  onSelect: (level: Level) => void;
  playSound?: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-3 md:grid-cols-5">
        {levels.map((level) => {
          const Icon = level.icon;
          const isActive = active === level.id;
          const isDone = level.id < active;
          const isUnlocked = level.id <= unlocked;

          return (
            <button
              key={level.id}
              type="button"
              disabled={!isUnlocked}
              onClick={() => {
                if (!isUnlocked) return;
                playSound?.();
                onSelect(level.id);
              }}
              className={[
                "border px-4 py-4 text-left transition duration-200",
                isActive
                  ? "border-amber-400 bg-[linear-gradient(180deg,rgba(251,146,60,0.14),rgba(18,18,20,0.96))] shadow-[0_0_18px_rgba(251,146,60,0.16)]"
                  : "",
                isDone
                  ? "border-amber-400/30 bg-[linear-gradient(180deg,rgba(251,146,60,0.08),rgba(18,18,20,0.96))]"
                  : "",
                !isDone && !isActive ? "border-zinc-800 bg-[#121214]" : "",
                isUnlocked ? "hover:border-amber-400/50" : "cursor-not-allowed opacity-35",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-4">
                {isUnlocked ? (
                  <Icon
                    className={`h-5 w-5 ${
                      isActive || isDone ? "text-amber-300" : "text-zinc-500"
                    }`}
                  />
                ) : (
                  <Lock className="h-5 w-5 text-zinc-700" />
                )}
                <span
                  className={`font-mono text-[0.6rem] uppercase tracking-[0.26em] ${
                    isActive || isDone ? "text-amber-300" : "text-zinc-600"
                  }`}
                >
                  Nível {level.id}
                </span>
              </div>
              <p className="mt-4 font-display text-lg font-semibold uppercase tracking-tight text-zinc-100">
                {level.title}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border border-zinc-800 bg-[#0d0d0f]">
        <div
          className="h-2 bg-[linear-gradient(90deg,#fb923c_0%,#fdba74_100%)] shadow-[0_0_16px_rgba(251,146,60,0.35)] transition-all duration-300"
          style={{ width: `${(active / 5) * 100}%` }}
        />
      </div>
      <p className="mt-3 font-mono text-[0.64rem] uppercase tracking-[0.26em] text-zinc-500">
        progresso operacional // {Math.round((active / 5) * 100)}% concluído
      </p>
    </div>
  );
}

function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const revealRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = revealRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={revealRef}
      style={{ transitionDelay: `${delay}ms` }}
      className={[
        "transform transition-all duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function CountUpValue({
  value,
  decimals = 0,
  suffix = "",
  delay = 0,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  delay?: number;
}) {
  const countRef = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const node = countRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.35,
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let frame = 0;
    let timeout = 0;
    const duration = 3200;

    const step = (startTime: number, now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame((nextNow) => step(startTime, nextNow));
      }
    };

    timeout = window.setTimeout(() => {
      const startTime = performance.now();
      frame = window.requestAnimationFrame((now) => step(startTime, now));
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
    };
  }, [delay, isVisible, value]);

  return (
    <span
      ref={countRef}
      className={`inline-block transition-all duration-700 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function SystemLanding() {
  const soundtrackRef = useRef<HTMLAudioElement | null>(null);
  const uiAudioContextRef = useRef<AudioContext | null>(null);
  const previousCheckCountRef = useRef(0);
  const evolutionSectionRef = useRef<HTMLElement | null>(null);
  const playerText = "JOGADOR RECONHECIDO\nNÍVEL ATUAL: INICIANTE";

  const [scene, setScene] = useState<Scene>("nexus");
  const [audioStarted, setAudioStarted] = useState(false);
  const [activeLevel, setActiveLevel] = useState<Level>(1);
  const [unlockedLevel, setUnlockedLevel] = useState<Level>(1);
  const [introStage, setIntroStage] = useState<IntroStage>("idle");
  const [bootProgress, setBootProgress] = useState(0);
  const [playerCharCount, setPlayerCharCount] = useState(0);
  const [intelCardId, setIntelCardId] = useState<IntelCardId>("prioridade");
  const [operatorGender, setOperatorGender] = useState<OperatorGender>("male");
  const [motionReady, setMotionReady] = useState(false);
  const [evolutionSectionVisible, setEvolutionSectionVisible] = useState(false);

  const visibleCheckCount =
    bootProgress >= 92
      ? 4
      : bootProgress >= 68
        ? 3
        : bootProgress >= 38
          ? 2
          : bootProgress >= 8
            ? 1
            : 0;
  const typedPlayerText = playerText.slice(0, playerCharCount);
  const introVisible = introStage !== "complete";

  const currentIntel = useMemo(
    () => intelCards.find((card) => card.id === intelCardId) ?? intelCards[0],
    [intelCardId],
  );
  const featuredModules = useMemo(
    () => moduleCatalog.filter((module) => featuredModuleIds.includes(module.id as (typeof featuredModuleIds)[number])),
    [],
  );
  const compactModules = useMemo(
    () => moduleCatalog.filter((module) => !featuredModuleIds.includes(module.id as (typeof featuredModuleIds)[number])),
    [],
  );
  const evolutionSnapshots = useMemo(
    () => evolutionSnapshotsByGender[operatorGender],
    [operatorGender],
  );
  const syncStrokeOffset = motionReady ? 29.15 : 364.4;
  const evolutionChart = useMemo(() => {
    const width = 520;
    const height = 180;
    const max = Math.max(...evolutionTrend);
    const min = Math.min(...evolutionTrend);
    const range = Math.max(max - min, 1);

    const points = evolutionTrend.map((value, index) => {
      const x = (index / (evolutionTrend.length - 1)) * width;
      const normalized = (value - min) / range;
      const y = height - normalized * (height - 20) - 10;
      return { x, y };
    });

    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const area = `${line} L ${width} ${height} L 0 ${height} Z`;

    return { width, height, points, line, area };
  }, []);

  const getUiAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (uiAudioContextRef.current) return uiAudioContextRef.current;

    const AudioCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtor) return null;

    uiAudioContextRef.current = new AudioCtor();
    return uiAudioContextRef.current;
  }, []);

  const playPulse = useCallback(
    (
      frequency: number,
      duration: number,
      {
        type = "square",
        volume = 0.03,
        delay = 0,
        endFrequency,
      }: {
        type?: OscillatorType;
        volume?: number;
        delay?: number;
        endFrequency?: number;
      } = {},
    ) => {
      const context = getUiAudioContext();
      if (!context) return;

      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startTime = context.currentTime + delay;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          endFrequency,
          startTime + duration,
        );
      }

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(
        Math.min(volume * UI_EFFECT_GAIN, 0.08),
        startTime + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.02);
    },
    [getUiAudioContext],
  );

  const playUiTone = useCallback(
    (kind: ToneKind) => {
      if (kind === "click") {
        playPulse(840, 0.04, {
          type: "square",
          volume: 0.016,
          endFrequency: 700,
        });
        playPulse(1180, 0.05, {
          type: "square",
          volume: 0.01,
          delay: 0.03,
          endFrequency: 960,
        });
        return;
      }

      if (kind === "confirm") {
        playPulse(410, 0.07, {
          type: "triangle",
          volume: 0.024,
          endFrequency: 560,
        });
        playPulse(720, 0.09, {
          type: "triangle",
          volume: 0.018,
          delay: 0.08,
          endFrequency: 910,
        });
        return;
      }

      if (kind === "tick") {
        playPulse(980, 0.03, {
          type: "sine",
          volume: 0.014,
          endFrequency: 860,
        });
        return;
      }

      if (kind === "alert") {
        playPulse(190, 0.12, {
          type: "sawtooth",
          volume: 0.018,
          endFrequency: 145,
        });
        playPulse(145, 0.13, {
          type: "sawtooth",
          volume: 0.015,
          delay: 0.12,
          endFrequency: 118,
        });
        return;
      }

      playPulse(520, 0.08, {
        type: "triangle",
        volume: 0.02,
        endFrequency: 680,
      });
      playPulse(760, 0.08, {
        type: "triangle",
        volume: 0.016,
        delay: 0.08,
        endFrequency: 980,
      });
      playPulse(1120, 0.08, {
        type: "triangle",
        volume: 0.013,
        delay: 0.16,
        endFrequency: 1320,
      });
    },
    [playPulse],
  );

  const handleButtonClick = useCallback(() => {
    playUiTone("click");
  }, [playUiTone]);

  const startSequence = useCallback(() => {
    playUiTone("confirm");
    setAudioStarted(true);
    setBootProgress(0);
    previousCheckCountRef.current = 0;
    setPlayerCharCount(0);
    setIntroStage("loading");
  }, [playUiTone]);

  const skipIntro = useCallback(() => {
    if (!introVisible) return;

    playUiTone("click");
    setAudioStarted(true);
    setBootProgress(100);
    previousCheckCountRef.current = bootChecks.length;
    setPlayerCharCount(playerText.length);
    setScene("nexus");
    setIntroStage("complete");
  }, [introVisible, playUiTone, playerText.length]);

  const openForge = useCallback(() => {
    playUiTone("confirm");
    setScene("forge");
    setActiveLevel(1);
    setUnlockedLevel((value) => (value > 1 ? value : 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [playUiTone]);

  const goBack = useCallback(() => {
    playUiTone("click");
    if (activeLevel === 1) {
      setScene("nexus");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setActiveLevel((value) => clampLevel(value - 1));
  }, [activeLevel, playUiTone]);

  const goNext = useCallback(() => {
    playUiTone("confirm");

    if (activeLevel === 5) {
      window.location.assign("/auth/register");
      return;
    }

    const next = clampLevel(activeLevel + 1);
    setUnlockedLevel((value) => (next > value ? next : value));
    setActiveLevel(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeLevel, playUiTone]);

  useEffect(() => {
    if (!audioStarted || !soundtrackRef.current) return;

    soundtrackRef.current.volume = SOUNDTRACK_VOLUME;
    soundtrackRef.current.loop = true;
    void soundtrackRef.current.play().catch(() => {
      soundtrackRef.current?.pause();
    });
  }, [audioStarted]);

  useEffect(() => {
    if (!introVisible) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeLevel, introVisible, scene]);

  useEffect(() => {
    if (!introVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      skipIntro();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [introVisible, skipIntro]);

  useEffect(() => {
    if (visibleCheckCount <= previousCheckCountRef.current) return;
    previousCheckCountRef.current = visibleCheckCount;
    if (introStage === "loading") {
      playUiTone("tick");
    }
  }, [introStage, playUiTone, visibleCheckCount]);

  useEffect(() => {
    if (introStage !== "loading") return;

    let frame = 0;
    let alertTimeout = 0;
    const durationMs = 6200;
    const startedAt = window.performance.now();

    const update = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(elapsed / durationMs, 1);
      const easedRatio =
        ratio < 0.85
          ? (ratio / 0.85) * 0.97
          : 0.97 + ((ratio - 0.85) / 0.15) * 0.03;

      setBootProgress(Math.min(100, Math.round(easedRatio * 100)));

      if (ratio < 1) {
        frame = window.requestAnimationFrame(update);
        return;
      }

      setBootProgress(100);
      alertTimeout = window.setTimeout(() => {
        playUiTone("alert");
        setIntroStage("alert");
      }, 520);
    };

    frame = window.requestAnimationFrame(update);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(alertTimeout);
    };
  }, [introStage, playUiTone]);

  useEffect(() => {
    if (introStage !== "alert") return;

    const timeout = window.setTimeout(() => {
      playUiTone("tick");
      setIntroStage("player");
      setPlayerCharCount(0);
    }, 1650);

    return () => window.clearTimeout(timeout);
  }, [introStage, playUiTone]);

  useEffect(() => {
    if (introStage !== "player") return;

    let charInterval = 0;
    let nextTimeout = 0;

    charInterval = window.setInterval(() => {
      setPlayerCharCount((value) => {
        const next = Math.min(value + 1, playerText.length);
        if (next !== value && (next % 8 === 0 || next === playerText.length)) {
          playUiTone("tick");
        }
        return next;
      });
    }, 34);

    nextTimeout = window.setTimeout(() => {
      playUiTone("success");
      setIntroStage("welcome");
    }, playerText.length * 34 + 1000);

    return () => {
      window.clearInterval(charInterval);
      window.clearTimeout(nextTimeout);
    };
  }, [introStage, playUiTone, playerText.length]);

  useEffect(() => {
    if (introStage !== "welcome") return;

    const timeout = window.setTimeout(() => {
      playUiTone("tick");
      setIntroStage("chance");
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [introStage, playUiTone]);

  useEffect(() => {
    if (introStage !== "chance") return;

    const timeout = window.setTimeout(() => {
      playUiTone("success");
      setIntroStage("awakening");
    }, 2350);

    return () => window.clearTimeout(timeout);
  }, [introStage, playUiTone]);

  useEffect(() => {
    if (introStage !== "awakening") return;

    const timeout = window.setTimeout(() => {
      setIntroStage("complete");
      setScene("nexus");
    }, 2450);

    return () => window.clearTimeout(timeout);
  }, [introStage]);

  useEffect(() => {
    if (introVisible) return;

    const timeout = window.setTimeout(() => {
      setMotionReady(true);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [introVisible]);

  useEffect(() => {
    const node = evolutionSectionRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => {
        setEvolutionSectionVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setEvolutionSectionVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.22,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-zinc-100">
      <audio ref={soundtrackRef} preload="auto" src="/audio/dark-aria-lv2.mp3" />

      <style jsx global>{`
        @keyframes praxis-grid-drift {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(-56px, 0, 0);
          }
        }

        @keyframes praxis-line-scan-y {
          0% {
            opacity: 0;
            transform: translate3d(0, -30vh, 0);
          }
          26% {
            opacity: 0.2;
          }
          100% {
            opacity: 0;
            transform: translate3d(0, 70vh, 0);
          }
        }

        @keyframes praxis-line-scan-x {
          0% {
            opacity: 0;
            transform: translate3d(-35vw, 0, 0);
          }
          22% {
            opacity: 0.16;
          }
          100% {
            opacity: 0;
            transform: translate3d(75vw, 0, 0);
          }
        }

        @keyframes praxis-intro-raise {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes praxis-flicker {
          0%,
          100% {
            opacity: 1;
          }
          6% {
            opacity: 0.86;
          }
          7% {
            opacity: 1;
          }
          54% {
            opacity: 0.9;
          }
          55% {
            opacity: 1;
          }
        }

        @keyframes praxis-pulse {
          0%,
          100% {
            opacity: 0.48;
          }
          50% {
            opacity: 0.95;
          }
        }

        @keyframes praxis-surface-drift {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(-48px, -24px, 0);
          }
        }

        @keyframes praxis-surface-glow {
          0%,
          100% {
            opacity: 0.06;
            transform: scale(1) translate3d(0, 0, 0);
          }
          50% {
            opacity: 0.12;
            transform: scale(1.04) translate3d(0, -1.5%, 0);
          }
        }

        @keyframes praxis-chart-breathe {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.9;
          }
          50% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }

        @keyframes praxis-orbit-pulse {
          0%,
          100% {
            opacity: 0.88;
            filter: drop-shadow(0 0 10px rgba(251,146,60,0.26));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 18px rgba(251,146,60,0.46));
          }
        }

        .praxis-intro-grid {
          animation: praxis-grid-drift 18s linear infinite;
        }

        .praxis-intro-line-y {
          animation: praxis-line-scan-y 7.2s linear infinite;
        }

        .praxis-intro-line-x {
          animation: praxis-line-scan-x 9.6s linear infinite;
        }

        .praxis-intro-rise {
          animation: praxis-intro-raise 0.42s ease-out both;
        }

        .praxis-intro-flicker {
          animation: praxis-flicker 4.8s linear infinite;
        }

        .praxis-intro-pulse {
          animation: praxis-pulse 2.4s ease-in-out infinite;
        }

        .praxis-surface-grid {
          animation: praxis-surface-drift 28s linear infinite;
        }

        .praxis-surface-glow {
          animation: praxis-surface-glow 12s ease-in-out infinite;
        }

        .praxis-chart-breathe {
          animation: praxis-chart-breathe 5.4s ease-in-out infinite;
        }

        .praxis-orbit-pulse {
          animation: praxis-orbit-pulse 4.4s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.08),transparent_25%),radial-gradient(circle_at_78%_8%,rgba(251,146,60,0.05),transparent_20%),linear-gradient(180deg,#050505_0%,#09090b_42%,#030303_100%)]" />
        <div className="praxis-surface-glow absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(251,146,60,0.08),transparent_18%),radial-gradient(circle_at_82%_20%,rgba(251,146,60,0.05),transparent_16%)]" />
        <div
          className="praxis-surface-grid absolute inset-[-4%] opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),transparent_26%,rgba(0,0,0,0.22)_100%)]" />
      </div>

      {introVisible ? (
        <div
          // Tap-to-skip mirrors the existing ESC handler so mobile users
          // (no keyboard) can dismiss the animation. Suppressed during
          // the "idle" stage so taps on the "Entrar no protocolo" button
          // start the sequence instead of skipping the whole intro on
          // first contact.
          onClick={
            introStage !== "idle"
              ? (event) => {
                  // Don't skip if the user clicked inside a button or
                  // link inside the overlay (currently none past idle,
                  // but keeps the handler safe if any get added later).
                  const target = event.target as HTMLElement | null;
                  if (target?.closest("button, a")) return;
                  skipIntro();
                }
              : undefined
          }
          className="fixed inset-0 z-[150] overflow-hidden bg-[#050505]"
        >
          <div
            className="praxis-intro-grid absolute inset-[-8%] opacity-[0.08]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0 28px, rgba(251,146,60,0.16) 28px 29px, transparent 29px 58px)",
              backgroundSize: "360px 360px",
            }}
          />
          <div className="absolute inset-0 praxis-scanlines" />
          <div className="praxis-intro-line-x absolute inset-x-0 top-1/2 h-px bg-[linear-gradient(90deg,transparent,rgba(251,146,60,0.45),transparent)]" />
          <div className="praxis-intro-line-y absolute left-1/2 top-0 h-full w-px bg-[linear-gradient(180deg,transparent,rgba(251,146,60,0.28),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.3)_45%,rgba(0,0,0,0.84)_100%)]" />

          <div className="relative flex min-h-screen items-center justify-center px-4">
            {introStage === "idle" ? (
              <div className="praxis-intro-rise text-center">
                <p className="font-mono text-[0.82rem] uppercase tracking-[0.32em] text-zinc-500 sm:text-[0.96rem]">
                  Praxis Protocol // Access Handshake
                </p>
                <div className="mt-10">
                  <button
                    type="button"
                    onClick={startSequence}
                    className="group border border-amber-400/50 bg-[#121214] px-9 py-4 font-mono text-[0.94rem] font-semibold uppercase tracking-[0.24em] text-amber-300 shadow-[0_0_18px_rgba(251,146,60,0.18)] transition hover:border-amber-300 hover:bg-amber-400 hover:text-[#090909] hover:shadow-[0_0_28px_rgba(251,146,60,0.34)] sm:px-10 sm:py-5 sm:text-[1.04rem]"
                  >
                    Entrar no protocolo
                  </button>
                </div>
                <p className="mt-5 font-mono text-[0.82rem] uppercase tracking-[0.22em] text-zinc-400 sm:text-[0.92rem]">
                  (Toque para conectar)
                </p>
                <p className="mt-10 text-base text-zinc-400 sm:text-lg">
                  Para uma melhor experiência, aumente o volume.
                </p>
              </div>
            ) : null}

            {introStage === "loading" ? (
              <div className="praxis-intro-rise w-full max-w-3xl border border-zinc-800 bg-[#0f0f11]/95 p-6 sm:p-8">
                <div className="mb-8 space-y-2 font-mono text-[0.72rem] uppercase tracking-[0.22em] text-amber-300 sm:text-sm">
                  {bootChecks.slice(0, visibleCheckCount).map((line) => (
                    <p key={line} className="praxis-intro-flicker">
                      {line}
                    </p>
                  ))}
                </div>

                <div className="mb-4 flex items-end justify-between gap-4">
                  <p className="font-display text-2xl font-bold uppercase tracking-tight text-zinc-100 sm:text-4xl">
                    Carregando sistema
                  </p>
                  <p className="font-display text-3xl font-bold tracking-tight text-amber-300 sm:text-5xl">
                    {String(bootProgress).padStart(2, "0")}%
                  </p>
                </div>

                <div className="border border-zinc-800 bg-[#09090b] p-1">
                  <div
                    className="h-3 bg-[linear-gradient(90deg,#fb923c_0%,#fdba74_100%)] shadow-[0_0_18px_rgba(251,146,60,0.28)] transition-[width] duration-150"
                    style={{ width: `${bootProgress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {introStage === "alert" ? (
              <div className="praxis-intro-rise w-full max-w-2xl text-center">
                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center border border-amber-400/45 bg-amber-400/10 text-amber-300 shadow-[0_0_18px_rgba(251,146,60,0.18)]">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="border border-amber-400/40 bg-[#121214]/95 px-6 py-5">
                  <p className="font-display text-2xl font-bold uppercase tracking-tight text-amber-300 sm:text-4xl">
                    [ Alerta do sistema ]
                  </p>
                </div>
              </div>
            ) : null}

            {introStage === "player" ? (
              <div className="praxis-intro-rise w-full max-w-2xl">
                <pre className="whitespace-pre-wrap border border-zinc-800 bg-[#0f0f11]/95 p-6 text-left font-mono text-xl leading-[1.9] tracking-[0.08em] text-amber-300 sm:text-[1.85rem]">
                  {typedPlayerText}
                  <span className="animate-pulse">_</span>
                </pre>
              </div>
            ) : null}

            {introStage === "welcome" ? (
              <div className="praxis-intro-rise w-full px-4 text-center">
                <p className="mx-auto max-w-4xl font-display text-3xl font-bold uppercase leading-[0.94] tracking-tight text-zinc-100 sm:text-5xl md:text-6xl">
                  Bem-vindo ao seu
                  <span className="block text-amber-300">protocolo.</span>
                </p>
              </div>
            ) : null}

            {introStage === "chance" ? (
              <div className="praxis-intro-rise w-full px-4 text-center">
                <p className="mx-auto max-w-4xl font-display text-3xl font-bold uppercase leading-[0.94] tracking-tight text-zinc-100 sm:text-5xl md:text-6xl">
                  Recomeçar também
                  <span className="block text-amber-300">faz parte.</span>
                </p>
              </div>
            ) : null}

            {introStage === "awakening" ? (
              <div className="praxis-intro-rise w-full px-4 text-center">
                <div className="inline-flex max-w-4xl justify-center border border-amber-400/35 bg-[#121214]/95 px-6 py-5 shadow-[0_0_22px_rgba(251,146,60,0.16)] sm:px-8">
                  <p className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-tight text-amber-300 sm:text-4xl md:text-5xl">
                    Clareza carregada
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Discreet skip hint anchored to the bottom edge of the
              overlay. Hidden on the "idle" stage so the prompt only
              shows up once the animation is actually playing. */}
          {introStage !== "idle" ? (
            <p
              className="pointer-events-none absolute inset-x-0 bottom-4 text-center font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500 sm:bottom-6 sm:text-[0.7rem]"
              aria-hidden="true"
            >
              Toque na tela ou ESC para pular
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={`relative z-10 transition duration-700 ${
          introVisible ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <header className="sticky top-0 z-50 border-b border-zinc-800/90 bg-[rgba(5,5,5,0.88)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
            <button
              type="button"
              onClick={() => {
                handleButtonClick();
                setScene("nexus");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-4 text-left"
            >
              <div className="border border-zinc-700 bg-[#121214] p-2">
                <Image
                  src="/logo.png"
                  alt="Praxis Protocol"
                  width={34}
                  height={34}
                  className="h-[34px] w-[34px] object-contain"
                />
              </div>
              <div>
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-zinc-500">
                  Praxis Protocol
                </p>
              </div>
            </button>

            <ExecutionButton
              href="/auth/login"
              playSound={handleButtonClick}
              kind="primary"
            >
              Entrar
              <ArrowRight className="h-4 w-4" />
            </ExecutionButton>
          </div>
        </header>

        {scene === "nexus" ? (
          <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6 md:pt-14">
            <section className="grid items-center gap-10 xl:grid-cols-[1.04fr_0.96fr]">
              <ScrollReveal className="max-w-4xl space-y-8">
                <IdentityBlock
                  protocol="PROTOCOLO 01 // MENOS ATRITO"
                  title="Disciplina não nasce de motivação. Nasce de protocolo."
                  copy="O Praxis reduz o atrito entre intenção e execução. Treino, dieta, trabalho e rotina entram no mesmo fluxo para você depender menos do dia perfeito e mais do próximo passo."
                />

                <div className="flex flex-wrap gap-3">
                  <ExecutionButton onClick={openForge} playSound={handleButtonClick}>
                    Ver como o protocolo funciona
                    <ChevronRight className="h-4 w-4" />
                  </ExecutionButton>
                  <ExecutionButton
                    onClick={() => {
                      document
                        .getElementById("modules-overview")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    playSound={handleButtonClick}
                    kind="secondary"
                  >
                    Explorar módulos
                  </ExecutionButton>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {visualSignals.map((signal, index) => (
                    <ScrollReveal key={signal.label} delay={index * 90}>
                      <div className="praxis-panel p-4">
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
                        {signal.label}
                      </p>
                      <p className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-amber-300">
                        {signal.value}
                      </p>
                      <p className="mt-2 text-[0.95rem] leading-6 text-zinc-400">{signal.text}</p>
                    </div>
                    </ScrollReveal>
                  ))}
                </div>
              </ScrollReveal>

              <ScrollReveal
                className="praxis-panel praxis-panel-active praxis-scanlines relative overflow-hidden p-5 md:p-6"
                delay={140}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-amber-400/45 shadow-[0_0_16px_rgba(251,146,60,0.35)]" />
                <div className="absolute -right-20 top-10 h-52 w-52 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="absolute -left-12 bottom-4 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">
                        NÚCLEO DE SINCRONIA
                      </p>
                      <p className="mt-3 max-w-sm text-sm leading-7 text-zinc-400 md:text-[0.98rem]">
                        Prioridade, contexto e retomada ficam no mesmo núcleo
                        para você continuar sem recomeçar do zero.
                      </p>
                    </div>
                    <div className="border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-amber-300">
                      AO VIVO
                    </div>
                  </div>

                  <div className="mt-7 grid gap-6 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
                    <div className="flex justify-center lg:justify-start">
                      <div className="relative grid h-[15rem] w-[15rem] place-items-center md:h-[18rem] md:w-[18rem]">
                        <div className="absolute inset-0 rounded-full border border-amber-400/10" />
                        <div className="absolute inset-[12%] rounded-full border border-amber-400/10" />
                        <div className="absolute inset-[24%] rounded-full border border-cyan-300/10" />
                        <svg
                          viewBox="0 0 160 160"
                          className="h-full w-full -rotate-90"
                          aria-hidden="true"
                        >
                          <circle
                            cx="80"
                            cy="80"
                            r="58"
                            fill="none"
                            stroke="rgba(63,63,70,0.72)"
                            strokeWidth="8"
                          />
                          <circle
                            cx="80"
                            cy="80"
                            r="58"
                            fill="none"
                            stroke="rgba(251,146,60,0.95)"
                            strokeWidth="8"
                            strokeDasharray="364.4"
                            strokeDashoffset={syncStrokeOffset}
                            className="praxis-orbit-pulse transition-[stroke-dashoffset] duration-[1800ms] ease-out"
                          />
                          <circle
                            cx="80"
                            cy="80"
                            r="44"
                            fill="none"
                            stroke="rgba(125,211,252,0.18)"
                            strokeWidth="1.5"
                            strokeDasharray="4 6"
                          />
                        </svg>
                        <div className="absolute inset-0 grid place-items-center text-center">
                          <div className="space-y-3">
                            <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">
                              SINCRONIA
                            </p>
                            <p className="font-display text-5xl font-bold uppercase tracking-tight text-amber-300 md:text-6xl">
                              92%
                            </p>
                            <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">
                              PRAXIS CORE
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          label: "Constância protegida",
                          text: "Quando uma frente muda, o resto do sistema continua entendendo seu contexto.",
                        },
                        {
                          label: "Menos troca mental",
                          text: "A prioridade não se perde entre abas, ferramentas e telas soltas.",
                        },
                        {
                          label: "Retomada mais rápida",
                          text: "Se você sair do ritmo um dia, o app ajuda a voltar antes que isso vire padrão.",
                        },
                      ].map((item) => (
                        <div key={item.label} className="border border-zinc-800 bg-[#0b0b0d]/90 p-4">
                          <p className="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-amber-300">
                            {item.label}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">
                            {item.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </section>

            <section className="mt-12 border-y border-zinc-800 py-8">
              <ScrollReveal>
                <div className="grid gap-6 md:grid-cols-4 md:gap-8">
                  {communityStats.map((stat, index) => (
                    <ScrollReveal key={stat.label} delay={index * 70}>
                      <div className="text-center md:text-left">
                        <p className="font-display text-4xl font-bold uppercase tracking-tight text-amber-300 md:text-5xl">
                          <CountUpValue
                            value={stat.value}
                            decimals={stat.decimals}
                            suffix={stat.suffix}
                            delay={index * 240}
                          />
                        </p>
                        <p className="mt-2 text-[0.82rem] uppercase tracking-[0.14em] text-zinc-500 md:text-sm">
                          {stat.label}
                        </p>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              </ScrollReveal>
            </section>

            <section className="mt-16 grid gap-8 xl:grid-cols-[0.78fr_1.22fr]">
              <ScrollReveal className="border-l-2 border-amber-400 pl-4">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                  CICLO DE FRICÇÃO
                </p>
                <h2 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100 md:text-5xl">
                  Você não falha por falta de vontade.
                  <span className="block text-amber-300">Falha por excesso de atrito.</span>
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-400">
                  Quando cada meta mora em um app, toda execução começa com uma
                  nova negociação mental. O problema não é só organizar. É
                  conseguir repetir.
                </p>
              </ScrollReveal>

              <div className="grid gap-4 md:grid-cols-3">
                {frictionCycle.map((step, index) => (
                  <ScrollReveal key={step.day} delay={index * 90}>
                    <div className="praxis-panel p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-display text-xl font-semibold uppercase tracking-tight text-zinc-100">
                        {step.day}
                      </p>
                      <span className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                        LOOP
                      </span>
                    </div>
                    <p className="mt-5 font-display text-lg font-semibold uppercase tracking-tight text-zinc-100">
                      {step.title}
                    </p>
                    <p className="mt-3 text-[0.98rem] leading-7 text-zinc-400">
                      {step.text}
                    </p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </section>

            <section className="mt-16">
              <ScrollReveal className="praxis-panel p-6">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                  COMPARATIVO DIRETO
                </p>
                <h2 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100">
                  O caro não é só pagar vários apps.
                  <span className="block text-amber-300">É perder contexto entre eles.</span>
                </h2>

                <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-400">
                  A lógica é simples: quando sua rotina depende de vários apps
                  separados, você paga com assinatura, troca de contexto e
                  energia mental. O Praxis entra como um sistema único.
                </p>

                <div className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                  <div className="border border-zinc-800 bg-[#0b0b0d]">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-zinc-800 px-4 py-3 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-zinc-500 md:px-5">
                      <p>Módulo</p>
                      <p>App</p>
                      <p>Custo</p>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {comparisonApps.map((item, index) => (
                        <ScrollReveal key={item.app} delay={index * 50}>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-4 md:px-5">
                            <p className="font-display text-xl font-semibold uppercase tracking-tight text-zinc-100 md:text-2xl">
                              {item.module}
                            </p>
                            <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-zinc-400 md:text-[0.78rem]">
                              {item.app}
                            </p>
                            <p className="font-mono text-[0.78rem] uppercase tracking-[0.16em] text-amber-300 md:text-[0.9rem]">
                              {item.price}
                            </p>
                          </div>
                        </ScrollReveal>
                      ))}
                    </div>
                  </div>

                  <div className="praxis-panel praxis-panel-active p-5 md:p-6">
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-amber-300">
                      PRAXIS PRO
                    </p>
                    <p className="mt-4 font-display text-4xl font-bold uppercase tracking-tight text-zinc-100">
                      Tudo junto por
                      <span className="block text-amber-300">{publicBillingPlan.priceLabel}</span>
                    </p>

                    <div className="mt-6 space-y-3">
                      {[
                        "Treino, dieta, tarefas, trabalho, saúde, finanças e rotina no mesmo fluxo.",
                        "Menos troca de contexto entre apps e menos decisão repetida ao longo do dia.",
                        "Quando você pausa, o sistema facilita retomada antes que isso vire padrão.",
                      ].map((item) => (
                        <div key={item} className="border border-zinc-800 bg-[#0b0b0d] p-4">
                          <p className="text-sm leading-7 text-zinc-300">{item}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 border border-zinc-800 bg-[#0b0b0d] p-4">
                      <p className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-zinc-500">
                        economia real
                      </p>
                      <p className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100">
                        Mais barato que
                        <span className="block text-amber-300">montar tudo separado</span>
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </section>

            <section id="modules-overview" className="mt-16">
              <ScrollReveal className="border-l-2 border-amber-400 pl-4">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                  MÓDULOS INTEGRADOS
                </p>
                <h2 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100 md:text-5xl">
                  Tudo entra no mesmo protocolo.
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-400">
                  O Praxis junta as áreas que mais quebram sua rotina no mesmo
                  núcleo. Isso reduz troca de contexto, preserva energia mental
                  e facilita repetir o que importa.
                </p>
              </ScrollReveal>

              <div className="mt-8 grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {featuredModules.map((module, index) => {
                    const Icon = moduleIcons[module.id];
                    const visualState = moduleVisualState[module.id];

                    return (
                      <ScrollReveal key={module.id} delay={index * 70}>
                        <div className="praxis-panel p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="border border-amber-400/25 bg-amber-400/10 p-3 text-amber-300">
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="max-w-full text-right font-mono text-[0.58rem] uppercase tracking-[0.16em] text-zinc-500 sm:max-w-[9rem]">
                            {module.detail}
                          </p>
                        </div>
                        <p className="mt-5 font-display text-2xl font-semibold uppercase tracking-tight text-zinc-100">
                          {module.name}
                        </p>
                        <p className="mt-2 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                          {module.unitLabel}
                        </p>
                        {visualState ? (
                          <div className="mt-5">
                            <div className="mb-2 flex items-center justify-between gap-4">
                              <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-500">
                                {visualState.badge}
                              </p>
                              <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                                {visualState.progress}%
                              </p>
                            </div>
                            <div className="border border-zinc-800 bg-[#121214] p-1">
                              <div
                                className="h-2 bg-[linear-gradient(90deg,#fb923c_0%,#fdba74_100%)] shadow-[0_0_16px_rgba(251,146,60,0.28)] transition-all duration-700"
                                style={{ width: `${motionReady ? visualState.progress : 0}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      </ScrollReveal>
                    );
                  })}
                </div>

                <ScrollReveal className="praxis-panel praxis-panel-active p-5" delay={120}>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-amber-300">
                    MAIS MÓDULOS NO MESMO NÚCLEO
                  </p>
                  <p className="mt-4 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100">
                    Tudo conversa com a mesma leitura.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {compactModules.map((module, index) => {
                      const Icon = moduleIcons[module.id];
                      const visualState = moduleVisualState[module.id];

                      return (
                        <ScrollReveal key={module.id} delay={index * 50}>
                          <div className="border border-zinc-800 bg-[#0b0b0d] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Icon className="h-4 w-4 text-amber-300" />
                              <p className="font-display text-lg font-semibold uppercase tracking-tight text-zinc-100">
                                {module.name}
                              </p>
                            </div>
                            <p className="font-mono text-[0.52rem] uppercase tracking-[0.2em] text-zinc-600">
                              {visualState?.progress ?? "--"}%
                            </p>
                          </div>
                          <p className="mt-2 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-zinc-500">
                            {module.detail}
                          </p>
                        </div>
                        </ScrollReveal>
                      );
                    })}
                  </div>
                </ScrollReveal>
              </div>
            </section>

            <section ref={evolutionSectionRef} className="mt-16">
              <ScrollReveal className="mx-auto max-w-4xl text-center">
                <div className="inline-flex border border-amber-400/25 bg-amber-400/10 px-4 py-2 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-amber-300">
                  Identidade em construção
                </div>
                <h2 className="mt-6 font-display text-4xl font-bold uppercase tracking-tight text-zinc-100 md:text-6xl">
                  Consistência muda mais do que
                  <span className="text-amber-300"> intensidade</span>
                </h2>
                <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-zinc-400">
                  Quando a rotina para de depender de motivação, o progresso
                  fica visível. Não é sobre fazer tudo perfeito. É sobre não
                  deixar o protocolo quebrar por tempo demais.
                </p>
                <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 border border-zinc-800 bg-[#0d0d0f] p-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleButtonClick();
                      setOperatorGender("male");
                    }}
                    className={[
                      "inline-flex h-11 items-center gap-2 border px-4 font-mono text-[0.62rem] uppercase tracking-[0.22em] transition",
                      operatorGender === "male"
                        ? "border-amber-400 bg-amber-400/10 text-amber-300"
                        : "border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-200",
                    ].join(" ")}
                    aria-pressed={operatorGender === "male"}
                    aria-label="Mostrar transformação masculina"
                  >
                    <Mars className="h-4 w-4" />
                    <span>Masculino</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleButtonClick();
                      setOperatorGender("female");
                    }}
                    className={[
                      "inline-flex h-11 items-center gap-2 border px-4 font-mono text-[0.62rem] uppercase tracking-[0.22em] transition",
                      operatorGender === "female"
                        ? "border-amber-400 bg-amber-400/10 text-amber-300"
                        : "border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-200",
                    ].join(" ")}
                    aria-pressed={operatorGender === "female"}
                    aria-label="Mostrar transformação feminina"
                  >
                    <Venus className="h-4 w-4" />
                    <span>Feminino</span>
                  </button>
                </div>
              </ScrollReveal>

              <div className="mt-10 grid items-stretch gap-6 xl:grid-cols-3">
                <div className="grid gap-6 lg:grid-cols-2 xl:col-span-2 xl:grid-cols-2">
                  {evolutionSnapshots.map((snapshot, index) => (
                    <ScrollReveal key={snapshot.id} delay={index * 110} className="h-full">
                      <div
                        className={`praxis-panel flex h-full flex-col overflow-hidden p-5 ${
                          snapshot.id === "after" ? "praxis-panel-active" : ""
                        }`}
                      >
                      <div className="relative flex h-[420px] items-center justify-center overflow-hidden border border-zinc-800 bg-[#060606] p-2">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.1),transparent_52%)]" />
                        <Image
                          src={snapshot.image}
                          alt={snapshot.badge}
                          width={640}
                          height={820}
                          className="mx-auto h-full w-full object-cover object-top"
                        />
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-center">
                        <span
                          className={`border px-3 py-2 font-mono text-[0.58rem] uppercase tracking-[0.22em] ${
                            snapshot.id === "after"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                              : "border-zinc-700 bg-[#121214] text-zinc-300"
                          }`}
                        >
                          {snapshot.badge}
                        </span>
                      </div>

                      <div className="mt-5 text-center">
                        <p
                          className={`font-display text-5xl font-bold uppercase tracking-tight ${
                            snapshot.id === "after" ? "text-amber-300" : "text-zinc-100"
                          }`}
                        >
                          {snapshot.score}
                        </p>
                        <p className="mt-2 text-sm text-zinc-500">{snapshot.label}</p>
                      </div>

                      <div className="mt-6 space-y-3 text-center">
                        {snapshot.points.map((point) => (
                          <div key={point} className="flex items-center justify-center gap-3 text-center text-sm leading-7 text-zinc-300">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 ${
                                snapshot.id === "after" ? "bg-amber-300" : "bg-zinc-500"
                              }`}
                            />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>

                <ScrollReveal className="h-full" delay={120}>
                  <div className="praxis-panel praxis-panel-active flex h-full flex-col p-6">
                  <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                    <div className="text-center xl:text-left">
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-amber-300">
                        GRÁFICO DE PROGRESSÃO
                      </p>
                      <p className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100">
                        Ritmo que deixa de depender de vontade
                      </p>
                    </div>
                    <div className="border border-zinc-800 bg-[#0b0b0d] px-3 py-2 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-500">
                      66 DIAS
                    </div>
                  </div>

                  <div className="mt-6 border border-zinc-800 bg-[#09090b] p-4">
                    <svg
                      viewBox={`0 0 ${evolutionChart.width} ${evolutionChart.height}`}
                      className="h-[220px] w-full"
                      aria-hidden="true"
                    >
                      {Array.from({ length: 5 }).map((_, index) => {
                        const y = 20 + index * 35;
                        return (
                          <line
                            key={y}
                            x1="0"
                            y1={y}
                            x2={evolutionChart.width}
                            y2={y}
                            stroke="rgba(63,63,70,0.8)"
                            strokeWidth="1"
                          />
                        );
                      })}
                      <path
                        d={evolutionChart.area}
                        fill="url(#praxisArea)"
                        className="transition-opacity duration-1000"
                        style={{ opacity: evolutionSectionVisible ? 1 : 0 }}
                      />
                      <path
                        d={evolutionChart.line}
                        fill="none"
                        stroke="#fb923c"
                        strokeWidth="4"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        pathLength="1"
                        strokeDasharray="1"
                        strokeDashoffset={evolutionSectionVisible ? 0 : 1}
                        className="transition-[stroke-dashoffset] duration-[1800ms] ease-out"
                      />
                      {evolutionChart.points.map((point, index) => (
                        <circle
                          key={`${point.x}-${point.y}`}
                          cx={point.x}
                          cy={point.y}
                          r={index === evolutionChart.points.length - 1 ? 6 : 4.5}
                          fill={index === evolutionChart.points.length - 1 ? "#fdba74" : "#fb923c"}
                          className="transition-opacity duration-700"
                          style={{
                            opacity: evolutionSectionVisible ? 1 : 0,
                            transitionDelay: `${index * 70}ms`,
                          }}
                        />
                      ))}
                      <defs>
                        <linearGradient id="praxisArea" x1="0" y1="0" x2="0" y2={evolutionChart.height} gradientUnits="userSpaceOnUse">
                          <stop stopColor="#fb923c" stopOpacity="0.28" />
                          <stop offset="1" stopColor="#fb923c" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  <div className="mt-6 grid auto-rows-fr gap-3 sm:grid-cols-3">
                    {[
                      { label: "Rotina reativa", value: "3.4" },
                      { label: "Rotina em protocolo", value: "8.1" },
                      { label: "Mais constância", value: "+138%" },
                    ].map((item, index) => (
                      <ScrollReveal key={item.label} delay={index * 80}>
                        <div className="grid h-full min-h-[7rem] place-items-center border border-zinc-800 bg-[#0b0b0d] px-3 py-4 text-center">
                          <div className="flex max-w-[9.5rem] flex-col items-center justify-center gap-3">
                            <p className="font-mono text-[0.54rem] uppercase leading-[1.45] tracking-[0.18em] text-zinc-600">
                              {item.label}
                            </p>
                            <p className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-zinc-100">
                              {item.value}
                            </p>
                          </div>
                        </div>
                      </ScrollReveal>
                    ))}
                  </div>
                  </div>
                </ScrollReveal>
              </div>
            </section>

            <section className="mt-16 praxis-panel praxis-panel-active p-6 md:p-7">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="border-l-2 border-amber-400 pl-4">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                    EXPERIÊNCIA COMPLETA
                  </p>
                  <h2 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100 md:text-4xl">
                    Quer ver como isso funciona por dentro?
                  </h2>
                </div>
                <ExecutionButton onClick={openForge} playSound={handleButtonClick}>
                  Abrir a sequência completa
                  <ChevronRight className="h-4 w-4" />
                </ExecutionButton>
              </div>
            </section>
          </main>
        ) : null}

        {scene === "forge" ? (
          <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6">
            <Rail
              active={activeLevel}
              unlocked={unlockedLevel}
              onSelect={(level) => level <= unlockedLevel && setActiveLevel(level)}
              playSound={handleButtonClick}
            />

            <section key={activeLevel} className="animate-rise pt-12 md:pt-16">
              <div className="mx-auto max-w-6xl">
                <div className="max-w-4xl border-l-2 border-amber-400 pl-5">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                    Nível {activeLevel}
                    {" // "}
                    {levels[activeLevel - 1].title}
                  </p>
                  <h2 className="mt-4 font-display text-4xl font-bold uppercase tracking-tight text-zinc-100 md:text-6xl">
                    {activeLevel === 1 ? (
                      <>
                        Você não precisa de mais motivação.
                        <span className="block text-amber-300">
                          Precisa de menos atrito.
                        </span>
                      </>
                    ) : activeLevel === 2 ? (
                      <>
                        O protocolo tira a decisão
                        <span className="block text-amber-300">
                          da frente da execução.
                        </span>
                      </>
                    ) : activeLevel === 3 ? (
                      <>
                        A matriz escolhe
                        <span className="block text-amber-300">
                          onde insistir hoje.
                        </span>
                      </>
                    ) : activeLevel === 4 ? (
                      <>
                        Consistência parece pequena.
                        <span className="block text-amber-300">
                          O efeito acumulado não.
                        </span>
                      </>
                    ) : (
                      <>
                        Você não precisa de mais promessas.
                        <span className="block text-amber-300">
                          Precisa de um sistema que continue amanhã.
                        </span>
                      </>
                    )}
                  </h2>
                </div>

                {activeLevel === 1 ? (
                  <div className="mt-10 grid gap-5 lg:grid-cols-2">
                    <div className="praxis-panel p-7">
                      <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                        Aplicativos comuns
                      </p>
                      <p className="mt-4 font-display text-2xl font-semibold uppercase tracking-tight text-zinc-100">
                        Pedem esforço. Não criam aderência.
                      </p>
                      <div className="mt-6 space-y-4">
                        {outdatedSystem.map((item) => (
                          <div key={item} className="flex gap-3 text-sm leading-7 text-zinc-400">
                            <ShieldAlert className="mt-1 h-4 w-4 shrink-0 text-zinc-600" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="praxis-panel praxis-panel-active p-7">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-amber-300">
                          Praxis Protocol
                        </p>
                        <span className="border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                          Recomendado
                        </span>
                      </div>
                      <p className="mt-4 font-display text-2xl font-semibold uppercase tracking-tight text-zinc-100">
                        Reduz atrito para você repetir o que importa.
                      </p>
                      <div className="mt-6 space-y-4">
                        {praxisSystem.map((item) => (
                          <div key={item} className="flex gap-3 text-sm leading-7 text-zinc-300">
                            <Check className="mt-1 h-4 w-4 shrink-0 text-amber-300" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeLevel === 2 ? (
                  <div className="mt-10 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="praxis-panel praxis-panel-active p-7">
                      <div className="flex items-center gap-3 text-amber-300">
                        <Fingerprint className="h-5 w-5" />
                        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em]">
                          Coordenador central
                        </p>
                      </div>
                      <p className="mt-5 font-display text-3xl font-semibold uppercase tracking-tight text-zinc-100">
                        O Arquiteto devolve o próximo passo sem negociação.
                      </p>
                      <div className="mt-6 border border-zinc-800 bg-[#09090b] p-5">
                        <p className="font-mono text-[0.6rem] uppercase tracking-[0.26em] text-zinc-500">
                          MISSÃO DETECTADA
                        </p>
                        <p className="mt-4 text-sm leading-7 text-zinc-300">
                          Treino, dieta e trabalho precisam caber no dia sem
                          disputar energia mental.
                        </p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          {[
                            { label: "Ação", value: "1 PASSO" },
                            { label: "XP", value: "+40" },
                            { label: "Janela", value: "HOJE" },
                          ].map((item) => (
                            <div key={item.label} className="border border-zinc-800 bg-[#121214] p-4">
                              <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">
                                {item.label}
                              </p>
                              <p className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-amber-300">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {moduleCards.map((card) => {
                        const Icon = card.icon;

                        return (
                          <div key={card.title} className="praxis-panel p-5">
                            <div className="flex items-center justify-between gap-4">
                              <div className="border border-amber-400/25 bg-amber-400/10 p-3 text-amber-300">
                                <Icon className="h-5 w-5" />
                              </div>
                              <span className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">
                                {card.stat}
                              </span>
                            </div>
                            <p className="mt-5 font-display text-xl font-semibold uppercase tracking-tight text-zinc-100">
                              {card.title}
                            </p>
                            <p className="mt-3 text-sm leading-7 text-zinc-500">
                              {card.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {activeLevel === 3 ? (
                  <div className="mt-10 grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
                    <div className="space-y-3">
                      {intelCards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            handleButtonClick();
                            setIntelCardId(card.id);
                          }}
                          className={[
                            "w-full border p-5 text-left transition duration-200",
                            intelCardId === card.id
                              ? "border-amber-400 bg-[linear-gradient(180deg,rgba(251,146,60,0.12),rgba(18,18,20,0.96))] shadow-[0_0_18px_rgba(251,146,60,0.14)]"
                              : "border-zinc-800 bg-[#121214] hover:border-amber-400/35",
                          ].join(" ")}
                        >
                          <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-zinc-500">
                            MÓDULO
                          </p>
                          <p className="mt-3 font-display text-2xl font-semibold uppercase tracking-tight text-zinc-100">
                            {card.label}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-zinc-500">
                            {card.text}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="praxis-panel praxis-panel-active praxis-scanlines overflow-hidden p-7">
                      <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
                        <div>
                          <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-amber-300">
                            {currentIntel.note}
                          </p>
                          <p className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100">
                            {currentIntel.title}
                          </p>
                        </div>
                        <div className="border border-amber-400/25 bg-amber-400/10 px-3 py-2 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                          PRACTICE // LIVE
                        </div>
                      </div>

                      <p className="mt-6 max-w-3xl text-sm leading-8 text-zinc-300">
                        {currentIntel.text}
                      </p>

                      <div className="mt-7 grid gap-4 sm:grid-cols-3">
                        {currentIntel.metrics.map((metric) => (
                          <div key={metric.label} className="border border-zinc-800 bg-[#09090b] p-5">
                            <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">
                              {metric.label}
                            </p>
                            <p className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-amber-300">
                              {metric.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-7 border border-zinc-800 bg-[#0b0b0d] p-5">
                        <p className="font-mono text-[0.58rem] uppercase tracking-[0.24em] text-zinc-500">
                          VISÃO OPERACIONAL
                        </p>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="border border-zinc-800 bg-[#121214] p-4">
                            <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">
                              Leitura do dia
                            </p>
                            <p className="mt-3 text-sm leading-7 text-zinc-300">
                              Treino sobe porque está crítico, importante e com
                              janela aberta para hoje.
                            </p>
                          </div>
                          <div className="border border-zinc-800 bg-[#121214] p-4">
                            <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">
                              Resposta do protocolo
                            </p>
                            <p className="mt-3 text-sm leading-7 text-zinc-300">
                              A missão vem curta, clara e fácil de iniciar para
                              reduzir atrito antes da ação.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeLevel === 4 ? (
                  <div className="mt-10 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className="praxis-panel p-7">
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-zinc-500">
                        Evolução em 66 dias
                      </p>
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="border border-zinc-800 bg-[#09090b] p-5">
                          <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">
                            Dia 1
                          </p>
                          <p className="mt-3 font-display text-5xl font-bold uppercase tracking-tight text-zinc-100">
                            3.4
                          </p>
                          <p className="mt-3 text-sm text-zinc-500">
                            Rotina reativa, pouca clareza de prioridade e ritmo instável.
                          </p>
                        </div>
                        <div className="border border-amber-400/28 bg-amber-400/10 p-5">
                          <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                            Dia 66
                          </p>
                          <p className="mt-3 font-display text-5xl font-bold uppercase tracking-tight text-amber-300">
                            8.1
                          </p>
                          <p className="mt-3 text-sm text-zinc-300">
                            Protocolo estável, retomada rápida e progresso visível.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 border border-zinc-800 bg-[#0b0b0d] p-5">
                        <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-600">
                          ATRIBUTOS OBSERVADOS
                        </p>
                        <div className="mt-5 space-y-4">
                          {[
                            { label: "Força", width: "82%" },
                            { label: "Foco", width: "74%" },
                            { label: "Vitalidade", width: "68%" },
                          ].map((metric) => (
                            <div key={metric.label}>
                              <div className="mb-2 flex items-center justify-between gap-4">
                                <span className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-500">
                                  {metric.label}
                                </span>
                                <span className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                                  {metric.width}
                                </span>
                              </div>
                              <div className="border border-zinc-800 bg-[#121214] p-1">
                                <div
                                  className="h-2 bg-[linear-gradient(90deg,#fb923c_0%,#fdba74_100%)] shadow-[0_0_16px_rgba(251,146,60,0.28)]"
                                  style={{ width: metric.width }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="praxis-panel praxis-panel-active p-7">
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-amber-300">
                        Operadores em campo
                      </p>
                      <div className="mt-6 space-y-4">
                        {testimonials.map((item) => (
                          <div key={item.name} className="border border-zinc-800 bg-[#0b0b0d] p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-display text-xl font-semibold uppercase tracking-tight text-zinc-100">
                                  {item.name}
                                </p>
                                <p className="mt-1 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-amber-300">
                                  {item.level}
                                </p>
                              </div>
                              <Activity className="h-5 w-5 text-amber-300" />
                            </div>
                            <p className="mt-4 text-sm leading-8 text-zinc-300">
                              &ldquo;{item.text}&rdquo;
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeLevel === 5 ? (
                  <div className="mt-10 praxis-panel praxis-panel-active p-8 text-center md:p-10">
                    <div className="mx-auto grid h-16 w-16 place-items-center border border-amber-400/30 bg-amber-400/10 text-amber-300 shadow-[0_0_18px_rgba(251,146,60,0.16)]">
                      <Crown className="h-7 w-7" />
                    </div>
                    <p className="mt-6 font-mono text-[0.62rem] uppercase tracking-[0.28em] text-amber-300">
                      PRAXIS ID // ENTRADA NO PROTOCOLO
                    </p>
                    <h3 className="mx-auto mt-4 max-w-4xl font-display text-4xl font-bold uppercase tracking-tight text-zinc-100 md:text-6xl">
                      Pare de depender do dia perfeito
                      <span className="block text-amber-300">
                        para fazer o que importa.
                      </span>
                    </h3>

                    <div className="mt-8 grid gap-3 md:grid-cols-3">
                      {[
                        "Menos negociação mental no começo do dia",
                        "Mais clareza de prioridade em cada frente da vida",
                        "Um sistema para nunca falhar duas vezes seguidas",
                      ].map((item) => (
                        <div key={item} className="border border-zinc-800 bg-[#0b0b0d] p-4 text-left">
                          <p className="text-sm leading-7 text-zinc-300">{item}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 border border-amber-400/18 bg-[linear-gradient(180deg,rgba(251,146,60,0.06),rgba(8,8,9,0.98))] p-5 md:p-6">
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-amber-300">
                        Checkout Stripe
                      </p>
                      <p className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-zinc-100">
                        {publicBillingPlan.name}
                      </p>
                      <p className="mt-2 text-sm uppercase tracking-[0.18em] text-zinc-400">
                        {publicBillingPlan.priceLabel}
                      </p>
                      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                        Ative o Praxis, conclua sua identidade e entre no mesmo
                        protocolo em todos os seus dispositivos.
                      </p>
                      <div className="mt-5 flex justify-center">
                        <StripeCheckoutButton
                          source="landing-level-5"
                          className="w-full md:w-auto"
                          noteClassName="text-center"
                        >
                          Ativar com Stripe
                        </StripeCheckoutButton>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      <ExecutionButton
                        href="/auth/register"
                        playSound={handleButtonClick}
                        kind="secondary"
                      >
                        Criar minha conta
                      </ExecutionButton>
                      <ExecutionButton
                        href="/auth/login"
                        playSound={handleButtonClick}
                        kind="secondary"
                      >
                        Entrar no Praxis
                      </ExecutionButton>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-12 flex flex-col items-center gap-4">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex h-12 items-center gap-3 border border-zinc-800 bg-[#121214] px-5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {activeLevel === 1 ? "Voltar à entrada" : "Nível anterior"}
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex h-12 items-center gap-3 border border-amber-400 bg-amber-400 px-6 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#090909] shadow-[0_0_18px_rgba(251,146,60,0.3)] transition hover:bg-[#ffb16c] hover:shadow-[0_0_24px_rgba(251,146,60,0.42)]"
                  >
                    {activeLevel === 5 ? "Criar meu acesso" : "Continuar leitura"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-center font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">
                  {activeLevel === 5
                    ? "Você chegou ao último nível da apresentação."
                    : `Próximo bloco // ${levels[activeLevel].title}`}
                </p>
              </div>
            </section>
          </main>
        ) : null}

        <footer className="border-t border-zinc-800 bg-[#050505]/90">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:px-6">
            <div className="flex items-center gap-3 text-zinc-500">
              <Lock className="h-4 w-4 text-amber-300" />
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.24em]">
                {scene === "forge"
                  ? "SEQUÊNCIA EM NÍVEIS // VISUALIZAÇÃO OPERACIONAL"
                  : "CAMADA DE ENTRADA // TERMINAL PRAXIS"}
              </span>
            </div>

            <p className="font-mono text-[0.58rem] uppercase tracking-[0.26em] text-zinc-700">
              © 2026 Praxis Protocol. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
