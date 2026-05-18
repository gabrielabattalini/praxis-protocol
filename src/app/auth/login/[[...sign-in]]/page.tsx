import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthConsoleShell } from "@/components/auth/auth-console-shell";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: prefillEmail } = await searchParams;
  const initialValues = prefillEmail
    ? { emailAddress: prefillEmail }
    : undefined;

  if (isLocalAuthBypassEnabled) {
    return (
      <AuthConsoleShell
        badge="Modo local"
        title="Iniciar protocolo"
        description="A identidade visual de acesso continua disponível no ambiente local. Como o Clerk está desativado aqui, usamos uma entrada direta para o dashboard."
        alternateHref="/auth/register"
        alternateLabel="Ver criação de conta"
        alternatePrompt="Quer validar o fluxo de cadastro também?"
      >
        <div className="glass" style={{ padding: 20 }}>
          <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 10 }}>
            ACESSO LOCAL
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--fg-3)", marginBottom: 18 }}>
            O bypass local está ativo porque não há chave pública do Clerk neste ambiente.
            A tela continua renderizada para revisão visual, mas a autenticação real fica
            disponível quando as credenciais estiverem configuradas.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="kpi" style={{ padding: 14 }}>
              <div className="praxis-label">Status</div>
              <div style={{ marginTop: 6, fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
                Sessão simulada para desenvolvimento
              </div>
            </div>
            <Link href="/dashboard" className="v2-btn v2-btn-primary" style={{ width: "100%" }}>
              Entrar no dashboard
            </Link>
          </div>
        </div>
      </AuthConsoleShell>
    );
  }

  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <AuthConsoleShell
      badge=""
      title="Iniciar protocolo"
      description=""
      alternateHref="/auth/register"
      alternateLabel="Criar nova identidade"
      alternatePrompt="Ainda não possui acesso?"
    >
      <SignIn
        path="/auth/login"
        routing="path"
        signUpUrl="/auth/register"
        fallbackRedirectUrl="/dashboard"
        initialValues={initialValues}
      />
    </AuthConsoleShell>
  );
}
