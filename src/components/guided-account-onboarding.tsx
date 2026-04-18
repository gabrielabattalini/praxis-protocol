"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Brain,
  Briefcase,
  Check,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  House,
  MessageCircle,
  MoonStar,
  Pill,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  UserRound,
  Wallet,
} from "lucide-react";
import { moduleCatalog } from "@/lib/mock-data";
import type { ModuleId } from "@/lib/types";
import { cn } from "@/lib/utils";

type GuidedAccountOnboardingProps = {
  initialSelectedModules: ModuleId[];
  initialWhatsappNumber?: string;
  initialCharacterId?: string;
  initialRoomId?: string;
  completionLabel: string;
  onComplete: (payload: {
    selectedModules: ModuleId[];
    whatsappNumber?: string;
    whatsappSkipped?: boolean;
    selectedCharacterId?: string;
    selectedRoomId?: string;
  }) => void;
};

type CharacterOption = {
  id: string;
  name: string;
  role: string;
  gradient: string;
  iconBg: string;
};

type RoomOption = {
  id: string;
  name: string;
  detail: string;
  gradient: string;
  accent: string;
};

const moduleVisuals: Record<
  ModuleId,
  {
    icon: typeof Sparkles;
    border: string;
    iconWrap: string;
  }
> = {
  run: {
    icon: Activity,
    border: "border-cyan-500/40 bg-cyan-500/10",
    iconWrap: "bg-cyan-500/14 text-cyan-200",
  },
  workout: {
    icon: Dumbbell,
    border: "border-sky-500/40 bg-sky-500/10",
    iconWrap: "bg-sky-500/14 text-sky-200",
  },
  work: {
    icon: Briefcase,
    border: "border-indigo-500/40 bg-indigo-500/10",
    iconWrap: "bg-indigo-500/14 text-indigo-200",
  },
  nutrition: {
    icon: Sparkles,
    border: "border-orange-500/40 bg-orange-500/10",
    iconWrap: "bg-orange-500/14 text-orange-200",
  },
  finance: {
    icon: Wallet,
    border: "border-emerald-500/40 bg-emerald-500/10",
    iconWrap: "bg-emerald-500/14 text-emerald-200",
  },
  appearance: {
    icon: Sparkles,
    border: "border-pink-500/40 bg-pink-500/10",
    iconWrap: "bg-pink-500/14 text-pink-200",
  },
  recovery: {
    icon: HeartPulse,
    border: "border-teal-500/40 bg-teal-500/10",
    iconWrap: "bg-teal-500/14 text-teal-200",
  },
  health: {
    icon: Stethoscope,
    border: "border-lime-500/40 bg-lime-500/10",
    iconWrap: "bg-lime-500/14 text-lime-200",
  },
  mind: {
    icon: Brain,
    border: "border-violet-500/40 bg-violet-500/10",
    iconWrap: "bg-violet-500/14 text-violet-200",
  },
  sleep: {
    icon: MoonStar,
    border: "border-blue-500/40 bg-blue-500/10",
    iconWrap: "bg-blue-500/14 text-blue-200",
  },
  home: {
    icon: House,
    border: "border-amber-500/40 bg-amber-500/10",
    iconWrap: "bg-amber-500/14 text-amber-200",
  },
  market: {
    icon: ShoppingBasket,
    border: "border-yellow-500/40 bg-yellow-500/10",
    iconWrap: "bg-yellow-500/14 text-yellow-200",
  },
  supplements: {
    icon: Pill,
    border: "border-rose-500/40 bg-rose-500/10",
    iconWrap: "bg-rose-500/14 text-rose-200",
  },
};

const defaultStarterModules: ModuleId[] = [
  "nutrition",
  "workout",
  "finance",
  "mind",
  "sleep",
  "health",
];

const characterOptions: CharacterOption[] = [
  {
    id: "nova",
    name: "Nova",
    role: "Ágil, focada e orientada por rotina",
    gradient: "from-violet-600/30 via-fuchsia-500/18 to-slate-950",
    iconBg: "from-violet-500/30 to-fuchsia-500/18",
  },
  {
    id: "atlas",
    name: "Atlas",
    role: "Estrutura, execução e progressão constante",
    gradient: "from-amber-500/30 via-orange-500/18 to-slate-950",
    iconBg: "from-amber-500/30 to-orange-500/18",
  },
  {
    id: "echo",
    name: "Echo",
    role: "Clareza mental, consistência e presença",
    gradient: "from-sky-500/30 via-cyan-500/18 to-slate-950",
    iconBg: "from-sky-500/30 to-cyan-500/18",
  },
];

