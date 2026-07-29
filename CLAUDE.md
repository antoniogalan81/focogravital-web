# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Brand

This is **Focogravital** (goals / tasks / agenda app). Canonical domain
`https://focogravital.com`. It was published as *Ingravital* until July 2026 —
that name only survives in `localStorage` keys, kept on purpose so existing
users do not lose stored state. Do NOT rename those keys.

Do not confuse this project with **Invergravital** (`invergravital.com`), the
real-estate investment app, which lives in a different repository.

Brand, domain, contact email and APK download live in `src/lib/site.ts`.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4 + Supabase

**Path alias:** `@/*` maps to the project root.

### Directory layout

- `app/` — Next.js App Router pages and API routes. Pages are feature-named (`agenda`, `account`, `auth/*`).
- `app/api/` — Thin API routes (`tasks`, `leads`, `app-update`); all require Supabase bearer-token auth.
- `src/components/` — Reusable React components, with a `tasks/` sub-folder.
- `src/contexts/` — React Context providers (`AuthContext`, and the sync `SyncContext`).
- `src/hooks/` — Custom hooks (`useTaskEditor`, `useGlobalUi`).
- `src/lib/` — Business logic and utilities. `types.ts` is the canonical type definitions file.
- `src/sync/` — Custom sync engine (pull/push against Supabase with dirty tracking and normalization).
- `components/` (root) — `SiteShell.tsx`, the top-level layout shell.
- `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts` — file-based metadata routes (PWA manifest, robots, sitemap).
- `supabase/migrations/` — Database migration SQL files.

### Core domain model (`src/lib/types.ts`)

- **TaskData** — tasks with type (`ACTIVIDAD`, `INGRESO`, `GASTO`, `MULTI`), scope (`LABORAL`, `FISICO`, `CRECIMIENTO`), status (`done`/`pending`/`hidden`), frequency (`PUNTUAL`, `SEMANAL`, `MENSUAL`), and hierarchical parent-child relationships. `INGRESO`/`GASTO` are task types that carry an `amountEUR` the user types in; they are NOT a finance module.
- **Meta** — goals with time horizons (`1M` → `10Y`).

### Sync engine (`src/sync/`)

The sync engine handles offline-capable, multi-device data synchronization:
- **Pull:** incremental fetch from Supabase using `server_updated_at` timestamps.
- **Push:** debounced upsert of dirty entities back to Supabase.
- `ENTITY_CONFIGS` in `src/sync/types.ts` controls which entities are synced and how.
- Normalization/hydration per entity: `normalizeMeta.ts`, `normalizeTask.ts`.
- `SyncContext` exposes the store and sync controls to components.

### State management

- **Server state:** Supabase via the sync engine.
- **App state:** React Context (`AuthContext` for auth/profile, `SyncContext` for data store).
- **Local persistence:** `localStorage` for UI preferences, filter state, last sync timestamp.
- **Component state:** `useState` + custom hooks.

### UI language

The application UI is in **Spanish**. Key terms: _Metas_ (goals), _Agenda_ (schedule), _Actividad/Físico/Crecimiento_ (task scopes).

### Styling

Tailwind CSS v4 with utility classes inline in components. Global styles in `app/globals.css`.
