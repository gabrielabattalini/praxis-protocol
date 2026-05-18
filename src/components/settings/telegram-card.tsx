"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Link2, Unlink, RefreshCw, CheckCircle2 } from "lucide-react";
import { RxLabel, RxPanel } from "@/components/redesign/primitives";

type TelegramStatus = {
  configured: boolean;
  linked: boolean;
  username?: string;
  firstName?: string;
  linkedAt?: string;
  botUsername?: string;
};

const btnBase = {
  padding: "8px 14px",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
} as const;

export function TelegramCard() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/status", { cache: "no-store" });
      if (res.ok) {
        setStatus((await res.json()) as TelegramStatus);
      }
    } catch {
      /* keep last known status */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect() {
    setBusy("connect");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Não foi possível gerar o link de conexão.");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
      setNotice(
        "Abra o Telegram, toque em INICIAR no bot, depois volte e clique em Verificar.",
      );
    } catch {
      setError("Falha de rede ao gerar o link.");
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    setError("");
    await refresh();
    setBusy(null);
  }

  async function sendTest() {
    setBusy("test");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Falha ao enviar o teste.");
        return;
      }
      setNotice("Mensagem de teste enviada — confira seu Telegram.");
    } catch {
      setError("Falha de rede ao enviar o teste.");
    } finally {
      setBusy(null);
    }
  }

  async function unlink() {
    setBusy("unlink");
    setError("");
    setNotice("");
    try {
      await fetch("/api/telegram/unlink", { method: "POST" });
      setNotice("Telegram desconectado desta conta.");
      await refresh();
    } catch {
      setError("Falha ao desconectar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 36 }}>
      <RxLabel>CANAL DO TELEGRAM</RxLabel>
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
        Lembretes no Telegram
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
        Vincule seu Telegram à conta para receber tarefas, hábitos e eventos
        direto no app, em qualquer dispositivo — independente do navegador.
      </div>

      {loading ? (
        <RxPanel style={{ padding: 16 }}>
          <span style={{ fontSize: 13, color: "var(--fg-3)" }}>
            Verificando status…
          </span>
        </RxPanel>
      ) : !status?.configured ? (
        <RxPanel style={{ padding: 16 }}>
          <span style={{ fontSize: 13, color: "var(--fg-3)" }}>
            O canal do Telegram ainda não foi ativado no servidor. Tente
            novamente em instantes.
          </span>
        </RxPanel>
      ) : (
        <>
          <RxPanel style={{ padding: 16, marginBottom: 14 }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: status.linked
                    ? "var(--accent)"
                    : "var(--fg-4)",
                  boxShadow: status.linked
                    ? "0 0 10px var(--accent)"
                    : "none",
                }}
              />
              <div>
                <div
                  className="rx-display"
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--fg)",
                  }}
                >
                  {status.linked
                    ? "Conectado"
                    : "Não conectado"}
                </div>
                <div
                  className="rx-mono"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-4)",
                    marginTop: 2,
                  }}
                >
                  {status.linked
                    ? `${
                        status.username
                          ? `@${status.username}`
                          : status.firstName || "conta vinculada"
                      }${
                        status.linkedAt
                          ? ` · desde ${new Date(
                              status.linkedAt,
                            ).toLocaleDateString("pt-BR")}`
                          : ""
                      }`
                    : status.botUsername
                      ? `Bot: @${status.botUsername}`
                      : "Pronto para conectar"}
                </div>
              </div>
            </div>
          </RxPanel>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {!status.linked ? (
              <>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={busy === "connect"}
                  className="rx-btn-primary"
                  style={{
                    ...btnBase,
                    opacity: busy === "connect" ? 0.5 : 1,
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Conectar Telegram
                </button>
                <button
                  type="button"
                  onClick={() => void verify()}
                  disabled={busy === "verify"}
                  className="rx-btn-ghost"
                  style={{
                    ...btnBase,
                    opacity: busy === "verify" ? 0.5 : 1,
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Já conectei · Verificar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void sendTest()}
                  disabled={busy === "test"}
                  className="rx-btn-primary"
                  style={{
                    ...btnBase,
                    opacity: busy === "test" ? 0.5 : 1,
                  }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar teste
                </button>
                <button
                  type="button"
                  onClick={() => void unlink()}
                  disabled={busy === "unlink"}
                  className="rx-btn-ghost"
                  style={{
                    ...btnBase,
                    opacity: busy === "unlink" ? 0.5 : 1,
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              </>
            )}
          </div>

          {notice ? (
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid rgba(52,211,153,0.3)",
                background: "rgba(52,211,153,0.08)",
                color: "var(--fg)",
                fontSize: 12,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {notice}
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid rgba(251,146,60,0.3)",
                background: "rgba(251,146,60,0.08)",
                color: "var(--accent)",
                fontSize: 12,
                borderRadius: 12,
                marginTop: notice ? 8 : 0,
              }}
            >
              {error}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
