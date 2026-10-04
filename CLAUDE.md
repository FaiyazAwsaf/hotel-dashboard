# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Auberge is a demo prototype of a hotel ERP/CRM/VMS with an omnichannel AI dashboard. It is built for live demos, not deployment. **There is no backend, database, API or model call.** All data is generated on the client, deterministically, and every AI feature is scripted.

Next.js here is 16.x with breaking changes from older versions (see `AGENTS.md`). Read `node_modules/next/dist/docs/` before using Next APIs you are unsure of.

## Commands

The README and the committed `bun.lock` use bun. `package.json` also has a `packageManager: yarn@1.22.22` field.

```bash
bun install
bun run dev         # http://localhost:3000 → redirects to /login (any credentials work)
bun run build       # production build — the real end-to-end check
bun run typecheck   # tsc --noEmit
bun run format      # prettier (no semicolons, double quotes, tailwind class sorting)
```

- There is **no test suite**. Verify changes with `typecheck` and `build`.
- **`bun run lint` is known to fail.** ESLint 10 is incompatible with the `eslint-plugin-react` that `eslint-config-next@16.3.4` pulls in. The failure is a dependency conflict, not a problem in the app code.
- Some bugs only reproduce against a production build (`build` + `start`), not in dev. The page-transition blank-screen bug fixed in `app/(app)/template.tsx` is one example.

## Architecture

### Data: one seeded dataset per tenant

- `lib/mock/generate.ts` → `generateDataset(tenant)` builds the whole `Dataset`: rooms, reservations, guests, staff, CRM, finance, VMS, conversations, calls, series, KPIs and so on. It is a pure function of `tenant.slug`, using the mulberry32 RNG in `lib/mock/rng.ts`.
- The generator draws from a single RNG stream in a fixed order. **Inserting, removing or reordering a `build*` call or an `rng.*` draw reshuffles every collection generated after it.** Append new draws at the end, or give the new data its own `createRng(...)`.
- Name, label and text pools are in `lib/mock/pools.ts`. VMS, conversations, calls and insights each have their own module under `lib/mock/`.
- `lib/data.tsx` → `DataProvider` caches one dataset per tenant and exposes these hooks:
  - `useDataset()` for raw collections
  - `useLookups()` for id → entity maps
  - `useMoney()` for currency formatting bound to the active locale and tenant
  - `useTenant()` / `useTenants()`
- Pages read data only through these hooks and derive views with `useMemo`. Nothing ever fetches.
- `lib/tenants.ts` defines three properties. Switching tenant (`useUi().tenantId`) swaps the whole dataset and the currency (BDT or USD).

### Session edits: creating and changing records

- The generated dataset is never mutated. To create or change records, use `useDataEdits()` from `lib/data.tsx`:
  - `add(collection, record)` puts a new record at the top of its collection.
  - `update(collection, id | ids, changes)` merges field changes into one record or several.
  - `newId(prefix)` makes an id for a new record. Call it from event handlers only, never during render.
- The edits live in `lib/session.ts`, kept separately for each property. `DataProvider` merges them over the cached dataset, so `useDataset()`, `useLookups()`, KPIs and sidebar counts all see them.
- Edits are deliberately **not persisted**. A reload restores the pristine demo, and server and client renders always match. The ⌘K command "Reset demo data" clears them all.
- Do not keep page-local copies of edited records; the room rack, housekeeping board and pipeline all edit through this layer.
- Timestamps on new records come from `demoNow()`.
- Put domain operations that touch several collections in an actions hook, so every screen stays consistent. For example, `useVmsActions()` in `lib/vms-actions.ts` handles visitor check-out: the visitor, an exit movement and the returned luggage. It also exports `can…` predicates; bulk-action buttons use them to disable themselves.

### Time and hydration safety

Every page is a client component, but each is still server-rendered once. Server output and client output must match exactly.

- `lib/demo-time.ts`: all generated data is anchored to `demoToday()` (the current UTC midnight), and "now" is `demoNow()` (10:00 UTC on that day). **Never use `Date.now()` or `new Date()` for anything rendered.** Use the demo clock.
- The time series holds 181 days, and **index 90 is today** (`SERIES_TODAY_INDEX` in `lib/metrics.ts`). `lib/report-range.ts` maps the top-bar date range onto slices of the series, and `computeKpis` recomputes KPIs for any window.
- Read the reporting range through `useReportRange()` (in `lib/store.ts`), never as `reportRange` straight off the store. Presets must be resolved at render time. If they are frozen at module load, they go stale on a long-running server.
- `formatRelative` measures from `demoNow()` and spells out Bangla relative times by hand, because Node and Chrome `Intl` output differ.
- localStorage values (locale, theme, persisted store) become known only after mount. Gate renders that depend on them with `hooks/use-mounted.ts`.

### Client state