const roomOptions: RoomOption[] = [
  {
    id: "neon-suite",
    name: "Quarto Neon",
    detail: "Base visual para rotina, foco e evolução diária",
    gradient: "from-violet-500/30 via-indigo-500/18 to-slate-950",
    accent: "bg-violet-400/90",
  },
  {
    id: "minimal-core",
    name: "Core Minimal",
    detail: "Leitura limpa, ambiente calmo e tático",
    gradient: "from-cyan-500/24 via-slate-700/22 to-slate-950",
    accent: "bg-cyan-300/90",
  },
  {
    id: "warm-station",
    name: "Warm Station",
    detail: "Luz quente, progresso visível e atmosfera viva",
    gradient: "from-amber-500/30 via-orange-500/18 to-slate-950",
    accent: "bg-amber-300/90",
  },
];

function StepProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mx-auto flex w-full max-w-[420px] items-center gap-2">
      {Array.from({ length: 5 }, (_, index) => {
        const active = index <= currentStep;
        return (
          <div
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              active
                ? "bg-[linear-gradient(90deg,#8b5cf6,#7c3aed)] shadow-[0_0_18px_rgba(139,92,246,0.45)]"
                : "bg-slate-800",
            )}
          />
        );
      })}
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white transition-all sm:w-auto sm:min-w-[220px]",
        disabled
          ? "cursor-not-allowed bg-slate-800 text-slate-500"
          : "bg-[linear-gradient(90deg,#7c3aed,#8b5cf6)] shadow-[0_18px_40px_rgba(124,58,237,0.28)] hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(124,58,237,0.34)]",
      )}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function SecondaryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full min-w-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/85 px-6 py-4 text-base font-medium text-slate-300 transition hover:border-slate-500 hover:text-white sm:w-auto sm:min-w-[220px]"
    >
      {label}
    </button>
  );
}

