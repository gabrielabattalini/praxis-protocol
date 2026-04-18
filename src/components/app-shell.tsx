"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Brain,
  Briefcase,
  CalendarDays,
  Crown,
  Dumbbell,
  Gauge,
  HeartPulse,
  House,
  ListTodo,
  Medal,
  MoonStar,
  Pill,
  Shield,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  Sword,
  TimerReset,
  UserRound,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BodyMetricsOnboarding } from "@/components/body-metrics-onboarding";
import { GuidedAccountOnboarding } from "@/components/guided-account-onboarding";
import { LifeAreaProfileEditor } from "@/components/life-area-profile-editor";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  useAuthClient,
  useClerkClient,
  useUserClient,
} from "@/components/providers/auth-client-provider";
import { NavigationLoadingOverlay } from "@/components/ui/navigation-loading-overlay";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { moduleCatalog } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/dashboard", label: "Painel", icon: House },
  { href: "/tasks", label: "Tarefas", icon: ListTodo },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tools", label: "Ferramentas", icon: TimerReset },
  { href: "/arena", label: "Arena", icon: Sword },
  { href: "/ranking", label: "Ranking", icon: Medal },
  { href: "/profile", label: "Perfil", icon: UserRound },
];

const desktopLinks = [
  { href: "/dashboard", label: "Painel", icon: Gauge },
  { href: "/tasks", label: "Tarefas", icon: ListTodo },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tools", label: "Ferramentas", icon: TimerReset },
  { href: "/arena", label: "Arena", icon: Shield },
  { href: "/achievements", label: "Conquistas", icon: Crown },
  { href: "/ranking", label: "Ranking", icon: Medal },
  { href: "/settings", label: "Configurações", icon: Sparkles },
  { href: "/profile", label: "Perfil", icon: UserRound },
];

const moduleIcons = {
  run: Activity,
  workout: Dumbbell,
  work: Briefcase,
  nutrition: Sparkles,
  finance: Wallet,
  appearance: Sparkles,
  recovery: HeartPulse,
  health: Stethoscope,
  mind: Brain,
  sleep: MoonStar,
  home: House,
  market: ShoppingBasket,
  supplements: Pill,
};

function normalizePath(path: string) {
  if (path === "/") return "/";
  return path.replace(/\/+$/, "");
}

function routeTitle(pathname: string) {
  if (pathname.startsWith("/modules/run")) return "Corrida";
  if (pathname.startsWith("/modules/workout")) return "Treino";
  if (pathname.startsWith("/modules/work")) return "Trabalho";
  if (pathname.startsWith("/modules/nutrition")) return "Dieta";
  if (pathname.startsWith("/modules/finance")) return "Finanças";
  if (pathname.startsWith("/modules/appearance")) return "Aparência";
  if (pathname.startsWith("/modules/recovery")) return "Recuperação";
  if (pathname.startsWith("/modules/health")) return "Saúde";
  if (pathname.startsWith("/modules/mind")) return "Mente";
  if (pathname.startsWith("/modules/sleep")) return "Sono";
  if (pathname.startsWith("/modules/home")) return "Casa";
  if (pathname.startsWith("/modules/market")) return "Mercado";
  if (pathname.startsWith("/modules/supplements")) return "Suplementos / Remédios";
  if (pathname.startsWith("/tools")) return "Ferramentas";
  if (pathname.startsWith("/tasks")) return "Tarefas";
  if (pathname.startsWith("/agenda")) return "Agenda";
  if (pathname.startsWith("/arena")) return "Arena";
  if (pathname.startsWith("/friends")) return "Amigos";
  if (pathname.startsWith("/achievements")) return "Conquistas";
  if (pathname.startsWith("/profile")) return "Perfil";
  if (pathname.startsWith("/ranking")) return "Ranking";
  if (pathname.startsWith("/settings")) return "Configurações";
  return "Painel";
}

