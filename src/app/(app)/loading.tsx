import { NavigationLoadingOverlay } from "@/components/ui/navigation-loading-overlay";

export default function ProtectedLoading() {
  return (
    <NavigationLoadingOverlay
      message="Carregando página"
      detail="Aguarde enquanto o Praxis prepara a próxima interface."
      className="z-[110]"
    />
  );
}
