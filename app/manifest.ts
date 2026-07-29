import type { MetadataRoute } from "next";
import { BRAND } from "@/src/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND} — metas, agenda y tareas`,
    short_name: BRAND,
    description:
      "Convierte tus metas en acciones diarias. Metas, tareas y agenda en un solo sitio.",
    lang: "es",
    start_url: "/agenda?view=agenda",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
