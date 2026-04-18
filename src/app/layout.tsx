import type { Metadata, Viewport } from "next";
import { ptBR } from "@clerk/localizations";
import { Inter, Rajdhani, Space_Grotesk } from "next/font/google";
import { AppStoreProvider } from "@/components/providers/app-store-provider";
import { AuthClientProvider } from "@/components/providers/auth-client-provider";
import { NotificationsProvider } from "@/components/providers/notifications-provider";
import { clerkAppearance } from "@/lib/clerk-ui";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: "Praxis Protocol | Sistema de Evolução",
  description:
    "Transforme sua rotina com o Praxis Protocol, um sistema de evolução operado por IA, com missões, XP e progresso inteligente.",
  applicationName: "Praxis Protocol",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Praxis Protocol | Sistema de Evolução",
    description:
      "Um protocolo de evolução operado por IA, com missões, XP, níveis, módulos e progresso inteligente.",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Praxis Protocol | Sistema de Evolução",
    description:
      "Um protocolo de evolução operado por IA, com missões, XP, níveis, módulos e progresso inteligente.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${rajdhani.variable} bg-[var(--background)] font-sans antialiased`}
      >
        <AuthClientProvider
          clerkProps={{
            appearance: clerkAppearance,
            localization: ptBR,
            signInUrl: "/auth/login",
            signUpUrl: "/auth/register",
            signInFallbackRedirectUrl: "/dashboard",
            signUpFallbackRedirectUrl: "/dashboard",
            afterSignOutUrl: "/auth/login",
          }}
        >
          <AppStoreProvider>
            <NotificationsProvider>{children}</NotificationsProvider>
          </AppStoreProvider>
        </AuthClientProvider>
      </body>
    </html>
  );
}
