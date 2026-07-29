/**
 * Publicación Android vigente de Focogravital.
 *
 * Única fuente de verdad de la descarga: de aquí salen el destino de la ruta
 * estable `/download/android` y los datos que muestra la web. Al publicar una
 * versión nueva solo se toca este fichero.
 *
 * El binario NO se sirve desde `public/` (120 MB en cada despliegue): vive como
 * asset de release en GitHub, y el sitio expone una URL de marca que redirige
 * ahí. Así el enlace publicado no cambia cuando cambia la versión.
 *
 * Todos los valores están tomados del propio artefacto compilado por EAS
 * (build 21, 2026-07-29), no de la configuración del proyecto.
 */

/** Ruta estable y pública. Es la que se enlaza desde fuera (agalan.es incluido). */
export const ANDROID_DOWNLOAD_PATH = "/download/android";

/** Asset real del release de GitHub al que redirige la ruta estable. */
export const ANDROID_RELEASE_URL =
  "https://github.com/antoniogalan81/focogravital-web/releases/download/v1.2.1/focogravital.apk";

export const ANDROID_RELEASE = {
  appName: "Focogravital",
  versionName: "1.2.1",
  versionCode: 21,
  applicationId: "com.agalansevilla.Ingravitalapp",
  /** Fecha de publicación del release. */
  publishedAt: "2026-07-29",
  /** Tamaño real del archivo, en bytes. */
  sizeBytes: 126_623_406,
  /** minSdkVersion 24. */
  minAndroid: "7.0",
  sha256: "30fa02b22148def69a0a8e8ad3460d48bf6895b64e3b1ca15f8295e520960b3e",
} as const;

/** Tamaño legible, redondeado a una decimal (p. ej. «120,8 MB»). */
export function androidSizeLabel(): string {
  const mb = ANDROID_RELEASE.sizeBytes / 1_048_576;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

/** Fecha en formato español, sin depender de la zona horaria del servidor. */
export function androidDateLabel(): string {
  const [y, m, d] = ANDROID_RELEASE.publishedAt.split("-");
  return `${Number(d)}/${m}/${y}`;
}
