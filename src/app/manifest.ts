import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Praxis Protocol",
    short_name: "Praxis",
    description:
      "Transforme sua rotina com o Praxis Protocol, um sistema de evolução operado por IA, com XP automático, módulos integrados e progresso real.",
    start_url: "/",
    display: "standalone",
    background_color: "#020202",
    theme_color: "#F00000",
    lang: "pt-BR",
    orientation: "portrait",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
