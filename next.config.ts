import type { NextConfig } from "next";

/**
 * Descarga del APK.
 *
 * El binario NO se sirve desde `public/` (120 MB en cada despliegue): vive como
 * asset de release en GitHub. La URL estable es `/download/android`
 * (`app/download/android/route.ts`), que redirige al asset del release vigente
 * definido en `src/lib/androidRelease.ts` — el único sitio donde vive la versión.
 *
 * Aquí solo quedan los enlaces históricos ya publicados, para que no se rompan.
 * Apuntan a la ruta estable, no al release.
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/focogravital.apk",
        destination: "/download/android",
        permanent: false, // el destino final cambia con cada versión
      },
      {
        source: "/ingravital.apk",
        destination: "/download/android",
        permanent: true,
      },
      // Finanzas ya no existe. Los enlaces y marcadores antiguos van a la agenda
      // en vez de a un 404. No queda nada del modulo detras de esta redireccion.
      {
        source: "/finanzas",
        destination: "/agenda?view=agenda",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
