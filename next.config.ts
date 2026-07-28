import type { NextConfig } from "next";

/**
 * Descarga del APK.
 *
 * El binario NO se sirve desde `public/` (96 MB en cada despliegue): vive como
 * asset de release en GitHub. El sitio expone `/focogravital.apk` como URL
 * estable de marca y redirige ahí, de modo que cambiar de release no obliga a
 * tocar el código de las páginas.
 *
 * `/ingravital.apk` se mantiene redirigido para no romper enlaces antiguos
 * ya publicados.
 */
const APK_RELEASE_URL =
  "https://github.com/antoniogalan81/focogravital-web/releases/download/v1.1/focogravital.apk";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/focogravital.apk",
        destination: APK_RELEASE_URL,
        permanent: false, // el release cambia con cada versión
      },
      {
        source: "/ingravital.apk",
        destination: "/focogravital.apk",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
