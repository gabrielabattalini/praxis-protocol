"use client";

import {
  BellRing,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Volume2,
} from "lucide-react";
import { usePushNotifications } from "@/components/providers/notifications-provider";
import { useAppStore } from "@/components/providers/app-store-provider";
import { StripeCheckoutButton } from "@/components/billing/stripe-checkout-button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { moduleCatalog, themeOptions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const toggles: Array<{
  key: "sound" | "vibration";
  title: string;
  description: string;
}> = [
  {
    key: "sound",
    title: "Som",
    description: "Efeitos sonoros e feedback do sistema.",
  },
  {
    key: "vibration",
    title: "Vibra\u00e7\u00e3o",
    description: "Feedback t\u00e1til nas a\u00e7\u00f5es compat\u00edveis.",
  },
];

const toggleIcons = {
  sound: Volume2,
  vibration: Smartphone,
} as const;

function permissionLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") return "Concedida";
  if (permission === "denied") return "Bloqueada";
  if (permission === "default") return "Pendente";
  return "Sem suporte";
}

function registrationLabel(status: string) {
  switch (status) {
    case "registered":
      return "Registrado";
    case "registering":
      return "Registrando";
    case "unsupported":
      return "Sem suporte";
    case "error":
      return "Falha";
    default:
      return "Aguardando";
  }
}

function subscriptionLabel(status: string) {
  switch (status) {
    case "subscribed":
      return "Inscrito";
    case "subscribing":
      return "Inscrevendo";
    case "unsupported":
      return "Sem suporte";
    case "error":
      return "Falha";
    default:
      return "N\u00e3o inscrito";
  }
}

function syncLabel(status: string) {
  switch (status) {
    case "synced":
      return "Sincronizado";
    case "syncing":
      return "Sincronizando";
    case "backend-unavailable":
      return "Servidor indispon\u00edvel";
    case "error":
      return "Falha";
    default:
      return "Aguardando";
  }
}

