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
import { useClerkClient, useUserClient } from "@/components/providers/auth-client-provider";
import { StripeCheckoutButton } from "@/components/billing/stripe-checkout-button";
import { TelegramCard } from "@/components/settings/telegram-card";
import { RxLabel, RxPanel } from "@/components/redesign/primitives";
import { moduleCatalog, themeOptions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type SettingsTab =
  | "account"
  | "themes"
  | "notifications"
  | "modules"
  | "subscription";

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "account", label: "Conta" },
  { id: "themes", label: "Temas" },
  { id: "notifications", label: "Notificações" },
  { id: "modules", label: "Módulos" },
  { id: "subscription", label: "Assinatura" },
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
  const { state, actions, entitlement } = useAppStore();
  const { user: clerkUser } = useUserClient();
  const clerk = useClerkClient();
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
  const [accountNotice, setAccountNotice] = useState("");
  const accountEmail = state.session.email || clerkUser?.primaryEmailAddress?.emailAddress || "";
  const accountUsername =
    state.session.username || accountEmail.split("@")[0]?.trim() || "operador";
  const accountNameSource = state.session.name || clerkUser?.fullName || "";
  const [accountNameDraft, setAccountNameDraft] = useState({
    source: accountNameSource,
    value: accountNameSource,
  });
  const accountName =
    accountNameDraft.source === accountNameSource
      ? accountNameDraft.value
      : accountNameSource;

  function setAccountName(value: string) {
    setAccountNameDraft({
      source: accountNameSource,
      value,
    });
  }

  async function handleAccountSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = accountName.trim() || "Operador Praxis";
    const [firstName = nextName, ...lastNameParts] = nextName.split(/\s+/);

    try {
      if (clerkUser?.update) {
        await clerkUser.update({
          firstName,
          lastName: lastNameParts.join(" ") || undefined,
        });
      }

      actions.updateAccountProfile({
        name: nextName,
        username: accountUsername,
      });
      setAccountNotice("Dados da conta atualizados.");
    } catch {
      actions.updateAccountProfile({
        name: nextName,
        username: accountUsername,
      });
      setAccountNotice("Nome salvo localmente. O portal de login não respondeu agora.");
    }
  }

  function openAccountPortal() {
    if (clerk.openUserProfile) {
      clerk.openUserProfile();
      return;
    }
    setAccountNotice("Gerenciar e-mail e senha fica disponível quando o login real estiver ativo.");
  }

  if (tab === "account") {
    return (
      <div>
        <RxLabel>CONTA DO OPERADOR</RxLabel>
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
          Dados de acesso
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
          Edite seu nome no Praxis e use o portal da conta para alterar e-mail ou senha com segurança.
        </div>

        <form onSubmit={handleAccountSave}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            <label className="rx-panel" style={{ padding: 16 }}>
              <span
                className="rx-mono"
                style={{
                  display: "block",
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Nome
              </span>
              <input
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Seu nome"
                style={{
                  width: "100%",
                  height: 44,
                  border: "1px solid var(--line)",
                  background: "rgba(0,0,0,0.35)",
                  color: "var(--fg)",
                  padding: "0 12px",
                  borderRadius: 12,
                  fontSize: 15,
                  outline: "none",
                }}
              />
            </label>

            <div className="rx-panel" style={{ padding: 16 }}>
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                E-mail
              </div>
              <div style={{ fontSize: 15, color: "var(--fg)", wordBreak: "break-word" }}>
                {accountEmail || "Nenhum e-mail vinculado"}
              </div>
              <div className="rx-mono" style={{ marginTop: 8, fontSize: 10, color: "var(--fg-4)" }}>
                Alteração feita no portal seguro da conta.
              </div>
            </div>

            <div className="rx-panel" style={{ padding: 16 }}>
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Senha
              </div>
              <div style={{ fontSize: 18, color: "var(--fg)" }}>••••••••</div>
              <div className="rx-mono" style={{ marginTop: 8, fontSize: 10, color: "var(--fg-4)" }}>
                Alterar ou recuperar pelo provedor de login.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <button type="submit" className="rx-btn-primary">
              Salvar nome
            </button>
            <button type="button" onClick={openAccountPortal} className="rx-btn-ghost">
              Gerenciar e-mail e senha
            </button>
          </div>
        </form>

        <div style={{ marginTop: 28 }}>
          <RxLabel>SOM E VIBRAÇÃO</RxLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              marginTop: 12,
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
                      borderRadius: 12,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
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
                      borderRadius: 12,
                    }}
                  >
                    {active ? "ATIVO" : "INATIVO"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {accountNotice ? (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              border: "1px solid rgba(251,146,60,0.3)",
              background: "rgba(251,146,60,0.08)",
              color: "var(--accent)",
              fontSize: 12,
              borderRadius: 12,
            }}
          >
            {accountNotice}
          </div>
        ) : null}
      </div>
    );
  }

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
                    borderRadius: 12,
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
              borderRadius: 12,
            }}
          >
            {lastError}
          </div>
        ) : null}

        <TelegramCard />
      </div>
    );
  }

  if (tab === "modules") {
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
                      borderRadius: 12,
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
        {entitlement.hasFullAccess ? (
          <div
            style={{
              border: "1px solid rgba(52,211,153,0.24)",
              background: "rgba(16,185,129,0.08)",
              color: "#bbf7d0",
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 13,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            {entitlement.label} ativo. {entitlement.reason}
          </div>
        ) : null}
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
                borderRadius: 12,
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
          {entitlement.hasFullAccess ? (
            <div
              style={{
                border: "1px solid rgba(52,211,153,0.28)",
                background: "rgba(16,185,129,0.1)",
                color: "#bbf7d0",
                padding: "12px 14px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Acesso completo liberado para esta conta.
            </div>
          ) : (
            <StripeCheckoutButton
              source="settings-module"
              className="rx-btn-primary"
              noteClassName="text-zinc-500"
              errorClassName="text-amber-200"
            >
              Ver planos e liberar acesso
            </StripeCheckoutButton>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function SettingsPage() {
  const { state } = useAppStore();
  const [tab, setTab] = useState<SettingsTab>("account");

  const activeModulesCount = moduleCatalog.filter(
    (module) => state.settings.activeModules[module.id],
  ).length;
  const activeTheme =
    themeOptions.find((option) => option.id === state.settings.theme) ??
    themeOptions[0];

  return (
    <div>
      <style>{`
        .settings-layout-v2 { display: grid; grid-template-columns: 220px 1fr; gap: 28px; align-items: start; }
        .settings-nav-v2 { border: 1px solid rgba(39,39,42,0.8); border-radius: 16px; overflow: hidden; background: rgba(14,14,17,0.96); }
        .settings-nav-item-v2 {
          width: 100%;
          padding: 12px 16px;
          font-size: 14px;
          color: #a1a1aa;
          border-bottom: 1px solid rgba(39,39,42,0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.15s;
          background: transparent;
          border-left: 2px solid transparent;
          border-right: none;
          border-top: none;
          text-align: left;
          font-family: inherit;
        }
        .settings-nav-item-v2:last-of-type { border-bottom: none; }
        .settings-nav-item-v2:hover { background: rgba(255,255,255,0.03); color: #f4f4f5; }
        .settings-nav-item-v2.active {
          color: var(--accent);
          background: rgba(251,146,60,0.06);
          border-left-color: var(--accent);
        }
        @media (max-width: 900px) { .settings-layout-v2 { grid-template-columns: 1fr; } }
      `}</style>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Configurações</div>
        <h1 className="page-title-v2">Preferências</h1>
        <p className="page-description-v2">
          Conta, tema <span style={{ color: "var(--accent)" }}>{activeTheme.name}</span>{" "}
          e {activeModulesCount} módulos visíveis
        </p>
      </div>

      <div className="settings-layout-v2">
        {/* Left nav */}
        <div className="settings-nav-v2">
          {settingsTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`settings-nav-item-v2${active ? " active" : ""}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <TabContent tab={tab} />
        </div>
      </div>
    </div>
  );
}
