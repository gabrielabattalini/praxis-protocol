import { AppShell } from "@/components/app-shell";
import { PaywallGate } from "@/components/billing/paywall-gate";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // PaywallGate: sem plano ativo, nenhum módulo abre (não há free tier).
  // O shell (navegação) continua visível; o conteúdo vira a tela de
  // ativação. O gate de verdade é do servidor — isto é só a UI dele.
  return (
    <AppShell>
      <PaywallGate>{children}</PaywallGate>
    </AppShell>
  );
}
