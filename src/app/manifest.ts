import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` fixo: estabiliza a IDENTIDADE do PWA entre deploys. Sem ele, o
    // navegador identifica o app pela start_url e pode "perder" a
    // instalação (ícone órfão/some) em updates. Com id estável, a mesma
    // instalação é reconhecida sempre.
    id: "/",
    name: "Praxis Protocol",
    short_name: "Praxis",
    description:
      "Transforme sua rotina com o Praxis Protocol, um sistema de evolução operado por IA, com XP automático, módulos integrados e progresso real.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0d",
    theme_color: "#fb923c",
    lang: "pt-BR",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
