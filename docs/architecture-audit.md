# DispatchHub Architecture Audit

**Date:** 2026-02-06
**Scope:** Full codebase audit for scaling from 2-module dispatch tool to 9-module EDCC Operating System
**Status:** Report only — no changes made

---

## Table of Contents

1. [File Structure & Organization](#1-file-structure--organization)
2. [Store Architecture](#2-store-architecture)
3. [Type System](#3-type-system)
4. [API Routes](#4-api-routes)
5. [Hooks](#5-hooks)
6. [Components](#6-components)
7. [AI Layer](#7-ai-layer)
8. [Database](#8-database)
9. [Conflict Engine (Critical Bug)](#9-conflict-engine-critical-bug)
10. [Scalability Concerns](#10-scalability-concerns)
11. [Priority-Ranked Findings](#11-priority-ranked-findings)
12. [Refactoring Plan](#12-refactoring-plan)

---

## 1. File Structure & Organization

### Current State

```
src/
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Single-page app shell (all tabs)
│   ├── globals.css
│   └── api/
│       ├── confirm/route.ts
│       ├── dispatch/
│       │   ├── apply-scenario/route.ts
│       │   ├── job-analyze/route.ts
│       │   ├── quick-recommend/route.ts
│       │   ├── routes/route.ts
│       │   ├── scenario-analyze/route.ts
│       │   └── voice-command/route.ts
│       ├── intake/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   ├── approve/route.ts
│       │   ├── batch-approve/route.ts
│       │   ├── parse/route.ts
│       │   └── preview-analyze/route.ts
│       ├── jobs/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── conflicts/route.ts
│       ├── search/route.ts
│       ├── trucks/route.ts
│       └── workers/
│           ├── route.ts
│           └── recommend/route.ts
├── components/
│   ├── ui/                           # 14 shadcn primitives
│   ├── dispatch/                     # 13 dispatch components
│   └── intake/                       # 7 intake components
├── hooks/
│   └── index.ts                      # ALL hooks in one file
├── lib/
│   ├── utils.ts                      # 2 utility functions
│   ├── db.ts                         # Prisma singleton
│   ├── confirmation.ts               # Confirmation system
│   ├── conflicts.ts                  # Conflict detection engine
│   ├── ai/
│   │   └── claude.ts                 # ALL AI functions (799 lines)
│   └── integrations/
│       ├── intellishift.ts           # Fleet GPS
│       ├── outlook.ts                # Email
│       └── ringcentral.ts            # Voice/SMS
├── stores/
│   └── index.ts                      # ALL stores in one file
└── types/
    └── index.ts                      # ALL types in one file (520 lines)
```

### Problems

1. **Single-file bottleneck pattern.** Types (520 lines), hooks, stores, and AI (799 lines) are each crammed into a single file. This works for 2 modules. At 9 modules these files become 2000+ line monsters that create merge conflicts and make navigation painful.

2. **Flat component directories.** `components/dispatch/` has 13 files with no sub-grouping. When Projects, Fleet, and Crew each add 10-15 components, the flat structure becomes unmanageable.

3. **No shared component layer.** Reusable patterns (efficiency circles, status badges, date pickers, resource selectors) are inlined into module-specific components. There is no `components/shared/` directory.

4. **No server-side utility layer.** Duplicated logic across API routes (date parsing, job queries, changelog creation) has no home. `src/lib/utils.ts` contains only 2 client-side helpers.

5. **`page.tsx` is a single-page shell.** All 7 tabs render from one file. This prevents per-module code splitting and means the entire app loads at once regardless of which tab the user needs.

### Recommended Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         # Dashboard/redirect only
│   ├── (dispatch)/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── (intake)/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── (projects)/...
│   ├── (fleet)/...
│   ├── (crew)/...
│   ├── (planner)/...
│   ├── (settings)/...
│   └── api/
│       ├── dispatch/...
│       ├── intake/...
│       ├── projects/...
│       ├── fleet/...
│       ├── crew/...
│       └── shared/                      # Shared API utils
│           ├── auth.ts                  # Auth middleware
│           ├── validate.ts              # Input validation
│           └── queries.ts               # Common DB queries
├── components/
│   ├── shared/                          # Cross-module components
│   │   ├── status-badge.tsx
│   │   ├── efficiency-circle.tsx
│   │   ├── resource-selector.tsx
│   │   ├── date-navigator.tsx
│   │   └── confirmation-status.tsx
│   ├── ui/                              # shadcn primitives (unchanged)
│   ├── dispatch/
│   │   ├── command-center/
│   │   ├── war-room/
│   │   └── chat/
│   ├── intake/
│   │   ├── card/
│   │   ├── preview/
│   │   └── approval/
│   ├── projects/...
│   ├── fleet/...
│   └── crew/...
├── hooks/
│   ├── dispatch.ts
│   ├── intake.ts
│   ├── projects.ts
│   ├── fleet.ts
│   ├── crew.ts
│   └── shared.ts                        # useGlobalSearch, common fetcher
├── lib/
│   ├── utils.ts                         # Client utilities
│   ├── server-utils.ts                  # Date parsing, query helpers
│   ├── db.ts
│   ├── auth.ts                          # Auth helpers
│   ├── confirmation.ts
│   ├── conflicts.ts
│   ├── ai/
│   │   ├── client.ts                    # Anthropic singleton
│   │   ├── dispatch.ts                  # Dispatch AI functions
│   │   ├── intake.ts                    # Intake parsing
│   │   ├── projects.ts                  # Project brain
│   │   └── shared-prompts.ts            # Shared context builders
│   └── integrations/...
├── stores/
│   ├── dispatch.ts
│   ├── ui.ts
│   ├── intake.ts
│   ├── projects.ts
│   └── command-center.ts
└── types/
    ├── index.ts                         # Re-exports + shared enums
    ├── dispatch.ts
    ├── intake.ts
    ├── projects.ts
    ├── fleet.ts
    ├── crew.ts
    └── api.ts                           # API response wrappers
```

**Priority: P1** — Not blocking Projects, but becomes increasingly painful to defer.

---

## 2. Store Architecture

### Current State

**File:** `src/stores/index.ts` (~230 lines)
**Pattern:** 4 Zustand stores in one file

| Store | Purpose | State pieces |
|-------|---------|-------------|
| `useDispatchStore` | Date selection, job modal, mic state | 3 |
| `useUiStore` | Active tab, search, changelog | 4 |
| `usePreviewStore` | Intake preview sandbox | 5 |
| `useCommandCenterStore` | Routes, scenarios, sidebar, analysis, cards | **30+** |

### Problems

1. **`useCommandCenterStore` is a monolith.** 30+ state fields and 25+ actions managing routes, scenarios, sidebar chat, job analysis, resource cards, modified fields, and a result cache. This single store handles what should be 4-5 separate concerns.

2. **No store isolation between modules.** When Projects needs its own scenario planning or resource cards, there's no pattern to follow — just add more fields to the monolith.

3. **Chat history management is fragile.** `sidebarMessagesByDate` stores per-date chat history, `lastConflictMessageDate` prevents duplicate welcome messages, and `lastSuggestedActions` tracks pending actions. This ad-hoc state machine will break when adding project-specific or fleet-specific chat contexts.

4. **Cache-in-store anti-pattern.** `jobAnalysisResultCache` stores API responses in Zustand. This bypasses SWR's caching, deduplication, and revalidation. If two components need the same analysis, they might get different results.

### Recommended Changes

Split `useCommandCenterStore` into focused stores:

```typescript
// stores/dispatch/routes.ts
useRouteDisplayStore     // selectedTruckRoutes, showAllRoutes, highlightedJobId

// stores/dispatch/scenarios.ts
useScenarioStore         // activeScenario, scenarioResult, scenarioHistory

// stores/dispatch/sidebar.ts
useSidebarStore          // messages, messagesByDate, suggestedActions

// stores/dispatch/job-analysis.ts
useJobAnalysisStore      // analysis, feed, loading (move cache to SWR)

// stores/dispatch/cards.ts
useResourceCardStore     // selectedCards, previewJobId, modifiedFields
```

Move `jobAnalysisResultCache` to a custom SWR hook with proper cache keys.

**Priority: P1** — The monolith store makes feature development in Projects significantly harder because developers can't understand what state belongs to which feature.

---

## 3. Type System

### Current State

**File:** `src/types/index.ts` (520 lines)
**Pattern:** All enums, entities, AI types, API wrappers, and feature-specific types in one file.

### Problems

1. **Module boundaries don't exist in the type system.** Dispatch types (`ScenarioInput`, `TruckRoute`, `VoiceCommandAction`), intake types (`PreviewAssignment`, `BatchApproveItem`), and shared types (`Truck`, `Worker`, `CartingJob`) are all interleaved. Adding Projects, Fleet, and Crew types to this file means 1500+ lines.

2. **Display helpers mixed with types.** Label maps (`TRUCK_TYPE_LABELS`, `BOROUGH_LABELS`, etc.) are pure display concerns embedded alongside data contracts. These should live in a UI constants file or near the components that use them.

3. **Missing types for planned modules:**
   - **Fleet:** No `MaintenanceRecord`, `GpsReading`, `GeofenceAlert`, `FuelLog` types
   - **Crew:** No `Shift`, `Schedule`, `TimeOffRequest`, `CertificationExpiry`, `PayPeriod` types
   - **Planner:** No `CalendarEvent`, `ScheduleSlot`, `CrossModuleView` types
   - **Dashboard:** No `KPI`, `MetricSnapshot`, `DashboardWidget` types
   - **Settings:** No `UserRole`, `Permission`, `RoleAssignment`, `NotificationPreference` types
   - **Field App:** No `FieldUpdate`, `PhotoUpload`, `LocationPing`, `ClockAction` types

4. **Inconsistent optional vs. required fields.** `CartingJob.truck` is optional (`truck?: Truck`) because it depends on `include` in the Prisma query, but this isn't communicated to consumers. Some components assume `truck` exists without checking.

5. **No discriminated unions for status flows.** `IntakeStatus` is a string union, but the valid status transitions (`PENDING → APPROVED`, `PENDING → DECLINED`, etc.) aren't encoded anywhere. This leads to invalid state transitions being possible at the type level.

### Recommended Changes

Split types by module with a shared core:

```
types/
├── index.ts              # Re-exports everything
├── shared.ts             # Enums, Borough, Priority, ApiResponse
├── entities.ts           # Truck, Worker, CartingJob (Prisma mirrors)
├── dispatch.ts           # Scenario, Route, VoiceCommand, ResourceCard
├── intake.ts             # Preview, BatchApprove, Parse
├── projects.ts           # Project-specific types
├── fleet.ts              # Maintenance, GPS, Geofence
├── crew.ts               # Shifts, Scheduling, TimeOff
├── ai.ts                 # AI request/response types
└── display.ts            # Label maps, display helpers
```

**Priority: P1** — Adding Projects types to the current file will make it unmanageable.

---

## 4. API Routes

### Current State

**20 API routes** across dispatch, intake, jobs, trucks, workers, search, and confirm.

### Problems

#### 4a. Zero Authentication (CRITICAL)

No route checks for authentication or authorization. All endpoints are publicly accessible.

**Hardcoded user strings (5 instances):**
- `src/app/api/jobs/[id]/route.ts:101` — `userName: 'Dispatcher'`
- `src/app/api/intake/[id]/route.ts:25` — `reviewedBy: 'Dispatcher'`
- `src/app/api/intake/approve/route.ts:68` — `reviewedBy: 'Dispatcher'`
- `src/app/api/intake/batch-approve/route.ts:77` — `reviewedBy: 'Dispatcher'`
- `src/app/api/dispatch/apply-scenario/route.ts:110` — `userName: 'Dispatcher'`

This means:
- No audit trail of who made changes (all changes attributed to "Dispatcher")
- No role-based access control
- Any unauthenticated request can modify data
- No way to restrict drivers from approving intake items

**Priority: P0** — Must implement before production use and before adding role-specific modules (Crew Field App, Dashboard).

#### 4b. Inconsistent Error Handling

| Pattern | Routes using it | Problem |
|---------|----------------|---------|
| Smart status mapping (401/429/503) | `voice-command` only | Good pattern, used in 1 of 20 routes |
| Generic try/catch with 500 | `job-analyze`, `confirm` | Better than nothing |
| Silent `catch { }` blocks | `intake/approve`, `intake/batch-approve` | Swallows errors completely |
| No error handling at all | 11+ routes | Database errors crash the endpoint |

Specific silent failure examples:
- `src/app/api/intake/approve/route.ts:73` — `catch { }` on confirmation send
- `src/app/api/intake/batch-approve/route.ts:82` — `catch { }` on confirmation send

**Priority: P1** — Silent failures mean jobs get approved but confirmations silently fail, leaving customers unnotified with no error trail.

#### 4c. Heavy Code Duplication

**Pattern 1: Date parsing** — Identical 4-line date construction appears in 4+ routes:
- `src/app/api/dispatch/voice-command/route.ts`
- `src/app/api/dispatch/scenario-analyze/route.ts`
- `src/app/api/dispatch/job-analyze/route.ts`
- `src/app/api/dispatch/routes/route.ts`

```typescript
// This exact block is duplicated 4+ times
const dateStr = dateParam ?? (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
})();
const [y, m, d] = dateStr.split('-').map(Number);
const dateOnly = new Date(Date.UTC(y, m - 1, d));
```

**Pattern 2: Core job query** — Same Prisma `findMany` with identical `where`/`include`/`orderBy` in 5+ routes:
- `dispatch/routes`, `dispatch/voice-command`, `dispatch/scenario-analyze`, `dispatch/job-analyze`, `intake/preview-analyze`

**Pattern 3: Job creation from intake** — 50+ lines of identical job creation logic in:
- `src/app/api/intake/approve/route.ts`
- `src/app/api/intake/batch-approve/route.ts`

**Pattern 4: Worker/truck count enrichment** — Same map-reduce pattern in 3 routes:
- `dispatch/scenario-analyze`, `dispatch/job-analyze`, `intake/preview-analyze`

**Pattern 5: Changelog creation** — Same structure in 2 routes:
- `src/app/api/jobs/[id]/route.ts`
- `src/app/api/dispatch/apply-scenario/route.ts`

### Recommended Changes

Create `src/lib/server-utils.ts`:

```typescript
export function parseScheduleDate(dateParam?: string): Date { ... }
export function fetchActiveJobsForDate(date: Date) { ... }
export function calculateResourceCounts(jobs: CartingJob[]) { ... }
export function createChangeLogEntries(entries: ChangeLogInput[]) { ... }
export function createJobFromIntake(intake: IntakeItem, assignment: Assignment) { ... }
```

Create `src/app/api/shared/auth.ts`:

```typescript
export async function requireAuth(req: Request): Promise<Session> { ... }
export async function requireRole(req: Request, roles: Role[]): Promise<Session> { ... }
```

**Priority: P0 (auth), P1 (duplication, error handling)**

#### 4d. Missing Input Validation

Only 3 of 20 routes validate incoming data. Most routes directly destructure `req.json()` and pass values to Prisma without any validation.

- No Zod schemas despite Zod being a dependency
- No type narrowing on request bodies
- Invalid enum values (e.g., `borough: 'INVALID'`) would be silently written to the database

**Priority: P1** — Zod is already installed; schemas should be added to all mutation endpoints.

---

## 5. Hooks

### Current State

**File:** `src/hooks/index.ts` (~150 lines)
**Pattern:** 11 SWR hooks, one fetcher, uniform `{ data, loading, error, refetch }` return shape.

### Problems

1. **Single-file scaling.** 11 hooks in one file is manageable. 30+ hooks for 9 modules is not. There's no `useFleetVehicles`, `useCrewSchedule`, `usePlannerEvents`, etc.

2. **SWR configuration is hardcoded.** All hooks use the same 5-second dedup interval and disabled revalidation. Fleet GPS data needs 10-second polling. Crew clock-in needs real-time updates. Dashboard KPIs need 60-second refresh. There's no per-hook configuration.

3. **`useGlobalSearch` doesn't use SWR.** It manually manages `useState` + `useEffect` + `setTimeout` for debouncing, duplicating what SWR already provides. This is inconsistent with every other hook.

4. **No mutation hooks.** All hooks are read-only. Mutations (job updates, intake approvals, scenario applications) are done with raw `fetch` calls scattered across components. There should be `useUpdateJob`, `useApproveIntake`, etc.

5. **No optimistic updates.** When a dispatcher reassigns a truck, the UI waits for the full round-trip. SWR supports `optimisticData` but none of the hooks use it.

6. **`useRoutes` has a complex response unwrapping pattern.** The fetcher returns `{ routes, data, unassigned }` and the hook tries both `data.routes` and `data.data`. This suggests the API response shape changed but the hook wasn't updated cleanly.

### Recommended Changes

```
hooks/
├── shared.ts            # fetcher, SWR configs, useGlobalSearch (rewrite with SWR)
├── dispatch.ts          # useJobs, useJob, useRoutes, useConflicts, useScheduleConflicts
├── intake.ts            # useIntake, useIntakeItem
├── projects.ts          # useProjects, useProject, useProjectChat
├── fleet.ts             # useFleetVehicles, useVehicleLocation, useMaintenanceLog
├── crew.ts              # useCrewMembers, useSchedule, useClockEntries
├── mutations/
│   ├── dispatch.ts      # useUpdateJob, useApplyScenario
│   ├── intake.ts        # useApproveIntake, useBatchApprove, useParseIntake
│   └── crew.ts          # useClockIn, useClockOut
└── index.ts             # Re-exports
```

**Priority: P1** — Missing mutation hooks cause inconsistent data management across components.

---

## 6. Components

### Current State

**20 feature components** (13 dispatch, 7 intake) + **14 shadcn UI primitives**.

### Problems

#### 6a. God Components

Three components are critically oversized and violate single responsibility:

**1. `src/components/intake/intake-card.tsx` — 777 lines, 8+ responsibilities**
- Intake display + field editing + preview sandbox + AI analysis + approval workflow + schedule context + debounced API calls + multi-store coordination
- Contains its own `EfficiencyCircle` sub-component (duplicated in `preview-summary.tsx`)
- Makes API calls to 3 different endpoints directly
- Manages 10+ pieces of local state plus 3 store connections
- Field changes trigger immediate PATCH without form/save pattern

**2. `src/components/dispatch/war-room-panel.tsx` — 683 lines, 7+ responsibilities**
- Job analysis + conflict display + worker/truck browsing + preview mode + chat interface + state machine (4 panel states) + search
- Makes API calls to 3 different endpoints (`job-analyze`, `voice-command`, PATCH `jobs/[id]`)
- 15+ local state variables plus store connections
- Contains its own 4-state machine (`summary → options → preview → confirmed`)
- 2-second debounce timer for preview analysis

**3. `src/components/dispatch/job-dashboard.tsx` — 426 lines, 5+ responsibilities**
- Modal wrapper + form editor + change descriptor + API handler + 3-panel layout orchestration
- Contains `describePayloadChanges()` business logic helper (30 lines)
- 15+ state pieces tracked

#### 6b. Missing Shared Components

These UI patterns are duplicated across modules and should be extracted:

| Pattern | Where it's duplicated | Shared component needed |
|---------|----------------------|------------------------|
| `EfficiencyCircle` (conic gradient) | `intake-card.tsx`, `preview-summary.tsx` | `components/shared/efficiency-circle.tsx` |
| Status badge styling | `job-row.tsx`, `resource-cards.tsx`, `war-room-panel.tsx` | `components/shared/status-badge.tsx` |
| Date navigation (prev/next/today) | `dispatch-tab.tsx` (will be needed in Planner, Projects) | `components/shared/date-navigator.tsx` |
| Resource selector (truck/driver/worker) | `intake-card.tsx`, `war-room-panel.tsx` | `components/shared/resource-selector.tsx` |
| Expandable card pattern | `intake-card.tsx`, `route-overview-panel.tsx` | `components/shared/expandable-card.tsx` |

#### 6c. Components Make Direct API Calls

Multiple components contain `fetch()` calls directly:
- `war-room-panel.tsx` — 3 API calls
- `intake-card.tsx` — 3 API calls
- `ai-chat-sidebar.tsx` — 2 API calls
- `resource-cards.tsx` — 1 API call
- `scenario-panel.tsx` — 2 API calls
- `preview-summary.tsx` — 1 API call

These should be extracted to mutation hooks for consistency, error handling, and cache invalidation.

### Recommended Splits

**intake-card.tsx (777 → 6 files):**
1. `IntakeCardHeader` — Expandable header with status/source
2. `IntakeFieldEditor` — ParsedFields display/edit
3. `PreviewSandbox` — Truck/driver/time selection
4. `AIAnalysisPanel` — Analysis display
5. `IntakeActions` — Approval buttons + workflows
6. `IntakeCard` — Orchestrator shell

**war-room-panel.tsx (683 → 5 files):**
1. `JobAnalysisSummary` — Impact + conflicts display
2. `ResourceBrowser` — Worker/truck search + selection
3. `PreviewImpactPanel` — Before/after comparison
4. `WarRoomChat` — Chat input + messages
5. `WarRoomPanel` — State machine orchestrator

**job-dashboard.tsx (426 → 3 files):**
1. `JobEditForm` — Form fields only
2. `JobDashboardLayout` — 3-panel arrangement
3. `JobDashboardModal` — Modal wrapper

**Priority: P1** — God components make feature development slow and error-prone. The war-room and intake-card especially will be templates for similar patterns in Projects and Fleet.

---

## 7. AI Layer

### Current State

**File:** `src/lib/ai/claude.ts` (799 lines)
**Model:** `claude-sonnet-4-5-20250929`
**Functions:** 9 AI functions handling dispatch and intake concerns.

| Function | Purpose | Token usage |
|----------|---------|-------------|
| `parseIntakeContent` | Parse raw phone/email/form → structured fields | Medium |
| `getWorkerRecommendations` | Rank workers for a job | Medium |
| `parseVoiceIntent` | Voice → executable dispatch actions | High (full schedule context) |
| `projectBrainChat` | Per-project AI assistant | High (full project context) |
| `dispatchAiChat` | General dispatch chat | High (full schedule context) |
| `analyzePreviewAssignment` | Evaluate proposed assignments | Medium |
| `analyzeScenario` | "What if" scenario analysis | High (full schedule context) |
| `getQuickRecommendation` | Quick 0-100 assignment score | Low |
| `analyzeJob` | Full war-room job analysis | High |

### Problems

1. **Single 799-line file.** All 9 functions, each with their own system prompt (50-100 lines each), are in one file. Adding Fleet AI (maintenance predictions, route optimization) and Crew AI (scheduling optimization, certification tracking) will push this past 2000 lines.

2. **Dispatch-only system prompts.** Every prompt says "You are a dispatch assistant for EDCC Services Corp, a NYC demolition and carting company." Fleet needs "You are a fleet maintenance advisor." Crew needs "You are a workforce scheduler." Projects needs "You are a project manager." There's no prompt composition pattern.

3. **Context building is repeated.** 5 of 9 functions build nearly identical schedule context strings (job list, truck list, worker list with counts). This is ~50 lines of string formatting duplicated across functions.

4. **No token budget management.** Every function sends the full schedule context regardless of how many jobs exist. With 62 jobs and 16 workers, this is manageable (~2000 tokens). At 200+ jobs (across Projects), context will balloon. There's no summarization, windowing, or relevance filtering.

5. **No streaming.** All AI responses wait for the full completion. For chat interactions (`dispatchAiChat`, `projectBrainChat`), streaming would significantly improve perceived latency.

6. **Prompt caching is partially implemented.** `cache_control: { type: 'ephemeral' }` is used on system prompts, which is correct. But user messages that repeat schedule context don't leverage caching.

### Recommended Changes

Split by domain with shared context builders:

```
ai/
├── client.ts              # Anthropic singleton, token logger, error handler
├── shared-prompts.ts      # buildScheduleContext(), buildResourceContext()
├── dispatch.ts            # parseVoiceIntent, dispatchAiChat, analyzeScenario, analyzeJob
├── intake.ts              # parseIntakeContent, analyzePreviewAssignment
├── projects.ts            # projectBrainChat + future project AI
├── fleet.ts               # (future) maintenance predictions, route optimization
├── crew.ts                # (future) scheduling optimization, cert tracking
└── recommendations.ts     # getWorkerRecommendations, getQuickRecommendation
```

Add context windowing:

```typescript
function buildScheduleContext(jobs: CartingJob[], options: {
  maxJobs?: number;        // Limit context size
  relevantTruckIds?: string[];  // Filter to relevant trucks
  timeWindow?: { start: string; end: string };  // Only nearby timeslots
}) { ... }
```

**Priority: P1** — The AI layer is the core differentiator. It needs to scale gracefully as module count grows.

---

## 8. Database

### Current State

**File:** `prisma/schema.prisma` (494 lines)
**Models:** 17 (Truck, Worker, ClockEntry, CartingJob, JobWorker, JobHistory, IntakeItem, DemoProject, ProjectWorker, ProjectTruck, ProjectChat, Confirmation, Route, RouteStop, DumpSite, ChangeLog, IntegrationConfig)

### Problems

#### 8a. Missing Indexes

The schema has **zero explicit indexes** beyond auto-generated `@id` primary keys. Prisma auto-creates indexes for `@relation` foreign keys, but these critical query patterns lack indexes:

| Query pattern | Used by | Missing index |
|---------------|---------|---------------|
| Jobs by date + status | 5+ API routes | `@@index([date, status])` on `CartingJob` |
| Jobs by truck + date | Conflict engine | `@@index([truckId, date])` on `CartingJob` |
| Jobs by driver + date | Conflict engine | `@@index([driverId, date])` on `CartingJob` |
| Workers by status | Conflict engine, recommendations | `@@index([status])` on `Worker` |
| Intake by status | Intake list | `@@index([status])` on `IntakeItem` |
| Changelog by entity | Audit log | `@@index([entityType, entityId])` on `ChangeLog` |
| Routes by truck + date | Route display | `@@index([truckId, date])` on `Route` |
| RouteStop by route + sequence | Route rendering | `@@index([routeId, sequence])` on `RouteStop` |

With 62 jobs this doesn't matter. At 1000+ jobs per month (realistic for a carting company), these missing indexes will cause noticeable latency.

**Priority: P1**

#### 8b. Missing Models for Planned Modules

**Fleet module:**
- `MaintenanceRecord` — scheduled/completed maintenance per truck
- `GpsReading` — time-series GPS data from IntelliShift (or reference IntelliShift directly)
- `GeofenceAlert` — entry/exit alerts for dump sites, job sites
- `FuelLog` — fuel consumption tracking
- `Inspection` — DOT inspection records

**Crew module:**
- `Shift` — defined shift templates (6am-2pm, etc.)
- `Schedule` — weekly schedule assignments per worker
- `TimeOffRequest` — PTO/sick day requests
- `CertificationRecord` — cert issue/expiry dates (currently just a `String[]`)
- `PayPeriod` — hours worked summary

**Planner module:**
- No new models needed — Planner is a cross-module view

**Dashboard module:**
- `MetricSnapshot` — periodic KPI snapshots for trending

**Settings module:**
- `User` — real user accounts (currently only NextAuth sessions)
- `Role` — permission roles
- `UserRole` — role assignments

**Priority: P0 for User/Role (blocks auth), P1 for Fleet/Crew models (blocks those modules)**

#### 8c. Schema Design Issues

1. **`Worker.certifications` is `String[]`.** This should be a related `Certification` model with `name`, `issuedDate`, `expiryDate`, `issuingBody`, and `documentUrl`. A flat string array can't track expiration (safety risk for a demolition company).

2. **`IntakeItem.parsedServiceType` is `String`.** Should be typed as the `JobType` enum for consistency, but Prisma stores it as a raw string since it comes from AI parsing and might not be a valid enum value.

3. **`CartingJob.time` is `String` ("HH:MM").** This prevents time-range queries. A `DateTime` for `startTime` and optionally `endTime` would enable proper overlap detection (see Conflict Engine bug).

4. **`DemoProject` naming.** "Demo" refers to "demolition" but reads as "demonstration" to every developer. Consider renaming to `Project` or `DemolitionProject`.

5. **No soft deletes.** All deletes are hard deletes. For a company operating system, jobs and workers should never truly disappear (legal/audit requirements).

#### 8d. N+1 Query Patterns

The conflict engine's `detectConflicts()` function has N+1 issues:

```typescript
// src/lib/conflicts.ts:31 — Inside a loop over truckConflicts
for (const conflict of truckConflicts) {
  const truck = await db.truck.findUnique({ where: { id: truckId } });  // N+1!
  // This queries the same truck for every conflict
}
```

The same truck is fetched inside a loop for every conflict it appears in. This should be a single query before the loop.

The batched `detectAllConflictsForDate()` function correctly avoids this pattern with in-memory grouping, but `detectConflicts()` (used for individual job checks) still has it.

**Priority: P1 for N+1, P0 for time field (blocks conflict engine fix)**

---

## 9. Conflict Engine (Critical Bug)

### Current State

**File:** `src/lib/conflicts.ts`
**Two entry points:**
- `detectConflicts()` — Single-job conflict check
- `detectAllConflictsForDate()` — Schedule-wide batch check

### The Bug: 151 Conflicts Instead of 3

**Root cause:** The engine treats every pair of jobs on the same truck on the same date as a conflict. It uses `O(n²)` pair comparison within each truck group:

```typescript
// src/lib/conflicts.ts:207-224
for (let i = 0; i < group.length; i++) {
  for (let j = i + 1; j < group.length; j++) {
    const a = group[i];
    const b = group[j];
    const severity = a.time === b.time ? 'CRITICAL' : 'WARNING';
    // Creates TWO conflicts per pair (one for each direction)
    dedupe({ type: 'TRUCK_DOUBLE_BOOK', ... affectedJobId: b.id });
    dedupe({ type: 'TRUCK_DOUBLE_BOOK', ... affectedJobId: a.id });
  }
}
```

**The math:** The seed data has 6 trucks with 10 jobs each. For each truck with 10 jobs:
- Pairs = C(10,2) = 45 pairs
- Each pair generates 2 conflict records (one per direction) = 90 conflicts per truck
- 6 trucks × 90 = 540 potential conflicts, minus deduplication
- Dedupe key is `type:jobId:truckId:workerId`, so each direction survives = ~150+ conflicts

**Why this is wrong:** In carting, multiple jobs on the same truck on the same date is a **route**, not a conflict. Truck T-01 doing a 7:00 AM pickup in Manhattan and a 9:00 AM pickup in Brooklyn is the entire point of the dispatch system.

**A real conflict is:** Truck T-01 scheduled for a 9:00 AM pickup at Address A **and** a 9:00 AM pickup at Address B — the truck physically cannot be in two places at once during overlapping time windows.

### What the Engine Should Check

1. **Time overlap detection.** Two jobs on the same truck conflict only if their time windows overlap. This requires either:
   - A job duration estimate (based on job type, container size, and borough)
   - Explicit `startTime` + `endTime` fields
   - A reasonable default duration (e.g., 45-60 minutes for a carting job)

2. **Route feasibility.** Even non-overlapping times can conflict if travel time between locations makes the sequence impossible. A 9:00 AM job in the Bronx and a 9:30 AM job in Staten Island is a conflict even though the times don't overlap.

3. **The current severity logic is also wrong.** `severity = a.time === b.time ? 'CRITICAL' : 'WARNING'` marks exact-same-time as CRITICAL (correct) but different-time-same-day as WARNING (wrong — should not be flagged at all unless times actually overlap).

### Recommended Fix

```typescript
// Pseudocode for correct truck double-book detection
const JOB_DURATION_MINUTES = 45; // Default, could vary by type

function timesOverlap(timeA: string, timeB: string, durationMinutes: number): boolean {
  const startA = parseMinutes(timeA);
  const endA = startA + durationMinutes;
  const startB = parseMinutes(timeB);
  const endB = startB + durationMinutes;
  return startA < endB && startB < endA;
}

// In the truck double-book loop:
for (let i = 0; i < group.length; i++) {
  for (let j = i + 1; j < group.length; j++) {
    if (!timesOverlap(group[i].time, group[j].time, JOB_DURATION_MINUTES)) {
      continue; // Same truck, different time slots = normal route, not a conflict
    }
    // Only flag actual overlaps
  }
}
```

The same fix is needed for driver double-book detection.

For `detectConflicts()` (single-job check), the fix is similar: query only jobs where times would overlap, not all jobs on the same date.

**Priority: P0** — This is a data-correctness bug. The AI sidebar currently opens with "151 conflicts detected" which is unusable noise. It must be fixed before any other work on the dispatch module.

---

## 10. Scalability Concerns

### What Breaks First When Adding Projects

1. **The conflict engine floods the UI.** 151 false conflicts already make the conflict banner and AI sidebar unusable. Adding project-linked jobs will increase this further. **(P0 — fix first)**

2. **`page.tsx` is a single entry point.** Adding a full Projects tab with its own sub-navigation, project detail pages, and project-specific views to a single-page shell doesn't scale. You need route-based code splitting. **(P1)**

3. **Types file becomes unmanageable.** Adding `ProjectTask`, `ProjectMilestone`, `ProjectBudget`, `ProjectTimeline`, `ProjectDocument` types to the existing 520-line file creates immediate navigation problems. **(P1)**

4. **The AI layer has no project-specific prompts.** `projectBrainChat` exists but is a single function. A proper Projects module needs AI for milestone prediction, resource allocation, budget estimation, and risk assessment. **(P1)**

5. **No auth means no project-level permissions.** A foreman should see their project's details. A driver shouldn't see project budgets. Without auth, there's no way to enforce this. **(P0)**

### Refactoring Priority Order

| Priority | Item | Reason |
|----------|------|--------|
| **P0-1** | Fix conflict engine | Produces incorrect data, unusable UI |
| **P0-2** | Add auth middleware + User/Role models | Blocks role-based features |
| **P0-3** | Add database indexes | Performance will degrade with real data volume |
| **P1-1** | Split types by module | Blocks clean Projects development |
| **P1-2** | Split stores by concern | CommandCenterStore monolith blocks feature dev |
| **P1-3** | Extract shared API utilities | Duplication will multiply with Projects routes |
| **P1-4** | Split god components | war-room and intake-card are maintenance hazards |
| **P1-5** | Split hooks by module + add mutations | Inconsistent data management |
| **P1-6** | Split AI layer by module | Blocks Projects/Fleet AI |
| **P1-7** | Add error handling + validation | Silent failures create data integrity risks |
| **P1-8** | Route-based code splitting (page.tsx) | Performance at 9 modules |
| **P2-1** | Add missing DB models (Fleet/Crew) | Blocks those modules |
| **P2-2** | Add streaming to AI chat | UX improvement |
| **P2-3** | Convert `certifications` to related model | Safety/compliance risk |
| **P2-4** | Add soft deletes | Audit/legal requirement |
| **P2-5** | Add SWR optimistic updates | UX improvement |

### Biggest Risks for the 9-Module Vision

1. **No authentication foundation.** Every module needs role-based access. Building 7 more modules on top of zero auth means retrofitting all routes later — exponentially harder.

2. **Monolithic state.** The CommandCenterStore pattern will be copy-pasted for each module, creating 9 monolith stores. Without splitting now, the pattern propagates.

3. **AI prompt sprawl.** With 9 modules each having 3-5 AI functions, the AI layer will be 5000+ lines in a single file. Without the split-and-compose pattern, prompts will diverge and become unmaintainable.

4. **Component architecture debt.** The god components (intake-card, war-room) will be used as templates for Projects and Fleet equivalents. If they're not split first, the same over-coupling pattern will propagate.

---

## 11. Priority-Ranked Findings

### P0 — Fix Before Building Projects

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| 1 | **Conflict engine bug**: flags routes as conflicts (151 false positives) | `src/lib/conflicts.ts:196-244` | Unusable conflict detection, wrong data in AI context |
| 2 | **Zero authentication**: all 20 routes publicly accessible | All `src/app/api/*/route.ts` | No audit trail, no access control, security risk |
| 3 | **No User/Role models**: can't implement auth without them | `prisma/schema.prisma` | Blocks auth implementation |
| 4 | **Missing database indexes**: no indexes on any query pattern | `prisma/schema.prisma` | Performance degradation with real data |
| 5 | **Hardcoded "Dispatcher" in 5 routes**: fake audit trail | 5 API routes (see §4a) | Misleading changelog data |

### P1 — Fix Soon (During or Right After Projects)

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| 6 | Types monolith (520 lines, one file) | `src/types/index.ts` | Developer friction, merge conflicts |
| 7 | Store monolith (CommandCenterStore: 30+ fields) | `src/stores/index.ts` | Feature isolation impossible |
| 8 | API code duplication (5 patterns × 2-5 routes each) | Multiple API routes | Bug propagation, maintenance cost |
| 9 | God components (intake-card: 777L, war-room: 683L) | `src/components/intake/intake-card.tsx`, `src/components/dispatch/war-room-panel.tsx` | Slow feature development, fragile code |
| 10 | Hooks monolith + no mutation hooks | `src/hooks/index.ts` | Inconsistent data management |
| 11 | AI monolith (799 lines, one file) | `src/lib/ai/claude.ts` | Blocks multi-module AI |
| 12 | Silent error swallowing in approval routes | `src/app/api/intake/approve/route.ts:73`, `batch-approve/route.ts:82` | Lost confirmations with no error trail |
| 13 | No input validation despite Zod dependency | Multiple API routes | Data integrity risk |
| 14 | Single-page shell (all tabs in page.tsx) | `src/app/page.tsx` | No code splitting, full app loads always |
| 15 | N+1 queries in detectConflicts() | `src/lib/conflicts.ts:31` | Performance with many conflicts |
| 16 | `CartingJob.time` is String not DateTime | `prisma/schema.prisma` | Prevents proper time-range queries |
| 17 | No shared component library | `src/components/` | Duplicated UI patterns across modules |
| 18 | Cache-in-store anti-pattern | `src/stores/index.ts` (jobAnalysisResultCache) | Inconsistent caching, stale data |

### P2 — Fix Eventually

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| 19 | Missing DB models for Fleet/Crew | `prisma/schema.prisma` | Blocks those modules |
| 20 | `certifications` is `String[]` not related model | `prisma/schema.prisma` | Can't track cert expiration |
| 21 | No AI streaming for chat | `src/lib/ai/claude.ts` | Poor chat UX latency |
| 22 | No soft deletes | `prisma/schema.prisma` | Legal/audit risk |
| 23 | No optimistic updates in SWR hooks | `src/hooks/index.ts` | Slow perceived performance |
| 24 | `DemoProject` naming confusion | `prisma/schema.prisma` | Developer confusion |
| 25 | No token budget management in AI | `src/lib/ai/claude.ts` | Token costs scale linearly |

---

## 12. Refactoring Plan

### Phase 0: Critical Fixes (Before Projects Development)

**Goal:** Fix data-correctness bugs and establish auth foundation.

1. **Fix conflict engine** (`src/lib/conflicts.ts`)
   - Add `timesOverlap()` utility function with configurable job duration
   - Update `detectAllConflictsForDate()` to only flag actual time overlaps
   - Update `detectConflicts()` with same logic
   - Fix the N+1 query in `detectConflicts()` (move truck lookup before loop)
   - Add duration estimation by job type (PICKUP: 30min, DROP_OFF: 45min, DUMP_OUT: 60min)

2. **Add auth foundation**
   - Add `User` and `Role` models to Prisma schema
   - Implement NextAuth session with role claims
   - Create `requireAuth()` and `requireRole()` middleware helpers
   - Apply to all 20 existing routes
   - Replace hardcoded `'Dispatcher'` with session user

3. **Add database indexes**
   - Add composite indexes for all query patterns listed in §8a
   - Run migration

4. **Fix `CartingJob.time` to support overlap detection**
   - Either: Add `estimatedDuration` field (Integer, minutes)
   - Or: Add `endTime` field alongside `time`
   - Update conflict engine to use the new field

### Phase 1: Structural Refactoring (During Projects Development)

**Goal:** Establish patterns that scale to 9 modules.

5. **Split types by module**
   - Create `types/shared.ts`, `types/dispatch.ts`, `types/intake.ts`, `types/projects.ts`
   - Keep `types/index.ts` as re-export barrel
   - Move display helpers to `types/display.ts`

6. **Split stores by concern**
   - Break `useCommandCenterStore` into 5 focused stores
   - Move `jobAnalysisResultCache` to SWR
   - Create store template pattern for new modules

7. **Extract shared API utilities**
   - Create `src/lib/server-utils.ts` with `parseScheduleDate()`, `fetchActiveJobsForDate()`, etc.
   - Create `src/lib/changelog.ts` for changelog helpers
   - Create `src/lib/intake-utils.ts` for shared intake→job creation
   - Add Zod validation schemas for all mutation endpoints

8. **Add error handling**
   - Create `src/lib/api-error.ts` with standardized error response helper
   - Fix silent `catch { }` blocks in approval routes
   - Add try/catch with proper logging to all routes

9. **Split hooks by module + add mutations**
   - Create `hooks/dispatch.ts`, `hooks/intake.ts`, `hooks/projects.ts`
   - Add mutation hooks (`useUpdateJob`, `useApproveIntake`, etc.)
   - Rewrite `useGlobalSearch` to use SWR

### Phase 2: Component Architecture (After Projects MVP)

**Goal:** Make components reusable and maintainable.

10. **Split god components**
    - `intake-card.tsx` → 6 focused components
    - `war-room-panel.tsx` → 5 focused components
    - `job-dashboard.tsx` → 3 focused components

11. **Create shared component library**
    - Extract `EfficiencyCircle`, `StatusBadge`, `DateNavigator`, `ResourceSelector`
    - Create `components/shared/` directory

12. **Route-based code splitting**
    - Move from single `page.tsx` shell to Next.js route groups
    - Each module gets its own `(module)/page.tsx` with layout

### Phase 3: AI & Data Layer (Before Fleet/Crew)

**Goal:** Scale AI and data to multi-module operation.

13. **Split AI layer by module**
    - Create shared prompt builder with context windowing
    - Split into `ai/dispatch.ts`, `ai/intake.ts`, `ai/projects.ts`
    - Add streaming support for chat functions

14. **Add missing database models**
    - Fleet: `MaintenanceRecord`, `Inspection`, `FuelLog`
    - Crew: `Shift`, `Schedule`, `TimeOffRequest`, `CertificationRecord`
    - Settings: `Permission`, `NotificationPreference`

15. **Convert certifications to related model**
    - Create `CertificationRecord` model with expiry tracking
    - Migrate existing `String[]` data
    - Add expiry alerting

---

*End of audit. No changes were made to any files.*
