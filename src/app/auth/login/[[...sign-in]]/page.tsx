import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthConsoleShell } from "@/components/auth/auth-console-shell";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

export default async function LoginPage() {
  if (isLocalAuthBypassEnabled) {
    redirect("/dashboard");
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
      />
    </AuthConsoleShell>
  );
}
