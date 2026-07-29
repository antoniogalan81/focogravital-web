import type { NextConfig } from "next";
import { ANDROID_RELEASE_URL } from "./src/lib/androidRelease";

/**
 * Descarga del APK.
 *
 * El binario NO se sirve desde `public/` (120 MB en cada despliegue): vive como
 * asset de release en GitHub. La URL estable y de marca es `/focogravital.apk`,
 * que redirige al asset del release vigente definido en
 * `src/lib/androidRelease.ts` — el único sitio donde vive la versión.
 *
 * `/download/android` y `/ingravital.apk` son alias históricos ya publicados
 * (el primero en agalan.es). Apuntan a la ruta estable, no al release, para que
 * al cambiar de versión solo haya que tocar un fichero.
 *
 * Los redirects de Next conservan la query string automáticamente.
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/focogravital.apk",
        destination: ANDROID_RELEASE_URL,
        permanent: false, // el destino final cambia con cada versión
      },
      {
        source: "/download/android",
        destination: "/focogravital.apk",
        permanent: true,
      },
      {
        source: "/ingravital.apk",
        destination: "/focogravital.apk",
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
