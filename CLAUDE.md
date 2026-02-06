# CLAUDE.md — DispatchHub

## Project

DispatchHub — operational software for EDCC Services Corp, a NYC demolition and carting company. 18 trucks, 16+ workers, all five boroughs. Currently a dispatch/intake tool, expanding to full company OS (Projects, Fleet, Crew, Planner, Dashboard modules).

## Stack

- **Framework:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database:** Prisma ORM + PostgreSQL on Neon (cloud, no local DB)
- **UI:** shadcn/ui components — do NOT modify files in `src/components/ui/`
- **State:** Zustand
- **Data fetching:** SWR
- **AI:** Anthropic Claude API
- **Maps:** Leaflet
- **Package manager:** pnpm (NEVER use npm)
- **Dev environment:** Windows, PowerShell, Cursor IDE

## Architecture

Single-page app: `src/app/page.tsx` renders all tabs.

```
src/
├── app/api/{module}/       # API routes
├── components/{module}/    # dispatch, intake, projects
├── components/ui/          # shadcn/ui (DO NOT EDIT)
├── hooks/index.ts          # single file, will split later
├── stores/index.ts         # single file, will split later
├── types/index.ts          # single file, will split later
├── lib/ai/claude.ts        # AI functions (single file, will split later)
├── lib/conflicts.ts        # conflict engine
└── lib/db.ts               # database singleton
```

## Business Domain

- **Job types:** PICKUP, DROP_OFF, DUMP_OUT only (no SWAP, no HAUL)
- **Boroughs:** MANHATTAN, BROOKLYN, BRONX, QUEENS, STATEN_ISLAND
- **Packer trucks** do DUMP_OUT (empty containers at demo sites)
- **Roll Off trucks** do DROP_OFF and PICKUP (move containers between sites)
- Multiple jobs on the same truck on the same day is a **ROUTE**, not a conflict
- A **conflict** is when two jobs have **overlapping time windows** on the same truck/driver
- **Dump sites:** KEY (EDCC primary) and GENERAL (reference transfer stations)
- **Project phases:** PLANNING → ACTIVE_DEMO → CARTING → CLEANUP → COMPLETE

## Design System

- Dark industrial theme
- Backgrounds: `bg-surface-0`, `bg-surface-1`, `bg-surface-2`
- Text: `text-text-0` (primary), `text-text-1`, `text-text-2` (muted), `text-text-3` (faint)
- Accent: amber (buttons, active states, highlights)
- Status colors: green (success), red/danger (critical), purple (info)
- Fonts: DM Sans (UI text), JetBrains Mono (data, times, IDs)
- Mobile-first: all new features must work on phone screens

## Commands

```bash
pnpm dev              # start dev server
pnpm build            # production build (run before committing)
pnpm lint             # run linter
pnpm db:generate      # prisma generate (may EPERM on Windows/OneDrive — non-blocking)
pnpm db:push          # push schema to Neon (NOT migrate in dev)
pnpm db:seed          # seed DB (62 jobs, 6 routes, 10 dump sites, 16 workers, 18 trucks)
pnpm db:studio        # open Prisma Studio
```

## Database

- Schema changes: `npx prisma db push` (not migrate in dev)
- Seed: `npx prisma db seed`
- Generate client: `npx prisma generate`

## Known Issues

- No authentication — all routes are public, hardcoded "Dispatcher" user
- No input validation — Zod is installed but unused
- God components: `intake-card.tsx` (777 lines), `war-room-panel.tsx` (683 lines)
- Store monolith: `useCommandCenterStore` has 30+ fields
- Silent error swallowing in intake approval routes

## Code Conventions

- Always explain what you're changing and WHY before making changes
- Commit with descriptive messages after completing tasks
- Keep components under 300 lines where possible
- Use existing shadcn/ui primitives, don't build custom versions
- API routes return `{ data: ... }` envelope
- SWR hooks return `{ data, loading, error, refetch }`
- Test builds with `pnpm build` before committing

## Vision

Building toward a full company operating system. Planned modules:

1. Dispatch Hub (carting) — BUILT
2. Intake (phone/email → jobs) — BUILT
3. Projects (demo project management, AI chat for Fabio) — BUILDING NOW
4. Fleet (truck tracking, GPS via IntelliShift, maintenance)
5. Crew (worker profiles, certs, scheduling, clock-in/out)
6. Planner (calendar view across dispatch + projects)
7. Company Dashboard (KPIs across everything)
8. Crew Field App (mobile — clock in, job updates, photos)
9. Settings/Integrations

All modules share one database. AI chat pattern (sidebar with agentic actions) will be reused across modules. Auth with roles (boss, dispatcher, driver, office) coming before production. Current build is MVP — will rebuild with proper architecture after validating with real users.

## Do NOT

- Do not restructure the file organization without explicit approval
- Do not add new npm dependencies without asking
- Do not change the database schema without explaining why first
- Do not build features for modules that aren't being worked on yet
- Do not remove existing functionality to "clean up"
