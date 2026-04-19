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
        "group praxis-copy editorial-app-link flex min-w-0 items-center gap-3 border-l-2 px-4 py-2.5 text-sm",
        active
          ? "editorial-app-link-active border-l-[var(--accent)]"
          : "border-l-transparent",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center border transition-colors",
          active
            ? "border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_12%,rgba(0,0,0,0.18))] text-[var(--accent)]"
            : "border-zinc-800 bg-black/30 text-zinc-500 group-hover:border-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] group-hover:text-[var(--accent)]",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className={cn("truncate font-medium", active ? "text-[var(--accent)]" : "text-zinc-300")}>{label}</span>
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
      <div className="editorial-app-shell grid min-h-screen place-items-center px-6 text-zinc-100">
        <div className="editorial-app-card flex w-full max-w-md flex-col items-center gap-4 px-8 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center border border-[color:color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]">
            <Shield className="h-6 w-6 animate-pulse" />
          </div>
          <p className="praxis-label text-[var(--accent)]">Sincronização</p>
          <h1 className="praxis-title text-3xl text-zinc-100">
            Aguardando autenticação do protocolo
          </h1>
          <p className="max-w-sm text-sm leading-7 text-zinc-400">
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
    <div className="editorial-app-shell min-h-screen">
      {navigationPending ? (
        <NavigationLoadingOverlay
          message={navigationMessage}
          detail="Aguarde enquanto o sistema conclui a mudança de página."
        />
      ) : null}

      <div className="pointer-events-none fixed inset-0 overflow-hidden" />

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

      <div className="relative mx-auto grid min-h-screen max-w-[1680px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="editorial-app-sidebar hidden border-r lg:flex lg:min-h-screen lg:flex-col">
          <div className="border-b border-zinc-800 px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Praxis Protocol"
                  width={22}
                  height={22}
                  className="h-5 w-auto"
                />
                <span className="praxis-label text-zinc-500">Praxis Protocol</span>
              </div>
              <span className="praxis-label text-[var(--accent)]">online</span>
            </div>
          </div>

          <div className="border-b border-zinc-800 px-3 py-4">
            <div className="editorial-app-card p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center border border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] font-title text-sm font-bold text-[var(--accent)]">
                  {avatarLabel}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">{displayName}</p>
                  <p className="mt-1 text-xs text-zinc-500">Identidade ativa</p>
                  <p className="mt-2 praxis-label text-[var(--accent)]">
                    Nível {user.level} · Rank {user.rankTier}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="editorial-app-card-soft p-3">
                  <p className="praxis-label text-zinc-500">Nível</p>
                  <p className="mt-2 font-title text-2xl font-bold text-zinc-100">
                    {user.level}
                  </p>
                </div>
                <div className="editorial-app-card-soft p-3">
                  <p className="praxis-label text-zinc-500">Streak</p>
                  <p className="mt-2 font-title text-2xl font-bold text-zinc-100">
                    {user.streak}
                  </p>
                </div>
              </div>

              <div className="mt-4 editorial-app-card-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="praxis-label text-zinc-500">XP</p>
                  <span className="text-xs text-zinc-500">
                    {user.isMaxLevel ? "MAX" : `${user.xp}/${user.xpToNextLevel}`}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden border border-zinc-800 bg-black/50">
                  <div
                    className="h-full praxis-accent-progress transition-all"
                    style={{
                      width: `${user.isMaxLevel ? 100 : (user.xp / Math.max(1, user.xpToNextLevel)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 py-4">
            <p className="praxis-label px-3 text-zinc-500">Operação</p>
            <nav className="mt-3 space-y-1">
              {desktopLinks.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname === item.href}
                  onNavigate={(event, href) => {
                    if (!shouldHandleNavigationClick(event)) return;
                    beginNavigation(href, item.label);
                  }}
                />
              ))}
            </nav>
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-800 px-3 py-4">
            <div className="mb-3 flex items-center justify-between gap-2 px-3">
              <p className="praxis-label text-zinc-500">Módulos</p>
              <button
                type="button"
                onClick={() => setIsModuleOrderEditing((current) => !current)}
                className={cn(
                  "px-3 py-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] transition",
                  isModuleOrderEditing
                    ? "border border-[color:color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,rgba(0,0,0,0.18))] text-[var(--accent)]"
                    : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
                )}
              >
                {isModuleOrderEditing ? "Salvar ordem" : "Ordenar"}
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
                        "group border p-3 transition",
                        active
                          ? "border-[color:color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_8%,rgba(0,0,0,0.18))]"
                          : "border-zinc-800 bg-black/25 hover:border-zinc-700",
                      )}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center border transition",
                              active
                                ? "border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,rgba(0,0,0,0.18))] text-[var(--accent)]"
                                : "border-zinc-800 bg-black/30 text-zinc-500 group-hover:text-zinc-300",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className={cn("truncate text-sm font-medium", active ? "text-[var(--accent)]" : "text-zinc-100")}>
                              {module.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                              {module.detail}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          {active ? (
                            <span className="praxis-label text-[var(--accent)]">ativo</span>
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
                                className="grid h-7 w-7 place-items-center border border-zinc-800 bg-black/30 text-zinc-300 transition disabled:cursor-not-allowed disabled:opacity-35"
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
                                className="grid h-7 w-7 place-items-center border border-zinc-800 bg-black/30 text-zinc-300 transition disabled:cursor-not-allowed disabled:opacity-35"
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
                        if (!shouldHandleNavigationClick(event)) return;
                        beginNavigation(module.route, module.name);
                      }}
                    >
                      {cardContent}
                    </Link>
                  );
                })
              ) : (
                <div className="border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                  Nenhum módulo visível. Ative módulos em Configurações.
                </div>
              )}
            </div>
            <div className="mt-4 border-t border-zinc-800 px-3 pt-4">
              <p className="praxis-label text-zinc-600">● Sync · 00:47 atrás</p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[rgba(5,5,7,0.88)] px-4 py-4 backdrop-blur-2xl md:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="praxis-label text-zinc-500">{headerProtocol(pathname)}</p>
                <h2 className="praxis-title mt-1 truncate text-2xl text-zinc-100 md:text-[2rem]">
                  {routeTitle(pathname)}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:gap-3">
                <div className="hidden border border-zinc-800 bg-black/30 px-3 py-2 md:block">
                  <p className="praxis-label text-zinc-500">XP</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {user.isMaxLevel ? `Nível ${user.level} MAX` : `${user.xp}/${user.xpToNextLevel}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNavigationMessage("Encerrando sessão");
                    setNavigationPending(true);
                    void signOut({ redirectUrl: "/auth/login" });
                  }}
                  className="border border-zinc-800 bg-black/30 px-4 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-200 transition hover:border-[color:color-mix(in_srgb,var(--accent)_28%,transparent)] hover:text-[var(--accent)]"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          <main className="relative flex-1 px-4 pb-28 pt-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl min-w-0">{children}</div>
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-[rgba(5,5,7,0.92)] px-2 py-2 backdrop-blur-2xl lg:hidden">
            <div className="grid grid-cols-7 gap-1">
              {primaryLinks.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => {
                      if (!shouldHandleNavigationClick(event)) return;
                      beginNavigation(item.href, item.label);
                    }}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-1 border px-1.5 py-2 text-[10px] transition",
                      active
                        ? "border-[color:color-mix(in_srgb,var(--accent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_12%,rgba(0,0,0,0.2))] text-[var(--accent)]"
                        : "border-zinc-900 bg-black/30 text-zinc-500 hover:border-zinc-800 hover:text-zinc-200",
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
