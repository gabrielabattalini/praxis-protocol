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
  Hash,
  Heart,
  Home as HomeIcon,
  LogOut,
  Medal,
  Menu,
  Moon,
  Pill,
  Settings as SettingsIcon,
  Shield,
  ShoppingBag,
  Sparkles,
  Sword,
  Target,
  Users,
  Utensils,
  UserRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
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

// Operação (top group) — matches design bundle's NAV main group
const operationLinks = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/tasks", label: "Missões", icon: Target },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/arena", label: "Arena", icon: Sword },
  { href: "/ranking", label: "Ranking", icon: Crown },
  { href: "/achievements", label: "Conquistas", icon: Medal },
  { href: "/friends", label: "Operadores", icon: Users },
  { href: "/profile", label: "Perfil", icon: UserRound },
];

// Footer group (bottom of sidebar)
const footerLinks = [
  { href: "/settings", label: "Configurações", icon: SettingsIcon },
  { href: "/tools", label: "Utilitários", icon: Hash },
];

// Module icons — match design bundle naming
const moduleIcons = {
  run: Activity,
  workout: Dumbbell,
  work: Briefcase,
  nutrition: Utensils,
  finance: Wallet,
  appearance: Sparkles,
  recovery: Zap,
  health: Heart,
  mind: Brain,
  sleep: Moon,
  home: HomeIcon,
  market: ShoppingBag,
  supplements: Pill,
};

function normalizePath(path: string) {
  if (path === "/") return "/";
  return path.replace(/\/+$/, "");
}

function routeBreadcrumb(pathname: string) {
  if (pathname.startsWith("/modules/run")) return "Cardio";
  if (pathname.startsWith("/modules/workout")) return "Treino";
  if (pathname.startsWith("/modules/work")) return "Trabalho";
  if (pathname.startsWith("/modules/nutrition")) return "Nutrição";
  if (pathname.startsWith("/modules/finance")) return "Finanças";
  if (pathname.startsWith("/modules/appearance")) return "Aparência";
  if (pathname.startsWith("/modules/recovery")) return "Recuperação";
  if (pathname.startsWith("/modules/health")) return "Saúde";
  if (pathname.startsWith("/modules/mind")) return "Mente";
  if (pathname.startsWith("/modules/sleep")) return "Sono";
  if (pathname.startsWith("/modules/home")) return "Casa";
  if (pathname.startsWith("/modules/market")) return "Mercado";
  if (pathname.startsWith("/modules/supplements")) return "Suplementos";
  if (pathname.startsWith("/tools")) return "Utilitários";
  if (pathname.startsWith("/tasks")) return "Missões";
  if (pathname.startsWith("/agenda")) return "Agenda";
  if (pathname.startsWith("/arena")) return "Arena";
  if (pathname.startsWith("/friends")) return "Operadores";
  if (pathname.startsWith("/achievements")) return "Conquistas";
  if (pathname.startsWith("/profile")) return "Perfil";
  if (pathname.startsWith("/ranking")) return "Ranking";
  if (pathname.startsWith("/settings")) return "Configurações";
  if (pathname.startsWith("/pages")) return "Índice";
  return "Dashboard";
}

