"use client";

import { useState } from "react";
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
import {
  RxLabel,
  RxPageHeader,
  RxPanel,
} from "@/components/redesign/primitives";
import { moduleCatalog, themeOptions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type SettingsTab =
  | "account"
  | "appearance"
  | "themes"
  | "notifications"
  | "privacy"
  | "sync"
  | "subscription"
  | "data";

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "account", label: "Conta" },
  { id: "appearance", label: "Aparência" },
  { id: "themes", label: "Temas" },
  { id: "notifications", label: "Notificações" },
  { id: "privacy", label: "Privacidade" },
  { id: "sync", label: "Sincronização" },
  { id: "subscription", label: "Assinatura" },
  { id: "data", label: "Dados" },
];

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
    title: "Vibração",
    description: "Feedback tátil nas ações compatíveis.",
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
      return "Não inscrito";
  }
}

function syncStatusLabel(status: string) {
  switch (status) {
    case "synced":
      return "Sincronizado";
    case "syncing":
      return "Sincronizando";
    case "backend-unavailable":
      return "Servidor indisponível";
    case "error":
      return "Falha";
    default:
      return "Aguardando";
  }
}

function TabContent({
  tab,
}: {
  tab: SettingsTab;
}) {
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

  if (tab === "themes") {
    return (
      <div>
        <RxLabel>TEMA DO PROTOCOLO</RxLabel>
        <div
          className="rx-display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 20,
            marginTop: 8,
            color: "var(--fg)",
            letterSpacing: "-0.02em",
          }}
        >
          Acento visual
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {themeOptions.map((option) => {
            const active = state.settings.theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => actions.setTheme(option.id)}
                className={active ? "rx-panel-hot" : "rx-panel"}
                style={{
                  padding: 16,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    height: 48,
                    background: option.primary,
                    boxShadow: `0 0 20px ${option.glow}`,
                    marginBottom: 10,
                    borderRadius: 2,
                  }}
                />
                <div
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: active ? "var(--accent)" : "var(--fg-2)",
                    textTransform: "uppercase",
                  }}
                >
                  {option.name}
                </div>
                <div
                  className="rx-mono"
                  style={{
                    fontSize: 9,
                    color: "var(--fg-4)",
                    marginTop: 2,
                    letterSpacing: "0.1em",
                  }}
                >
                  {option.primary}
                </div>
                {active ? (
                  <div
                    className="rx-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--accent)",
                      marginTop: 6,
                      letterSpacing: "0.18em",
                    }}
                  >
                    ● ATIVO
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (tab === "appearance") {
    return (
      <div>
        <RxLabel>PREFERÊNCIAS DE INTERFACE</RxLabel>
        <div
          className="rx-display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginTop: 8,
            marginBottom: 20,
            color: "var(--fg)",
            letterSpacing: "-0.02em",
          }}
        >
          Som e vibração
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {toggles.map((toggle) => {
            const Icon = toggleIcons[toggle.key];
            const active = state.settings[toggle.key];
            return (
              <button
                key={toggle.key}
                type="button"
                aria-pressed={active}
                onClick={() => actions.toggleSetting(toggle.key)}
                className={active ? "rx-panel-hot" : "rx-panel"}
                style={{
                  padding: 16,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 40,
                    width: 40,
                    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    background: active ? "rgba(251,146,60,0.08)" : "rgba(0,0,0,0.3)",
                    color: active ? "var(--accent)" : "var(--fg-3)",
                    borderRadius: 2,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--fg)",
                    }}
                  >
                    {toggle.title}
                  </div>
                  <div
                    className="rx-mono"
                    style={{
                      fontSize: 10,
                      color: "var(--fg-3)",
                      marginTop: 4,
                      letterSpacing: "0.08em",
                      lineHeight: 1.5,
                    }}
                  >
                    {toggle.description}
                  </div>
                </div>
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    padding: "6px 10px",
                    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    color: active ? "var(--accent)" : "var(--fg-3)",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    borderRadius: 2,
                  }}
                >
                  {active ? "ATIVO" : "INATIVO"}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 32 }}>
          <RxLabel>DENSIDADE</RxLabel>
          <div
            className="rx-mono"
            style={{
              fontSize: 11,
              color: "var(--fg-3)",
              marginTop: 6,
              letterSpacing: "0.08em",
              maxWidth: 460,
            }}
          >
            Confortável · padrão do Praxis Protocol.
          </div>
        </div>
      </div>
    );
  }

  if (tab === "notifications") {
    return (
      <div>
        <RxLabel>ALERTAS NO PC E CELULAR</RxLabel>
        <div
          className="rx-display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginTop: 8,
            marginBottom: 8,
            color: "var(--fg)",
            letterSpacing: "-0.02em",
          }}
        >
          Canal de notificações
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--fg-3)",
            marginBottom: 20,
            maxWidth: 620,
            lineHeight: 1.6,
          }}
        >
          O Praxis sincroniza a agenda da sua conta e dispara alertas no
          navegador mesmo com a aba fechada. Ative uma vez em cada dispositivo.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            {
              label: "STATUS",
              value: enabled ? "Canal ativo" : "Canal desativado",
              hint: supported
                ? `${itemCount} alertas · ${deviceCount} dispositivos`
                : "Navegador sem suporte",
            },
            {
              label: "PERMISSÃO",
              value: permissionLabel(permission),
              hint: `${registrationLabel(registrationState)} · ${subscriptionLabel(subscriptionState)}`,
            },
            {
              label: "SINCRONIZAÇÃO",
              value: syncStatusLabel(syncState),
              hint: lastSyncAt
                ? `Última: ${new Date(lastSyncAt).toLocaleString("pt-BR")}`
                : "Ainda não houve sync",
            },
            {
              label: "DISPOSITIVO",
              value: hasSubscription ? "Inscrito" : "Sem inscrição",
              hint: endpointStatus || "Aguardando ativação",
            },
          ].map((row) => (
            <RxPanel key={row.label} style={{ padding: 14 }}>
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                {row.label}
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--fg)",
                  marginTop: 4,
                  letterSpacing: "-0.01em",
                }}
              >
                {row.value}
              </div>
              <div
                className="rx-mono"
                style={{
                  fontSize: 10,
                  color: "var(--fg-4)",
                  marginTop: 4,
                  letterSpacing: "0.08em",
                  lineHeight: 1.5,
                }}
              >
                {row.hint}
              </div>
            </RxPanel>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => void togglePush()}
            disabled={!supported}
            className={cn(supported ? "rx-btn-primary" : "rx-btn-ghost")}
            style={{
              padding: "8px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: supported ? 1 : 0.5,
              cursor: supported ? "pointer" : "not-allowed",
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {enabled ? "Desativar neste dispositivo" : "Ativar neste dispositivo"}
          </button>
          <button
            type="button"
            onClick={() => void activatePush()}
            disabled={!supported}
            className="rx-btn-ghost"
            style={{
              padding: "8px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: supported ? 1 : 0.5,
              cursor: supported ? "pointer" : "not-allowed",
            }}
          >
            <BellRing className="h-3.5 w-3.5" />
            Pedir permissão
          </button>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={!supported}
            className="rx-btn-ghost"
            style={{
              padding: "8px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: supported ? 1 : 0.5,
              cursor: supported ? "pointer" : "not-allowed",
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sincronizar agenda
          </button>
          <button
            type="button"
            onClick={() => void sendTestNotification()}
            disabled={!supported || permission !== "granted"}
            className="rx-btn-ghost"
            style={{
              padding: "8px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: supported && permission === "granted" ? 1 : 0.5,
              cursor:
                supported && permission === "granted" ? "pointer" : "not-allowed",
            }}
          >
            <Send className="h-3.5 w-3.5" />
            Enviar teste
          </button>
        </div>

        {lastError ? (
          <div
            style={{
              padding: "10px 14px",
              border: "1px solid rgba(251,146,60,0.3)",
              background: "rgba(251,146,60,0.08)",
              color: "var(--accent)",
              fontSize: 12,
              borderRadius: 2,
            }}
          >
            {lastError}
          </div>
        ) : null}
      </div>
    );
  }

  if (tab === "privacy") {
    return (
      <div>
        <RxLabel>MÓDULOS VISÍVEIS</RxLabel>
        <div
          className="rx-display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginTop: 8,
            marginBottom: 8,
            color: "var(--fg)",
            letterSpacing: "-0.02em",
          }}
        >
          O que fica na navegação
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--fg-3)",
            marginBottom: 20,
            maxWidth: 620,
            lineHeight: 1.6,
          }}
        >
          Desative o que não faz parte da sua rotina. O módulo some da barra
          lateral e do dashboard sem apagar histórico.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {moduleCatalog.map((module) => {
            const active = state.settings.activeModules[module.id];
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => actions.toggleModuleVisibility(module.id)}
                className={active ? "rx-panel-hot" : "rx-panel"}
                style={{
                  padding: 14,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: active ? "var(--accent)" : "var(--fg)",
                      }}
                    >
                      {module.name}
                    </div>
                    <div
                      className="rx-mono"
                      style={{
                        fontSize: 10,
                        color: "var(--fg-3)",
                        marginTop: 4,
                        letterSpacing: "0.08em",
                        lineHeight: 1.5,
                      }}
                    >
                      {module.description}
                    </div>
                  </div>
                  <span
                    className="rx-mono"
                    style={{
                      fontSize: 9,
                      padding: "4px 8px",
                      border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                      color: active ? "var(--accent)" : "var(--fg-3)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  >
                    {active ? "VISÍVEL" : "OCULTO"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (tab === "subscription") {
    return (
      <div>
        <RxLabel>PLANO PRAXIS PRO</RxLabel>
        <div
          className="rx-display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginTop: 8,
            marginBottom: 8,
            color: "var(--fg)",
            letterSpacing: "-0.02em",
          }}
        >
          Assinatura e benefícios
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--fg-3)",
            marginBottom: 20,
            maxWidth: 620,
            lineHeight: 1.6,
          }}
        >
          Libere os 13 módulos, arena ilimitada e sincronização em nuvem.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Notificações sincronizadas no PC e no celular",
            "Configuração de aparência, voz e horários por conta",
            "Mais clareza para a experiência premium em cada módulo",
          ].map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                fontSize: 13,
                color: "var(--fg-2)",
                borderRadius: 2,
              }}
            >
              <span
                style={{
                  marginTop: 6,
                  width: 6,
                  height: 6,
                  background: "var(--accent)",
                  flexShrink: 0,
                  transform: "rotate(45deg)",
                }}
              />
              <span style={{ lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <StripeCheckoutButton
            source="settings-module"
            className="rx-btn-primary"
            noteClassName="text-zinc-500"
            errorClassName="text-amber-200"
          >
            Ver planos e liberar acesso
          </StripeCheckoutButton>
        </div>
      </div>
    );
  }

  // Default placeholder for tabs not yet wired (account, sync, data)
  return (
    <RxPanel style={{ padding: 32, textAlign: "center" }}>
      <RxLabel>EM BREVE</RxLabel>
      <div
        className="rx-display"
        style={{
          fontSize: 18,
          fontWeight: 600,
          marginTop: 10,
          color: "var(--fg)",
        }}
      >
        Esta seção está pronta para receber conteúdo.
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--fg-3)",
          marginTop: 6,
          maxWidth: 420,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        Use uma das abas à esquerda — Temas, Aparência, Notificações,
        Privacidade ou Assinatura.
      </div>
    </RxPanel>
  );
}

export default function SettingsPage() {
  const { state } = useAppStore();
  const [tab, setTab] = useState<SettingsTab>("themes");

  const activeModulesCount = moduleCatalog.filter(
    (module) => state.settings.activeModules[module.id],
  ).length;
  const activeTheme =
    themeOptions.find((option) => option.id === state.settings.theme) ??
    themeOptions[0];

  return (
    <div>
      <RxPageHeader
        title="Preferências"
        subtitle={
          <>
            Tema <span style={{ color: "var(--accent)" }}>{activeTheme.name}</span>{" "}
            · {activeModulesCount} módulos visíveis
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 24,
        }}
      >
        {/* Left nav */}
        <div style={{ alignSelf: "start" }}>
          {settingsTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderLeft: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  color: active ? "var(--accent)" : "var(--fg-2)",
                  background: active ? "rgba(251,146,60,0.06)" : "transparent",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: active ? 600 : 400,
                  transition: "color 120ms ease, background 120ms ease",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div>
          <TabContent tab={tab} />
        </div>
      </div>
    </div>
  );
}
