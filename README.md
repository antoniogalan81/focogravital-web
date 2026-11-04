# Focogravital — web

Aplicación de metas, tareas y agenda. Antes se publicaba como **Ingravital**;
desde julio de 2026 la marca es **Focogravital** y el dominio canónico es
`https://focogravital.com`.

> No confundir con **Invergravital** (`invergravital.com`), que es la aplicación
> de análisis y gestión de inversiones inmobiliarias y vive en otro repositorio.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS v4 · Supabase

## Comandos

```bash
npm ci           # instalar dependencias
npm run dev      # desarrollo
npm run build    # build de producción
npm run start    # servir el build
npm run lint     # ESLint
```

No hay suite de tests configurada.

## Variables de entorno

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase (navegador) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (navegador) |
| `SUPABASE_URL` | Rutas API del servidor (`/api/tasks`, `/api/leads`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo `/api/leads` (salta RLS, jamás en el cliente) |
| `NEXT_PUBLIC_SITE_URL` | Opcional. Fuerza el dominio canónico. Sin ella se usa `https://focogravital.com` |

## Autenticación (Supabase Auth)

La sesión vive en el `localStorage` del navegador (`sb-<ref>-auth-token`), que
es **por origen**: una sesión creada en `www.ingravital.com` no existe en
`focogravital.com`. `supabase-js` la recupera al cargar y renueva el access
token (1 h) con el refresh token, que no caduca mientras no se cierre sesión o
se revoque (sin *time-box* ni *inactivity timeout* configurados).

Configuración obligatoria en *Authentication → URL Configuration*:

- **Site URL:** `https://focogravital.com`
- **Redirect URLs:** `https://focogravital.com/**` (más `http://localhost:3000/**`
  para desarrollo y `ingravitalapp://auth/callback` para la app Android).

Si el origen desde el que se inicia sesión no está en *Redirect URLs*, Supabase
ignora `redirectTo` **sin avisar** y devuelve al usuario a la *Site URL*: la
sesión se guarda en ese otro dominio y el usuario tiene que volver a entrar con
Google cada vez. Es lo que pasaba hasta noviembre de 2026, cuando la *Site URL*
seguía siendo `ingravital.com`. Cualquier cambio de dominio tiene que tocar
también esta configuración.

## Marca y dominio

Todo lo relativo a marca, dominio, email de contacto y descarga del APK está
centralizado en `src/lib/site.ts`. Para cambiar de dominio basta con esa
constante (o con `NEXT_PUBLIC_SITE_URL`); no hay literales repartidos.

## Descarga de Android

El APK **no** se versiona ni se sirve desde `public/` (pesa ~96 MB). Se publica
como asset de release en GitHub y el sitio expone la URL estable
`/focogravital.apk`, que redirige al release actual (ver `next.config.ts`).
`/ingravital.apk` sigue redirigiendo ahí con un 308 (redirección permanente que
conserva el método) para no romper enlaces antiguos.

## Claves de `localStorage`

Las claves siguen con el prefijo `ingravital`. Es **deliberado**: renombrarlas
borraría estado y datos ya guardados en los navegadores de los usuarios
existentes. Están marcadas con un comentario en el código.