// Praxis hex glyph — SVG inline (matches design bundle's logo)
function PraxisGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="logo-glyph"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
    >
      <path
        d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z"
        stroke="#fb923c"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M10 8 h7 a5 5 0 0 1 0 10 h-7 M10 8 v16"
        stroke="#fb923c"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="square"
      />
      <rect x="15" y="4" width="2" height="2.5" fill="#fb923c" />
      <rect x="15" y="25.5" width="2" height="2.5" fill="#fb923c" />
    </svg>
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close the drawer whenever the route changes — without this it would
  // stay open behind the new page after the user taps a link.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open so the page underneath
  // doesn't drift around when the user scrolls inside the menu.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);
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
      <div className="grid min-h-screen place-items-center px-6 text-zinc-100" style={{ background: "var(--bg)" }}>
        <div className="glass flex w-full max-w-md flex-col items-center gap-4 px-8 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center" style={{ borderRadius: 14, border: "1px solid rgba(251,146,60,0.24)", background: "rgba(251,146,60,0.1)", color: "var(--accent)" }}>
            <Shield className="h-6 w-6 animate-pulse" />
          </div>
          <p className="praxis-label" style={{ color: "var(--accent)" }}>Sincronização</p>
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

  const xpPercent = user.isMaxLevel
    ? 100
    : Math.round((user.xp / Math.max(1, user.xpToNextLevel)) * 100);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {navigationPending ? (
        <NavigationLoadingOverlay
          message={navigationMessage}
          detail="Aguarde enquanto o sistema conclui a mudança de página."
        />
      ) : null}

      {/* Onboarding modals — preserved exactly as before */}
      {needsGuidedOnboarding ? (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-[rgba(5,5,5,0.86)] px-4 py-6 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl rounded-[20px] border border-zinc-800 bg-[rgba(5,5,5,0.96)] p-2 shadow-[0_24px_90px_rgba(0,0,0,0.55)] md:p-4">
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
          <div className="mx-auto max-w-6xl rounded-[20px] border border-zinc-800 bg-[rgba(5,5,5,0.96)] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <BodyMetricsOnboarding
              initialHeightCm={state.personalProfile.bodyHeightCm}
              initialWeightKg={state.personalProfile.bodyWeightKg}
              initialProfile={{
                ageYears: state.personalProfile.ageYears,
                biologicalSex: state.personalProfile.biologicalSex,
                restingHeartRateBpm:
                  state.personalProfile.restingHeartRateBpm,
                activityLevel: state.personalProfile.activityLevel,
                cardioGoal: state.personalProfile.cardioGoal,
                preferredCardio: state.personalProfile.preferredCardio,
                hasCardiovascularCondition:
                  state.personalProfile.hasCardiovascularCondition,
                hasJointLimitation:
                  state.personalProfile.hasJointLimitation,
                usesHeartRateMedication:
                  state.personalProfile.usesHeartRateMedication,
                notes: state.personalProfile.notes,
              }}
              onSave={(payload) => {
                const {
                  heightCm,
                  weightKg,
                  ageYears,
                  biologicalSex,
                  restingHeartRateBpm,
                  activityLevel,
                  cardioGoal,
                  preferredCardio,
                  hasCardiovascularCondition,
                  hasJointLimitation,
                  usesHeartRateMedication,
                  notes,
                } = payload;
                actions.updatePersonalProfile({
                  ageYears,
                  bodyHeightCm: heightCm,
                  bodyWeightKg: weightKg,
                  biologicalSex,
                  restingHeartRateBpm,
                  activityLevel,
                  cardioGoal,
                  preferredCardio,
                  hasCardiovascularCondition,
                  hasJointLimitation,
                  usesHeartRateMedication,
                  notes,
                });
                actions.updateNutritionTargets({
                  bodyWeightKg: weightKg,
                  bodyHeightCm: heightCm,
                  ageYears,
                  biologicalSex,
                  waterMlPerKg: state.dailyNutritionTargets.perKg.waterMl,
                  proteinPerKg: state.dailyNutritionTargets.perKg.protein,
                  carbsPerKg: state.dailyNutritionTargets.perKg.carbs,
                  fatPerKg: state.dailyNutritionTargets.perKg.fat,
                  fiberStrategy: state.dailyNutritionTargets.fiberStrategy,
                  fiberPerKg: state.dailyNutritionTargets.fiberPerKg,
                  fiberRatioGrams: state.dailyNutritionTargets.fiberRatioGrams,
                  fiberRatioCalories:
                    state.dailyNutritionTargets.fiberRatioCalories,
                  sodiumTargetMg: state.dailyNutritionTargets.sodiumTargetMg,
                  targetWeightKg: weightKg,
                  weeklyChangeKg:
                    state.dailyNutritionTargets.weightGoal.weeklyChangeKg,
                  basalMetabolicRate:
                    state.dailyNutritionTargets.basalMetabolicRateSource ===
                    "manual"
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
          <div className="mx-auto max-w-6xl rounded-[20px] border border-zinc-800 bg-[rgba(5,5,5,0.96)] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
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

      {/* Mobile drawer — slides in from the left on phones / narrow viewports.
          Renders the full nav (operação + módulos + sistema) so users on
          mobile can reach pages that the 5-slot bottom-nav doesn't cover.
          Hidden on lg+ via lg:hidden on both the backdrop and the panel. */}
      <div
        className="lg:hidden"
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden={!isMobileMenuOpen}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          opacity: isMobileMenuOpen ? 1 : 0,
          pointerEvents: isMobileMenuOpen ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      />
      <aside
        className="lg:hidden"
        role="dialog"
        aria-label="Menu de navegação"
        aria-hidden={!isMobileMenuOpen}
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: 280,
          maxWidth: "85vw",
          zIndex: 61,
          background: "linear-gradient(180deg, rgba(10,10,12,0.98), rgba(5,5,7,0.99))",
          borderRight: "1px solid rgba(39,39,42,0.6)",
          boxShadow: isMobileMenuOpen ? "0 0 64px rgba(0,0,0,0.6)" : "none",
          transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header with logo + close button */}
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid rgba(39,39,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Link
            href="/dashboard"
            className="sidebar-logo"
            onClick={(event) => {
              if (!shouldHandleNavigationClick(event)) return;
              beginNavigation("/dashboard", "Dashboard");
              setIsMobileMenuOpen(false);
            }}
            style={{
              padding: 0,
              border: "none",
              flex: 1,
              minWidth: 0,
            }}
          >
            <PraxisGlyph size={28} />
            <span className="logo-word" style={{ fontSize: 16 }}>
              praxis<span>.</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="v2-btn v2-btn-icon"
            aria-label="Fechar menu"
            style={{ flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Operação group */}
        <div className="sidebar-nav-label">Operação</div>
        {operationLinks.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={`drawer-op-${item.href}`}
              href={item.href}
              onClick={(event) => {
                if (!shouldHandleNavigationClick(event)) return;
                beginNavigation(item.href, item.label);
                setIsMobileMenuOpen(false);
              }}
              className={cn("nav-item", active && "active")}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Módulos group */}
        <div className="sidebar-nav-label" style={{ marginTop: 8 }}>
          Módulos · {visibleModules.length}
        </div>
        {visibleModules.length === 0 ? (
          <div
            style={{
              padding: "8px 18px",
              fontSize: 11,
              color: "var(--fg-4)",
              lineHeight: 1.5,
            }}
          >
            Nenhum módulo ativo. Ative em Configurações.
          </div>
        ) : (
          visibleModules.map((module) => {
            const Icon = moduleIcons[module.id] ?? Sparkles;
            const active = pathname.startsWith(module.route);
            return (
              <Link
                key={`drawer-mod-${module.id}`}
                href={module.route}
                onClick={(event) => {
                  if (!shouldHandleNavigationClick(event)) return;
                  beginNavigation(module.route, module.name);
                  setIsMobileMenuOpen(false);
                }}
                className={cn("nav-item", active && "active")}
              >
                <Icon size={16} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {module.name}
                </span>
              </Link>
            );
          })
        )}

        {/* Sistema group (settings + tools) */}
        <div className="sidebar-nav-label" style={{ marginTop: 8 }}>
          Sistema
        </div>
        {footerLinks.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={`drawer-foot-${item.href}`}
              href={item.href}
              onClick={(event) => {
                if (!shouldHandleNavigationClick(event)) return;
                beginNavigation(item.href, item.label);
                setIsMobileMenuOpen(false);
              }}
              className={cn("nav-item", active && "active")}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* User card pinned to the bottom */}
        <div className="sidebar-footer" style={{ marginTop: "auto" }}>
          <div className="user-avatar-pill">{avatarLabel}</div>
          <div className="user-info" style={{ minWidth: 0, flex: 1 }}>
            <div
              className="user-name"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </div>
            <div className="user-rank">
              {user.rankTier} · LV {user.level}
            </div>
          </div>
        </div>
      </aside>

      {/* Shell grid */}
      <div className="shell" style={{ ["--sidebar-w" as string]: "256px" } as React.CSSProperties}>
        {/* Sidebar — desktop only */}
        <aside className="sidebar desktop-sidebar">
          <Link
            href="/dashboard"
            className="sidebar-logo"
            onClick={(event) => {
              if (!shouldHandleNavigationClick(event)) return;
              beginNavigation("/dashboard", "Dashboard");
            }}
          >
            <PraxisGlyph size={32} />
            <span className="logo-word">
              praxis<span>.</span>
            </span>
          </Link>

          <div className="sidebar-nav-label">Operação</div>
          {operationLinks.map((item) => {
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
                className={cn("nav-item", active && "active")}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="sidebar-nav-label" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 14 }}>
            <span>Módulos · {visibleModules.length}</span>
            <button
              type="button"
              onClick={() => setIsModuleOrderEditing((current) => !current)}
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                padding: "3px 8px",
                background: isModuleOrderEditing ? "rgba(251,146,60,0.12)" : "transparent",
                color: isModuleOrderEditing ? "var(--accent)" : "var(--fg-3)",
                border: `1px solid ${isModuleOrderEditing ? "rgba(251,146,60,0.3)" : "rgba(39,39,42,0.8)"}`,
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "var(--font-mono), monospace",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {isModuleOrderEditing ? "Salvar" : "Ordenar"}
            </button>
          </div>

          {visibleModules.length === 0 ? (
            <div style={{ padding: "8px 18px", fontSize: 11, color: "var(--fg-4)", lineHeight: 1.5 }}>
              Nenhum módulo visível. Ative em Configurações.
            </div>
          ) : (
            visibleModules.map((module, index) => {
              const Icon = moduleIcons[module.id] ?? Sparkles;
              const active = pathname.startsWith(module.route);
              if (isModuleOrderEditing) {
                return (
                  <div
                    key={module.id}
                    className={cn("nav-item", active && "active")}
                    style={{ justifyContent: "space-between", paddingRight: 8 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Icon size={16} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{module.name}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          actions.reorderModule({ moduleId: module.id, direction: "up" })
                        }
                        style={{
                          width: 22,
                          height: 14,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid var(--line)",
                          color: "var(--fg-3)",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          opacity: index === 0 ? 0.35 : 1,
                          borderRadius: 4,
                        }}
                        aria-label={`Mover ${module.name} para cima`}
                      >
                        <ArrowUp size={10} />
                      </button>
                      <button
                        type="button"
                        disabled={index === visibleModules.length - 1}
                        onClick={() =>
                          actions.reorderModule({ moduleId: module.id, direction: "down" })
                        }
                        style={{
                          width: 22,
                          height: 14,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid var(--line)",
                          color: "var(--fg-3)",
                          cursor: index === visibleModules.length - 1 ? "not-allowed" : "pointer",
                          opacity: index === visibleModules.length - 1 ? 0.35 : 1,
                          borderRadius: 4,
                        }}
                        aria-label={`Mover ${module.name} para baixo`}
                      >
                        <ArrowDown size={10} />
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={module.id}
                  href={module.route}
                  onClick={(event) => {
                    if (!shouldHandleNavigationClick(event)) return;
                    beginNavigation(module.route, module.name);
                  }}
                  className={cn("nav-item", active && "active")}
                >
                  <Icon size={16} />
                  <span>{module.name}</span>
                </Link>
              );
            })
          )}

          {/* Spacer + footer items */}
          <div style={{ flex: 1 }} />

          {footerLinks.map((item) => {
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
                className={cn("nav-item", active && "active")}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* User card at very bottom */}
          <div className="sidebar-footer">
            <div className="user-avatar-pill">{avatarLabel}</div>
            <div className="user-info" style={{ minWidth: 0, flex: 1 }}>
              <div className="user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </div>
              <div className="user-rank">
                {user.rankTier} · LV {user.level}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Online">
              <div className="status-dot" />
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="topbar-shell">
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {/* Hamburger — only on mobile, since desktop already has the
                  sidebar. Opens the drawer with full nav (operação + módulos)
                  so users on phones can actually reach every page. */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="v2-btn v2-btn-icon lg:hidden"
                aria-label="Abrir menu"
                style={{ flexShrink: 0 }}
              >
                <Menu size={18} />
              </button>
              <div className="topbar-breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.6 }}>praxis</span>
                <span style={{ opacity: 0.4 }}>/</span>
                <span className="current">{routeBreadcrumb(pathname)}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href="/settings"
                onClick={(event) => {
                  if (!shouldHandleNavigationClick(event)) return;
                  beginNavigation("/settings", "Configurações");
                }}
                className="v2-btn v2-btn-icon hidden sm:inline-flex"
                aria-label="Configurações"
              >
                <SettingsIcon size={16} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setNavigationMessage("Encerrando sessão");
                  setNavigationPending(true);
                  void signOut({ redirectUrl: "/auth/login" });
                }}
                className="v2-btn v2-btn-sm"
                style={{ paddingLeft: 14, paddingRight: 14 }}
                aria-label="Sair"
                title="Sair"
              >
                {/* Below sm: icon only (saves ~50px in the topbar). At sm+
                    we show the text label since there's room for it. */}
                <LogOut size={16} className="sm:hidden" />
                <span className="hidden sm:inline">Sair</span>
              </button>
              <Link
                href="/profile"
                onClick={(event) => {
                  if (!shouldHandleNavigationClick(event)) return;
                  beginNavigation("/profile", "Perfil");
                }}
                className="user-avatar-pill"
                style={{ textDecoration: "none" }}
                aria-label="Perfil"
                title={displayName}
              >
                {avatarLabel}
              </Link>
            </div>
          </header>

          {/* Mobile XP / level strip — quick context outside topbar (desktop already shows in sidebar footer) */}
          <div className="lg:hidden" style={{ padding: "12px 18px", borderBottom: "1px solid rgba(39,39,42,0.6)", background: "rgba(5,5,5,0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="user-avatar-pill" style={{ width: 28, height: 28, fontSize: 11 }}>{avatarLabel}</div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>{displayName.split(" ")[0]}</div>
                  <div className="praxis-label" style={{ color: "var(--accent)", fontSize: 9 }}>{user.rankTier} · LV {user.level}</div>
                </div>
              </div>
              <div className="praxis-label" style={{ color: "var(--fg-3)", fontSize: 9 }}>
                {user.isMaxLevel ? "MAX" : `${user.xp}/${user.xpToNextLevel} XP`}
              </div>
            </div>
            <div className="progress-track" style={{ marginTop: 0 }}>
              <div className="progress-fill" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>

          {/* Page content */}
          <main
            className="page-content"
            style={{
              flex: 1,
              padding: "32px 32px calc(32px + var(--mobile-bottom-nav-space))",
              width: "100%",
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
