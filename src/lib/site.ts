/**
 * Identidad de marca y dominio canónico de Focogravital.
 *
 * Un único sitio de verdad: cualquier cambio de marca o de dominio se hace aquí
 * y no en veinte literales repartidos por las páginas.
 *
 * NEXT_PUBLIC_SITE_URL permite apuntar temporalmente al dominio que esté
 * realmente sirviendo (por ejemplo durante la migración desde ingravital.com)
 * sin tocar código. Sin esa variable, el canónico es focogravital.com.
 */

export const BRAND = "Focogravital";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://focogravital.com"
).replace(/\/$/, "");

export const CONTACT_EMAIL = "contacto@focogravital.com";

export const WHATSAPP_URL = "https://wa.me/34656195880";

/** Nombre del APK publicado. El antiguo (ingravital.apk) se redirige aquí. */
export const APK_FILENAME = "focogravital.apk";

/** Descarga del APK servida por el propio sitio. */
export const ANDROID_APK_URL = `/${APK_FILENAME}`;