- `lib/store.ts` holds the Zustand `useUi` store, persisted under `auberge.ui`. Only `tenantId`, `sidebarCollapsed` and `uiScale` are persisted.
- The store also holds UI toggles that are not persisted: the copilot dock, the command palette, the report range and per-conversation autopilot overrides.

### i18n (Bangla is the default)

- Dictionaries live in `lib/i18n/en.ts` and `lib/i18n/bn.ts`. `bn` is typed as `Dictionary` (the shape of `en`), so **every key must be added to both files**, or the typecheck fails.
- `useLocale()` / `useT()` come from `lib/i18n/provider.tsx`:
  - `t()` takes a typed `TranslationKey` dot-path.
  - `tk()` is the untyped escape hatch for keys built at runtime.
  - `num`, `pct`, `date`, `relative` and the other formatters render Bengali digits and lakh/crore grouping in `bn`.
- Generated and scripted content uses `Bilingual = { en, bn }` objects, indexed with `value[locale]`. The Bangla text is written natively, not transliterated.
- Never render raw numbers, dates or currency. Always go through the locale formatters or `useMoney()`.

### App shell and routing

- `app/(app)/` contains the authenticated screens. `layout.tsx` provides the sidebar, top bar, copilot dock and command palette. The page fade-in transition lives in `template.tsx`, not in the layout. `AnimatePresence` in the layout caused blank screens.
- `app/(auth)/` contains the login, signup, OTP and property-select flows. Auth is fake.
- `lib/nav.ts` → `NAV` is the single source of truth for navigation. The sidebar, the command palette and the top-bar breadcrumbs all read from it, the latter two through `NAV_INDEX`. To add a screen:
  1. Create `app/(app)/<route>/page.tsx` with `"use client"`.
  2. Add a `NAV` entry with a `labelKey`.
  3. Add that label to both dictionaries.

### Scripted AI

- `lib/ai/copilot.ts` → `COPILOT_ANSWERS`: answers are routed by keyword matching in either language. Each answer carries fake `ToolCall`s that `components/ai/tool-call-card.tsx` renders as live charts and tables from the real generated dataset.
- `lib/ai/inbox-replies.ts` → `routeReply()` provides the inbox autopilot responses.
- The voice-call transcript is in `lib/mock/calls.ts`. The report-studio pipeline is in `components/motion/pipeline-runner.tsx`.
- Streaming is simulated with `components/motion/streaming-text.tsx`.

### UI layer

- `components/ui/` holds shadcn/ui components built on **Base UI, not Radix** (style `base-mira`). Compose triggers with the `render` prop (e.g. `render={<Link href="…" />}`), not `asChild`.
- `components/motion/` holds the app's shared building blocks: `PageHeader`, `Panel` and `EmptyState` (card-shell), `DataTable`, `StatusTag`, `KpiStrip`, the room-rack Gantt, comb charts and so on. Reuse these before writing new layout primitives.
- **`DataTable` with `selectable`:** selecting rows opens a selection bar with "select all" across pages and **Export** (CSV of the selected rows).
  - Pass `bulkActions={(rows, clearSelection) => …}` to add page-specific actions, and `exportName` (an English slug) to name the exported file.
  - Exports use each column's accessor value. Enum columns need `meta: { exportValue: (row) => label }`, or the file gets raw keys like `checkedIn`. `meta: { export: false }` leaves a column out.
- **Forms:** use `FormSheet` + `FormSheetField` (`components/motion/form-sheet.tsx`). It is a side panel with required-field checks and errors in the interface language.
  - The field render prop gives props to spread onto the control.
  - `Select` and other controls without DOM change events call `clearError` from the render prop's second argument.
- **Files and printing:**
  - `lib/export.ts` has `downloadCsv` and `exportFileName`. Files are UTF-8 with a byte-order mark so Excel reads Bangla, and the export guards against spreadsheet formulas.
  - `lib/print.tsx` has `usePrint()` and `PrintDocument`. The content is rendered into a hidden iframe carrying the app's styles, so it always prints in the light theme at 100% scale, uncut by the app frame. `@page` size and margin are options.
  - Keep printed content static: entry animations print at their first frame.
- `cn` is imported from the `cn` npm package through `lib/utils.ts`, not built from clsx and tailwind-merge.
- Colors are tokens in `app/globals.css` (Tailwind v4 `@theme inline`). Entity colors use the `TagHue` palette (`--hue-*` variables, `tag-*` classes, `hueFor(key)` in `lib/hue.ts`). Chart series use `CHART_COLORS`. Do not hard-code colors.
- The root font size is `16px * var(--ui-scale)` (90–140%). Size text and spacing in `rem` (the codebase uses `text-[0.6875rem]` and similar, not `px`) so that everything scales together.
- The Bangla font comes from `html[lang="bn"]` in the base CSS layer. Do not put a `font-sans` utility on `<html>`, because it would override that rule. In English it is the fallback after Inter, which has no ৳ glyph.
