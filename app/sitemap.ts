import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/site";

// Solo rutas públicas indexables. Agenda y metas exigen sesión.
const ROUTES = [
  "/",
  "/donaciones",
  "/servicios",
  "/login",
  "/signup",
  "/legal",
  "/legal/aviso-legal",
  "/legal/privacidad",
  "/legal/terminos",
  "/legal/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route === "/" ? "weekly" : "yearly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