export function GuidedAccountOnboarding({
  initialSelectedModules,
  initialWhatsappNumber,
  initialCharacterId,
  initialRoomId,
  completionLabel,
  onComplete,
}: GuidedAccountOnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>(
    initialSelectedModules.length ? initialSelectedModules : defaultStarterModules,
  );
  const [whatsappNumber, setWhatsappNumber] = useState(initialWhatsappNumber ?? "");
  const [whatsappSkipped, setWhatsappSkipped] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    initialCharacterId ?? characterOptions[1].id,
  );
  const [selectedRoomId, setSelectedRoomId] = useState(
    initialRoomId ?? roomOptions[0].id,
  );

  const selectedCharacter =
    characterOptions.find((option) => option.id === selectedCharacterId) ??
    characterOptions[1];
  const selectedRoom =
    roomOptions.find((option) => option.id === selectedRoomId) ?? roomOptions[0];
  const selectedModuleNames = useMemo(
    () =>
      moduleCatalog
        .filter((module) => selectedModules.includes(module.id))
        .map((module) => module.name),
    [selectedModules],
  );
  const stepLabels = ["Módulos", "WhatsApp", "Operador", "Base", "Resumo"];

  function toggleModule(moduleId: ModuleId) {
    setSelectedModules((current) =>
      current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId],
    );
  }

  function goToNextStep() {
    setStep((current) => Math.min(current + 1, 4));
  }

  function selectDefaultModules() {
    if (selectedModules.length === 0) {
      setSelectedModules(defaultStarterModules);
    }
  }

  function submit() {
    onComplete({
      selectedModules:
        selectedModules.length > 0 ? selectedModules : defaultStarterModules,
      whatsappNumber: whatsappNumber.trim() ? whatsappNumber.trim() : undefined,
      whatsappSkipped,
      selectedCharacterId,
      selectedRoomId,
    });
  }

  return (
    <div className="mx-auto flex min-h-[780px] w-full max-w-6xl items-center justify-center px-4 py-6">
      <div className="relative w-full overflow-hidden rounded-[32px] border border-slate-800 bg-[linear-gradient(180deg,rgba(9,12,24,0.98),rgba(4,6,14,0.99))] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_24%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:52px_52px]" />

        <div className="relative grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-slate-800/80 px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r">
            <Image
              src="/logo.png"
              alt="Praxis Protocol"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <div className="mt-8 max-w-xl">
              <p className="praxis-label text-[var(--accent)]">Ativação guiada</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Monte sua base em poucos passos.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-400 sm:text-lg">
                Escolha o que importa agora, ative seus canais e personalize a
                experiência para o seu dia a dia.
              </p>
            </div>

            <div className="mt-8">
              <StepProgress currentStep={step} />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {stepLabels.map((label, index) => {
                const active = index === step;
                const done = index < step;

                return (
                  <div
                    key={label}
                    className={cn(
                      "rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition",
                      active
                        ? "border-[rgba(251,146,60,0.32)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                        : done
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-800 bg-slate-950/70 text-slate-500",
                    )}
                  >
                    {index + 1}. {label}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
                <p className="praxis-label text-[var(--accent)]">Resumo</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {selectedModules.length} módulos ativos
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {selectedModuleNames.slice(0, 3).join(" • ") ||
                    "Sem módulos escolhidos ainda"}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
                <p className="praxis-label text-[var(--accent)]">Conta</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Fluxo personalizado
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  WhatsApp, operador e base ficam vinculados à sua conta.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-10">
            <div className="mx-auto flex max-w-2xl flex-col gap-6">
              {step === 0 ? (
                <>
                  <div className="text-center">
                    <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      Quais frentes você quer organizar?
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                      Selecione os módulos que entram primeiro no seu painel.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    {moduleCatalog.map((module) => {
                      const visual = moduleVisuals[module.id];
                      const Icon = visual.icon;
                      const active = selectedModules.includes(module.id);

                      return (
                        <button
                          key={module.id}
                          type="button"
                          onClick={() => toggleModule(module.id)}
                          className={cn(
                            "flex w-full items-center gap-4 rounded-[24px] border px-4 py-4 text-left transition-all",
                            active
                              ? cn(
                                  "bg-slate-900/95 shadow-[0_16px_42px_rgba(15,23,42,0.34)]",
                                  visual.border,
                                )
                              : "border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900/80",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                              active ? visual.iconWrap : "bg-slate-800 text-slate-400",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold text-white sm:text-lg">
                              {module.name}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-400">
                              {module.description}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all",
                              active
                                ? "border-violet-400 bg-violet-500 text-white shadow-[0_0_18px_rgba(139,92,246,0.42)]"
                                : "border-slate-700 bg-slate-900 text-slate-500",
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <SecondaryButton
                      label="Pular"
                      onClick={() => {
                        setSelectedModules(defaultStarterModules);
                        goToNextStep();
                      }}
                    />
                    <PrimaryButton
                      label="Continuar"
                      onClick={() => {
                        selectDefaultModules();
                        goToNextStep();
                      }}
                    />
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div className="text-center">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_35px_rgba(16,185,129,0.18)]">
                      <MessageCircle className="h-9 w-9" />
                    </div>
                    <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      Ative lembretes no WhatsApp
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                      Receba check-ins, hábitos e eventos no canal que você já usa.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                    <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
                      <label className="block text-sm font-medium text-slate-300">
                        Número de WhatsApp
                      </label>
                      <div className="mt-3 flex gap-3">
                        <div className="flex h-14 items-center rounded-2xl border border-slate-700 bg-slate-900 px-5 text-slate-400">
                          BR +55
                        </div>
                        <input
                          value={whatsappNumber}
                          onChange={(event) => {
                            setWhatsappSkipped(false);
                            setWhatsappNumber(event.target.value.replace(/[^\d]/g, ""));
                          }}
                          inputMode="numeric"
                          placeholder="11999999999"
                          className="h-14 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-5 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400"
                        />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        Você pode ativar depois em Configurações sem perder o fluxo.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
                      <p className="praxis-label text-[var(--accent)]">Prévia</p>
                      <div className="mt-4 space-y-3">
                        {[
                          "Check-in diário",
                          "Resumo do dia",
                          "Lembretes de hábitos",
                          "Eventos importantes",
                        ].map((item) => (
                          <div
                            key={item}
                            className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            <span className="text-sm text-slate-200">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <SecondaryButton
                      label="Configurar depois"
                      onClick={() => {
                        setWhatsappSkipped(true);
                        setWhatsappNumber("");
                        goToNextStep();
                      }}
                    />
                    <PrimaryButton
                      label="Continuar"
                      onClick={() => {
                        setWhatsappSkipped(!whatsappNumber.trim());
                        goToNextStep();
                      }}
                    />
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="text-center">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 shadow-[0_0_35px_rgba(139,92,246,0.18)]">
                      <UserRound className="h-9 w-9" />
                    </div>
                    <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      Escolha seu operador
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                      Ele define o tom visual da conta e pode ser trocado depois.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {characterOptions.map((option) => {
                      const active = option.id === selectedCharacterId;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedCharacterId(option.id)}
                          className={cn(
                            "overflow-hidden rounded-[24px] border text-left transition-all",
                            active
                              ? "border-violet-400 bg-slate-900 shadow-[0_18px_44px_rgba(139,92,246,0.25)]"
                              : "border-slate-800 bg-slate-900/70 hover:border-slate-600",
                          )}
                        >
                          <div
                            className={cn(
                              "relative h-56 bg-gradient-to-br p-5",
                              option.gradient,
                            )}
                          >
                            <span className="inline-flex rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white">
                              Grátis
                            </span>
                            <div className="absolute inset-x-0 bottom-5 flex justify-center">
                              <div
                                className={cn(
                                  "grid h-28 w-28 place-items-center rounded-full border border-white/12 bg-gradient-to-br text-white shadow-[0_12px_36px_rgba(15,23,42,0.45)]",
                                  option.iconBg,
                                )}
                              >
                                <UserRound className="h-12 w-12" />
                              </div>
                            </div>
                            {active ? (
                              <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-violet-500 text-white">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : null}
                          </div>
                          <div className="px-5 py-5">
                            <p className="text-2xl font-semibold text-white">{option.name}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {option.role}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <SecondaryButton label="Pular" onClick={goToNextStep} />
                    <PrimaryButton label="Escolher" onClick={goToNextStep} />
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div className="text-center">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 shadow-[0_0_35px_rgba(14,165,233,0.18)]">
                      <House className="h-9 w-9" />
                    </div>
                    <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      Escolha sua base
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                      O primeiro quarto dá contexto visual ao progresso da conta.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {roomOptions.map((room) => {
                      const active = room.id === selectedRoomId;

                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => setSelectedRoomId(room.id)}
                          className={cn(
                            "overflow-hidden rounded-[24px] border text-left transition-all",
                            active
                              ? "border-violet-400 bg-slate-900 shadow-[0_18px_44px_rgba(139,92,246,0.25)]"
                              : "border-slate-800 bg-slate-900/70 hover:border-slate-600",
                          )}
                        >
                          <div
                            className={cn(
                              "relative h-56 overflow-hidden bg-gradient-to-br p-5",
                              room.gradient,
                            )}
                          >
                            <div className="absolute left-5 top-5 flex items-center gap-2">
                              <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white">
                                Grátis
                              </span>
                            </div>
                            <div className="absolute inset-x-6 bottom-6 rounded-[28px] border border-white/10 bg-black/22 p-4 backdrop-blur-sm">
                              <div className="grid grid-cols-3 gap-2">
                                <div className={cn("h-14 rounded-2xl", room.accent)} />
                                <div className="h-14 rounded-2xl bg-white/12" />
                                <div className="h-14 rounded-2xl bg-white/8" />
                              </div>
                            </div>
                            {active ? (
                              <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-violet-500 text-white">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : null}
                          </div>
                          <div className="px-5 py-5">
                            <p className="text-2xl font-semibold text-white">{room.name}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {room.detail}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <SecondaryButton label="Pular" onClick={goToNextStep} />
                    <PrimaryButton label="Escolher" onClick={goToNextStep} />
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className="text-center">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 shadow-[0_0_35px_rgba(139,92,246,0.18)]">
                      <ShieldCheck className="h-9 w-9" />
                    </div>
                    <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      Tudo pronto
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                      Sua base inicial foi configurada e vinculada à sua conta.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      "Conta autenticada",
                      `${selectedModules.length} módulos selecionados`,
                      `Operador: ${selectedCharacter.name}`,
                      `Base: ${selectedRoom.name}`,
                      `WhatsApp ${whatsappNumber.trim() ? "configurado" : "para depois"}`,
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-[22px] border border-slate-800 bg-slate-900/80 px-5 py-4"
                      >
                        <Check className="h-5 w-5 text-emerald-400" />
                        <span className="text-base text-white sm:text-lg">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center pt-2">
                    <PrimaryButton label={completionLabel} onClick={submit} />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
