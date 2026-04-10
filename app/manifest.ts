import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChiefOS",
    short_name: "Chief",
    description: "Your financial reality — job P&L, expenses, and crew time in one place.",
    start_url: "/app/dashboard",
    display: "standalone",
    background_color: "#0f1117",
    theme_color: "#0f1117",
    orientation: "portrait-primary",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