function headerProtocol(pathname: string) {
  if (pathname.startsWith("/modules/")) return "Módulo tático";
  if (pathname.startsWith("/tasks")) return "Fila operacional";
  if (pathname.startsWith("/agenda")) return "Linha do tempo";
  if (pathname.startsWith("/tools")) return "Utilitários";
  if (pathname.startsWith("/arena")) return "Zona competitiva";
  if (pathname.startsWith("/achievements")) return "Registro de méritos";
  if (pathname.startsWith("/ranking")) return "Leitura global";
  if (pathname.startsWith("/profile")) return "Identidade";
  if (pathname.startsWith("/settings")) return "Configuração";
  return "Núcleo central";
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <Link
      href={href}
      onClick={(event) => onNavigate?.(event, href)}
      className={cn(
        "group praxis-copy flex min-w-0 items-center gap-3 rounded-sm border px-4 py-3 text-sm transition-all",
        active
          ? "praxis-accent-panel text-zinc-100"
          : "border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,20,0.96),rgba(10,10,12,0.98))] text-zinc-400 hover:border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] hover:text-zinc-100",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-sm border transition-colors",
          active
            ? "praxis-accent-chip"
            : "border-zinc-800 bg-black/50 text-zinc-500 group-hover:text-[var(--accent)]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded: authLoaded, isSignedIn } = useAuthClient();
  const { signOut } = useClerkClient();
  const { user: clerkUser } = useUserClient();
  const { hydrated, state, user, actions } = useAppStore();
  const [navigationPending, setNavigationPending] = useState(false);
  const [navigationMessage, setNavigationMessage] = useState("Carregando");
  const [isModuleOrderEditing, setIsModuleOrderEditing] = useState(false);
  const effectiveAuthLoaded = isLocalAuthBypassEnabled ? true : authLoaded;
  const effectiveSignedIn = isLocalAuthBypassEnabled ? true : isSignedIn;
  const shouldShowAccountOnboarding = effectiveSignedIn && !isLocalAuthBypassEnabled;
  const previousPathnameRef = useRef(pathname);
  const orderedModules = state.settings.moduleOrder
    .map((moduleId) => moduleCatalog.find((module) => module.id === moduleId))
    .filter((module): module is (typeof moduleCatalog)[number] => Boolean(module));
  const visibleModules = orderedModules.filter(
    (module) => state.settings.activeModules[module.id],
  );

  const displayName =
    clerkUser?.fullName ?? clerkUser?.firstName ?? user.name ?? "Operador Praxis";
  const avatarLabel =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment: string) => segment[0])
      .join("")
      .toUpperCase() || "PP";

  const needsLifeAreaSetup =
    hydrated && shouldShowAccountOnboarding && !state.lifeAreaProfile.completedAt;
  const needsBodyMetricsSetup =
    hydrated && shouldShowAccountOnboarding && !state.bodyMetricsProfile.completedAt;
  const needsGuidedOnboarding =
    hydrated && shouldShowAccountOnboarding && !state.guidedOnboarding.completedAt;

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;

      const timeout = window.setTimeout(() => {
        setNavigationPending(false);
        setNavigationMessage("Carregando");
      }, 180);

      return () => window.clearTimeout(timeout);
    }

    previousPathnameRef.current = pathname;
    return undefined;
  }, [pathname]);

  useEffect(() => {
    if (!navigationPending) return undefined;

    const safeguard = window.setTimeout(() => {
      setNavigationPending(false);
      setNavigationMessage("Carregando");
    }, 12000);

    return () => window.clearTimeout(safeguard);
  }, [navigationPending]);

  const beginNavigation = (targetHref: string, label?: string) => {
    if (normalizePath(targetHref) === normalizePath(pathname)) return;

    setNavigationMessage(label ? `Carregando ${label.toLowerCase()}` : "Carregando");
    setNavigationPending(true);
  };

  const shouldHandleNavigationClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) =>
    !(
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );

  if (!effectiveAuthLoaded || !hydrated) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background)] px-6 text-zinc-100">
        <div className="praxis-panel praxis-scanlines flex w-full max-w-md flex-col items-center gap-4 rounded-sm px-8 py-10 text-center">
          <div className="praxis-accent-chip grid h-14 w-14 place-items-center rounded-sm border">
            <Shield className="h-6 w-6 animate-pulse" />
          </div>
          <p className="praxis-label text-[var(--accent)]">Sincronização</p>
          <h1 className="praxis-title text-3xl">Aguardando autenticação do protocolo</h1>
          <p className="max-w-sm text-sm leading-6 text-zinc-500">
            O núcleo do sistema está carregando identidade, progresso e módulos ativos.
          </p>
        </div>
      </div>
    );
  }

  if (!effectiveSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-zinc-100">
      {navigationPending ? (
        <NavigationLoadingOverlay
          message={navigationMessage}
          detail="Aguarde enquanto o sistema conclui a mudança de página."
        />
      ) : null}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="praxis-shell-backdrop absolute inset-0" />
        <div className="absolute inset-0 praxis-tech-grid opacity-[0.08]" />
        <div className="absolute inset-0 praxis-scanlines opacity-20" />
      </div>

      {needsGuidedOnboarding ? (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-[rgba(5,5,5,0.86)] px-4 py-6 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl rounded-sm border border-zinc-800 bg-[rgba(5,5,5,0.96)] p-2 shadow-[0_24px_90px_rgba(0,0,0,0.55)] md:p-4">
            <GuidedAccountOnboarding
              initialSelectedModules={
                state.guidedOnboarding.selectedModules.length
                  ? state.guidedOnboarding.selectedModules
                  : visibleModules.map((module) => module.id)
              }
              initialWhatsappNumber={state.guidedOnboarding.whatsappNumber}
              initialCharacterId={state.guidedOnboarding.selectedCharacterId}
              initialRoomId={state.guidedOnboarding.selectedRoomId}
              completionLabel={
                needsBodyMetricsSetup || needsLifeAreaSetup
                  ? "Continuar configuração"
                  : "Entrar no sistema"
              }
              onComplete={(payload) => actions.saveGuidedOnboarding(payload)}
            />
          </div>
        </div>
      ) : needsBodyMetricsSetup ? (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-[rgba(5,5,5,0.86)] px-4 py-6 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl rounded-sm border border-zinc-800 bg-[rgba(5,5,5,0.96)] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
              <BodyMetricsOnboarding
              initialHeightCm={state.personalProfile.bodyHeightCm}
              initialWeightKg={state.personalProfile.bodyWeightKg}
              onSave={({ heightCm, weightKg }) => {
                actions.updatePersonalProfile({
                  ageYears: state.personalProfile.ageYears,
                  bodyHeightCm: heightCm,
                  bodyWeightKg: weightKg,
                  biologicalSex: state.personalProfile.biologicalSex,
                  restingHeartRateBpm: state.personalProfile.restingHeartRateBpm,
                  activityLevel: state.personalProfile.activityLevel,
                  cardioGoal: state.personalProfile.cardioGoal,
                  preferredCardio: state.personalProfile.preferredCardio,
                  hasCardiovascularCondition:
                    state.personalProfile.hasCardiovascularCondition,
                  hasJointLimitation: state.personalProfile.hasJointLimitation,
                  usesHeartRateMedication:
                    state.personalProfile.usesHeartRateMedication,
                  notes: state.personalProfile.notes,
                });
                actions.updateNutritionTargets({
                  bodyWeightKg: weightKg,
                  bodyHeightCm: heightCm,
                  ageYears: state.dailyNutritionTargets.ageYears,
                  biologicalSex: state.dailyNutritionTargets.biologicalSex,
                  waterMlPerKg: state.dailyNutritionTargets.perKg.waterMl,
                  proteinPerKg: state.dailyNutritionTargets.perKg.protein,
                  carbsPerKg: state.dailyNutritionTargets.perKg.carbs,
                  fatPerKg: state.dailyNutritionTargets.perKg.fat,
                  fiberStrategy: state.dailyNutritionTargets.fiberStrategy,
                  fiberPerKg: state.dailyNutritionTargets.fiberPerKg,
                  fiberRatioGrams: state.dailyNutritionTargets.fiberRatioGrams,
                  fiberRatioCalories: state.dailyNutritionTargets.fiberRatioCalories,
                  sodiumTargetMg: state.dailyNutritionTargets.sodiumTargetMg,
                  targetWeightKg: weightKg,
                  weeklyChangeKg:
                    state.dailyNutritionTargets.weightGoal.weeklyChangeKg,
                  basalMetabolicRate:
                    state.dailyNutritionTargets.basalMetabolicRateSource === "manual"
                      ? state.dailyNutritionTargets.basalMetabolicRate
                      : undefined,
                  basalMetabolicRateSource:
                    state.dailyNutritionTargets.basalMetabolicRateSource,
                });
                actions.completeBodyMetricsSetup();
              }}
              onSkip={() => actions.completeBodyMetricsSetup({ skipped: true })}
            />
          </div>
        </div>
      ) : needsLifeAreaSetup ? (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-[rgba(5,5,5,0.86)] px-4 py-6 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl rounded-sm border border-zinc-800 bg-[rgba(5,5,5,0.96)] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <LifeAreaProfileEditor
              key={JSON.stringify(state.lifeAreaProfile.areas)}
              title="Prioridades de evolução"
              description="Antes de começar, defina a prioridade e o nível atual de cada área da vida. O sistema usa isso para valorizar mais as tarefas onde existe necessidade real de evolução."
              initialAreas={state.lifeAreaProfile.areas}
              moduleIds={
                state.guidedOnboarding.selectedModules.length
                  ? state.guidedOnboarding.selectedModules
                  : visibleModules.map((module) => module.id)
              }
              onSave={(areas) => actions.saveLifeAreaProfile(areas)}
              onSkip={() => actions.saveLifeAreaProfile(state.lifeAreaProfile.areas)}
              saveLabel="Salvar prioridades e entrar"
            />
          </div>
        </div>
      ) : null}

      <div className="relative mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-[320px] shrink-0 border-r border-zinc-900/90 px-6 py-6 lg:flex lg:flex-col">
          <div className="praxis-panel praxis-scanlines rounded-sm p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Praxis Protocol"
                  width={24}
                  height={24}
                  className="h-6 w-auto"
                />
              </div>
              <span className="praxis-label text-[var(--accent)]">Online</span>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="praxis-accent-chip grid h-16 w-16 shrink-0 place-items-center rounded-sm border font-title text-lg font-bold">
                {avatarLabel}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-zinc-100">
                  {displayName}
                </p>
                <p className="mt-1 text-sm text-zinc-500">Identidade ativa</p>
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
                  Rank {user.rankTier}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="praxis-kpi p-3">
                <p className="praxis-label">Nível</p>
                <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                  {user.level}
                </p>
              </div>
              <div className="praxis-kpi p-3">
                <p className="praxis-label">Sequência</p>
                <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                  {user.streak}
                </p>
              </div>
            </div>

            <div className="mt-5 praxis-kpi p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="praxis-label">Carga de XP</p>
                <span className="text-xs text-zinc-500">
                  {user.isMaxLevel ? "MAX" : `${user.xp}/${user.xpToNextLevel}`}
                </span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-[2px] border border-zinc-800 bg-black/70">
                <div
                  className="praxis-accent-progress h-full rounded-[1px] transition-all"
                  style={{
                    width: `${user.isMaxLevel ? 100 : (user.xp / Math.max(1, user.xpToNextLevel)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="praxis-label mb-3">Navegação</p>
            <nav className="space-y-2">
              {desktopLinks.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname === item.href}
                  onNavigate={(event, href) => {
                    if (!shouldHandleNavigationClick(event)) {
                      return;
                    }

                    beginNavigation(href, item.label);
                  }}
                />
              ))}
            </nav>
          </div>

          <div className="mt-8 flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="praxis-label">Módulos ativos</p>
              <button
                type="button"
                onClick={() => setIsModuleOrderEditing((current) => !current)}
                className={cn(
                  "rounded-sm border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition",
                  isModuleOrderEditing
                    ? "border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                    : "border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
                )}
              >
                {isModuleOrderEditing ? "Concluir ordem" : "Ordenar módulos"}
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1">
              {visibleModules.length ? (
                visibleModules.map((module, index) => {
                  const Icon = moduleIcons[module.id];
                  const active = pathname.startsWith(module.route);
                  const cardContent = (
                    <div
                      className={cn(
                        "praxis-panel group rounded-sm p-4 transition",
                        active
                          ? "praxis-accent-panel"
                          : "hover:border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)]",
                        isModuleOrderEditing ? "pr-3" : "",
                      )}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-sm border transition",
                              active
                                ? "praxis-accent-chip"
                                : "border-zinc-800 bg-black/60 text-zinc-400 group-hover:border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] group-hover:text-[var(--accent)]",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "truncate text-sm font-medium",
                                active ? "text-[var(--accent)]" : "text-zinc-100",
                              )}
                            >
                              {module.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                              {module.detail}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          {active ? (
                            <span className="praxis-label shrink-0 text-[10px] text-[var(--accent)]">
                              ativo
                            </span>
                          ) : null}
                          {isModuleOrderEditing ? (
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() =>
                                  actions.reorderModule({
                                    moduleId: module.id,
                                    direction: "up",
                                  })
                                }
                                className="grid h-7 w-7 place-items-center rounded-sm border border-zinc-800 bg-black/60 text-zinc-300 transition disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label={`Mover ${module.name} para cima`}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === visibleModules.length - 1}
                                onClick={() =>
                                  actions.reorderModule({
                                    moduleId: module.id,
                                    direction: "down",
                                  })
                                }
                                className="grid h-7 w-7 place-items-center rounded-sm border border-zinc-800 bg-black/60 text-zinc-300 transition disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label={`Mover ${module.name} para baixo`}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );

                  return isModuleOrderEditing ? (
                    <div key={module.id}>{cardContent}</div>
                  ) : (
                    <Link
                      key={module.id}
                      href={module.route}
                      onClick={(event) => {
                        if (!shouldHandleNavigationClick(event)) {
                          return;
                        }

                        beginNavigation(module.route, module.name);
                      }}
                    >
                      {cardContent}
                    </Link>
                  );
                })
              ) : (
                <div className="praxis-panel rounded-sm border-dashed px-4 py-5 text-sm text-zinc-500">
                  Nenhum módulo visível. Ative módulos em Configurações.
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-zinc-900 bg-[rgba(5,5,5,0.88)] px-4 py-3 backdrop-blur-2xl md:px-6 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="praxis-label text-[var(--accent)]">
                  {headerProtocol(pathname)}
                </p>
                <h2 className="praxis-title mt-2 truncate text-2xl md:text-3xl">
                  {routeTitle(pathname)}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:gap-3">
                <div className="hidden rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 md:block">
                  <p className="praxis-label">XP</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {user.isMaxLevel
                      ? `Nível ${user.level} MAX`
                      : `${user.xp}/${user.xpToNextLevel}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNavigationMessage("Encerrando sessão");
                    setNavigationPending(true);
                    void signOut({ redirectUrl: "/auth/login" });
                  }}
                  className="praxis-button-ghost px-3 py-2"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          <main className="relative flex-1 px-4 pb-28 pt-6 md:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl min-w-0">{children}</div>
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-900 bg-[rgba(5,5,5,0.9)] px-2 py-2 backdrop-blur-2xl lg:hidden">
            <div className="grid grid-cols-7 gap-1">
              {primaryLinks.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => {
                      if (!shouldHandleNavigationClick(event)) {
                        return;
                      }

                      beginNavigation(item.href, item.label);
                    }}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-1 rounded-sm border px-1.5 py-2 text-[10px] transition",
                      active
                        ? "border-[color:color-mix(in_srgb,var(--accent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_12%,transparent)] text-zinc-100"
                        : "border-transparent text-zinc-500 hover:border-zinc-900 hover:bg-black/40 hover:text-zinc-100",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="w-full truncate text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