export default function SettingsPage() {
  const { state, actions } = useAppStore();
  const {
    supported,
    enabled,
    permission,
    registrationState,
    subscriptionState,
    syncState,
    lastSyncAt,
    lastError,
    endpointStatus,
    hasSubscription,
    deviceCount,
    itemCount,
    activatePush,
    togglePush,
    syncNow,
    sendTestNotification,
  } = usePushNotifications();

  const activeModulesCount = moduleCatalog.filter(
    (module) => state.settings.activeModules[module.id],
  ).length;
  const activeTheme =
    themeOptions.find((option) => option.id === state.settings.theme) ??
    themeOptions[0];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Sistema"
        title="Configurações"
        description="Controle \u00e1udio, vibra\u00e7\u00e3o, notifica\u00e7\u00f5es sincronizadas por conta e a visibilidade dos m\u00f3dulos do Praxis."
      />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassPanel className="space-y-5 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="praxis-label text-[var(--accent)]">Hub central</p>
              <h2 className="praxis-title mt-2 text-3xl">
                Personalização, sincronização e identidade em um único lugar.
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Ajuste a experiência do Praxis para que ela fique igual em qualquer
                dispositivo da mesma conta.
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-black/40 px-4 py-3 text-right">
              <p className="praxis-label">Conta ativa</p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {activeTheme.name}
              </p>
              <p className="mt-1 text-sm text-zinc-500">Ajustes sincronizados.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="praxis-panel rounded-sm px-4 py-4">
              <p className="praxis-label">Tema</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">{activeTheme.name}</p>
              <p className="mt-2 text-sm text-zinc-500">Visual atual do app.</p>
            </div>
            <div className="praxis-panel rounded-sm px-4 py-4">
              <p className="praxis-label">Som</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {state.settings.sound ? "Ativo" : "Inativo"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">Feedback auditivo do sistema.</p>
            </div>
            <div className="praxis-panel rounded-sm px-4 py-4">
              <p className="praxis-label">Vibração</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {state.settings.vibration ? "Ativa" : "Inativa"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">Resposta tátil nas ações.</p>
            </div>
            <div className="praxis-panel rounded-sm px-4 py-4">
              <p className="praxis-label">Módulos</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {activeModulesCount}
              </p>
              <p className="mt-2 text-sm text-zinc-500">Visíveis na navegação.</p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4 border-[rgba(251,146,60,0.16)] bg-[linear-gradient(180deg,rgba(22,16,8,0.96),rgba(8,8,10,0.94))] p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Plano premium</p>
              <h3 className="praxis-title mt-2 text-2xl">
                Deixe a conta ainda mais forte com upgrade contextual.
              </h3>
            </div>
            <ShieldCheck className="h-6 w-6 text-[var(--accent)]" />
          </div>

          <p className="text-sm leading-6 text-zinc-500">
            Configure o resto, mantenha o básico visível e habilite o que vai
            sustentar a rotina diária no longo prazo.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-sm border border-zinc-800 bg-black/30 px-4 py-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="text-sm leading-6 text-zinc-300">
                Notificações sincronizadas no PC e no celular.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-sm border border-zinc-800 bg-black/30 px-4 py-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="text-sm leading-6 text-zinc-300">
                Configuração de aparência, voz e horários por conta.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-sm border border-zinc-800 bg-black/30 px-4 py-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="text-sm leading-6 text-zinc-300">
                Mais clareza para a experiência premium em cada módulo.
              </p>
            </div>
          </div>

          <StripeCheckoutButton
            source="settings-module"
            className="w-full rounded-sm border-[rgba(251,146,60,0.18)] bg-[linear-gradient(135deg,var(--accent)_0%,#fbbf24_100%)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(251,146,60,0.22)]"
            noteClassName="text-zinc-500"
            errorClassName="text-amber-200"
          >
            Ver planos e liberar acesso
          </StripeCheckoutButton>
        </GlassPanel>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Som</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {state.settings.sound ? "Ativo" : "Inativo"}
          </p>
          <p className="text-sm leading-6 text-zinc-500">
            Feedback auditivo do sistema.
          </p>
        </GlassPanel>

        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Vibra\u00e7\u00e3o</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {state.settings.vibration ? "Ativa" : "Inativa"}
          </p>
          <p className="text-sm leading-6 text-zinc-500">
            Resposta t\u00e1til para opera\u00e7\u00f5es compat\u00edveis.
          </p>
        </GlassPanel>

        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">M\u00f3dulos</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {activeModulesCount}
          </p>
          <p className="text-sm leading-6 text-zinc-500">
            Vis\u00edveis na navega\u00e7\u00e3o lateral.
          </p>
        </GlassPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Controles</p>
              <h2 className="praxis-title mt-2 text-3xl">
                Prefer\u00eancias do sistema
              </h2>
            </div>

            <div className="space-y-3">
              {toggles.map((toggle) => {
                const Icon = toggleIcons[toggle.key];
                const active = state.settings[toggle.key];

                return (
                  <button
                    key={toggle.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => actions.toggleSetting(toggle.key)}
                    className={cn(
                      "praxis-panel grid w-full min-w-0 cursor-pointer select-none grid-cols-1 gap-4 overflow-hidden rounded-sm px-4 py-4 text-left transition hover:border-[rgba(251,146,60,0.22)] md:grid-cols-[minmax(0,1fr)_auto]",
                      active && "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.04)]",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border",
                          active
                            ? "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.08)] text-[var(--accent)]"
                            : "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-500",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100">{toggle.title}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-500">
                          {toggle.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <span
                        className={cn(
                          "praxis-label shrink-0 rounded-sm border px-3 py-2",
                          active
                            ? "border-[rgba(251,146,60,0.28)] text-[var(--accent)]"
                            : "border-zinc-800 text-zinc-500",
                        )}
                      >
                        {active ? "Ativo" : "Inativo"}
                      </span>

                      <span
                        className={cn(
                          "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition",
                          active
                            ? "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.16)]"
                            : "border-zinc-800 bg-[rgba(14,14,17,0.96)]",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-1 top-1 h-5 w-5 rounded-full bg-zinc-200 transition-transform",
                            active && "translate-x-5 bg-[var(--accent)]",
                          )}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">
                Notifica\u00e7\u00f5es
              </p>
              <h2 className="praxis-title mt-2 text-3xl">
                Alertas no PC e no celular
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                O Praxis sincroniza a agenda da sua conta e pode disparar alertas no
                navegador com a aba fechada. Cada dispositivo precisa ser ativado uma vez
                com permiss\u00e3o do navegador.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="praxis-panel rounded-sm px-4 py-4">
                <p className="praxis-label">Status</p>
                <p className="mt-2 text-xl font-semibold text-zinc-100">
                  {enabled ? "Canal ativo" : "Canal desativado"}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {supported
                    ? `${itemCount} alerta(s) sincronizados em ${deviceCount} dispositivo(s).`
                    : "Este navegador n\u00e3o suporta notifica\u00e7\u00f5es push."}
                </p>
              </div>

              <div className="praxis-panel rounded-sm px-4 py-4">
                <p className="praxis-label">Permiss\u00e3o</p>
                <p className="mt-2 text-xl font-semibold text-zinc-100">
                  {permissionLabel(permission)}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {registrationLabel(registrationState)} {" \u00b7 "}
                  {subscriptionLabel(subscriptionState)}
                </p>
              </div>

              <div className="praxis-panel rounded-sm px-4 py-4">
                <p className="praxis-label">Sincroniza\u00e7\u00e3o</p>
                <p className="mt-2 text-xl font-semibold text-zinc-100">
                  {syncLabel(syncState)}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {lastSyncAt
                    ? `\u00daltima sincroniza\u00e7\u00e3o em ${new Date(lastSyncAt).toLocaleString("pt-BR")}`
                    : "Ainda n\u00e3o houve sincroniza\u00e7\u00e3o confirmada."}
                </p>
              </div>

              <div className="praxis-panel rounded-sm px-4 py-4">
                <p className="praxis-label">Dispositivo</p>
                <p className="mt-2 text-xl font-semibold text-zinc-100">
                  {hasSubscription ? "Inscrito" : "Sem inscri\u00e7\u00e3o ativa"}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {endpointStatus || "Aguardando ativa\u00e7\u00e3o neste navegador."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void togglePush()}
                disabled={!supported}
                className={cn(
                  "inline-flex items-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium",
                  supported
                    ? "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.08)] text-[var(--accent)]"
                    : "cursor-not-allowed border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-500",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                {enabled ? "Desativar neste dispositivo" : "Ativar neste dispositivo"}
              </button>

              <button
                type="button"
                onClick={() => void activatePush()}
                disabled={!supported}
                className={cn(
                  "inline-flex items-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium",
                  supported
                    ? "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-100"
                    : "cursor-not-allowed border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-500",
                )}
              >
                <BellRing className="h-4 w-4" />
                Pedir permiss\u00e3o
              </button>

              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={!supported}
                className={cn(
                  "inline-flex items-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium",
                  supported
                    ? "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-100"
                    : "cursor-not-allowed border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-500",
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Sincronizar agenda
              </button>

              <button
                type="button"
                onClick={() => void sendTestNotification()}
                disabled={!supported || permission !== "granted"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium",
                  supported && permission === "granted"
                    ? "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-100"
                    : "cursor-not-allowed border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-500",
                )}
              >
                <Send className="h-4 w-4" />
                Enviar teste
              </button>
            </div>

            {lastError ? (
              <div className="rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.08)] px-4 py-3 text-sm text-[var(--accent)]">
                {lastError}
              </div>
            ) : null}
          </GlassPanel>
        </div>

        <GlassPanel className="space-y-4">
          <div>
            <p className="praxis-label text-[var(--accent)]">M\u00f3dulos ativos</p>
            <h2 className="praxis-title mt-2 text-3xl">O que fica vis\u00edvel no app</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Desative o que n\u00e3o faz parte da sua rotina. O m\u00f3dulo some da barra lateral
              e do dashboard sem quebrar o hist\u00f3rico.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {moduleCatalog.map((module) => {
              const active = state.settings.activeModules[module.id];

              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => actions.toggleModuleVisibility(module.id)}
                  className={cn(
                    "praxis-panel group min-w-0 rounded-sm p-4 text-left transition hover:border-[rgba(251,146,60,0.22)]",
                    active && "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.06)]",
                  )}
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">
                        {module.name}
                      </p>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-500">
                        {module.description}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "praxis-label shrink-0 rounded-sm border px-3 py-2",
                        active
                          ? "border-[rgba(251,146,60,0.28)] text-[var(--accent)]"
                          : "border-zinc-800 text-zinc-500",
                      )}
                    >
                      {active ? "Vis\u00edvel" : "Oculto"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}
