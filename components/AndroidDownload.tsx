import {
  ANDROID_DOWNLOAD_PATH,
  ANDROID_RELEASE,
  androidDateLabel,
  androidSizeLabel,
} from "@/src/lib/androidRelease";
import { APK_FILENAME, CONTACT_EMAIL, WHATSAPP_URL } from "@/src/lib/site";

/**
 * Sección de descarga de la aplicación Android.
 *
 * Los datos de la ficha (versión, fecha, tamaño, Android mínimo) salen del
 * artefacto realmente publicado, no de la configuración del proyecto: viven en
 * `src/lib/androidRelease.ts` y se actualizan al publicar cada release.
 *
 * El canal para proponer mejoras es el que ya existe en el sitio (WhatsApp y
 * correo de contacto). No se inventa ningún formulario.
 */
export default function AndroidDownload() {
  const ficha: [string, string][] = [
    ["Aplicación", ANDROID_RELEASE.appName],
    ["Versión publicada", ANDROID_RELEASE.versionName],
    ["Actualizada el", androidDateLabel()],
    ["Tamaño aproximado", androidSizeLabel()],
    ["Compatibilidad", `Android ${ANDROID_RELEASE.minAndroid} o superior`],
  ];

  return (
    <section
      id="android"
      aria-labelledby="android-titulo"
      className="mt-20 sm:mt-28 -mx-6 rounded-3xl bg-slate-900 px-6 py-16 text-white"
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2
            id="android-titulo"
            className="text-3xl sm:text-4xl font-bold tracking-tight"
          >
            Descarga la aplicación para Android
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            La aplicación es completamente funcional y la estamos actualizando
            varias veces al día para corregir errores, pulir su funcionamiento e
            incorporar nuevas mejoras.
          </p>

          <p className="mt-5 text-lg leading-relaxed text-slate-300">
            También puedes contribuir a mejorarla. Cuéntanos qué funciones o
            utilidades te gustaría que incorporase. Si la propuesta es viable y
            puede resultar útil para más usuarios de la comunidad, estudiaremos
            su implementación.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href={ANDROID_DOWNLOAD_PATH}
              download={APK_FILENAME}
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200"
            >
              Descargar APK para Android
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Proponer una mejora por WhatsApp
            </a>
          </div>

          <p className="mt-5 text-sm text-slate-400">
            También puedes escribirnos a{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline-offset-4 hover:text-slate-200 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . Al instalar, Android pedirá permiso para instalar aplicaciones de
            orígenes desconocidos: es lo normal fuera de Google Play.
          </p>
        </div>

        <dl className="grid content-start gap-px overflow-hidden rounded-2xl bg-white/10 text-sm">
          {ficha.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-6 bg-slate-900 px-5 py-4"
            >
              <dt className="text-slate-400">{k}</dt>
              <dd className="text-right font-semibold text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
