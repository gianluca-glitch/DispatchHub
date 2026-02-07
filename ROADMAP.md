# DispatchHub — Roadmap & Master List

**Last updated:** Feb 6, 2026
**Branch:** `feature/command-center`
**Last commit:** `dd3b0d6`
**Developer:** Gianluca (Elite)
**Status:** MVP — validating with real users

---

## Where We Are

DispatchHub started as a dispatch tool for EDCC's carting operation. It's becoming the company's operating system — dispatch, projects, fleet, crew, all connected through one database with AI powering every module.

**What shipped this week:**
- V7a: AI chat date-routing fix (responses land on correct date, parallel chat per date)
- V7b: Seed data overhaul (62 realistic jobs, 6 routes, 10 dump sites, removed SWAP/HAUL)
- Conflict engine fix (151 false positives → ~5 real conflicts with time-overlap detection)
- Architecture audit (25 findings across 10 areas, documented in docs/architecture-audit.md)
- CLAUDE.md project rules for Claude Code

**What works today:**
- Dispatch tab: 3-panel layout (job grid + route overview + AI chat)
- AI chat: creates jobs, assigns trucks/drivers, marks complete, resolves conflicts
- Intake tab: parses phone/email/form into structured job data
- Conflict engine: time-window overlap detection with duration estimates
- Seed data: 62 jobs across 6 truck routes, realistic NYC addresses
- Route overview: per-truck stop sequences with borough flow
- Date navigation with per-date chat history

---

## Phases

### Phase 0: Foundation ✅ COMPLETE
- [x] Next.js 14 + Prisma + PostgreSQL (Neon) setup
- [x] Database schema: trucks, workers, jobs, projects, intake, routes
- [x] Dispatch tab: job grid, route overview, AI chat sidebar
- [x] AI integration: Claude API for natural language dispatch
- [x] Intake pipeline: parse phone/email → structured job fields
- [x] Seed data: 62 realistic jobs across 6 truck routes
- [x] Conflict engine: time-overlap detection (fixed from 151 → ~5 real)
- [x] Dark industrial theme, CLAUDE.md, architecture audit

### Phase 1: Fabio Ships 🔨 IN PROGRESS
*Goal: Fabio uses Projects from his phone this weekend.*
- [ ] Projects tab — war room layout with AI chat sidebar (mobile-first)
- [ ] AI chat: create projects, assign workers/trucks, update phases
- [ ] Project data flows into dispatch when carting phase begins
- [ ] Basic auth gate (env var password) for deploy
- [ ] Netlify deploy
- [ ] SWR refresh fix (UI updates after AI applies changes)

### Phase 2: Feedback Loop
*Goal: Fabio uses it, breaks it, you fix it.*
- [ ] Fix whatever Fabio breaks
- [ ] Tune AI prompts based on real dispatcher language
- [ ] Mobile UI fixes based on actual phone usage
- [ ] API cost optimization

### Phase 3: Dispatch Polish
*Goal: Production-ready dispatch tab.*
- [ ] Schedule Health Check (tappable notification cards in greeting)
- [ ] SWR mutation hooks (no manual refresh)
- [ ] Zod input validation on all API routes
- [ ] Error handling cleanup (remove silent catch blocks)
- [ ] Split god components (intake-card 777L, war-room 683L)
- [ ] AI-ranked recommendations replace raw dropdowns (old F3)
- [ ] Routes map panel redesign (old F2)

### Phase 4: Fleet + IntelliShift
*Goal: Live truck tracking, real GPS data.*
- [ ] IntelliShift API integration
- [ ] Live GPS truck positions on map
- [ ] Auto-complete jobs on driver arrival
- [ ] Conflict engine v2: real duration data from GPS
- [ ] Route recalculation on delays
- [ ] Fleet tab: truck grid with status, maintenance

### Phase 5: Crew + Field App
*Goal: Workers have their own mobile interface.*
- [ ] Crew tab: profiles, certs, availability
- [ ] Field app: clock in/out, job updates, photos
- [ ] Certification tracking with expiry alerts
- [ ] Schedule builder

### Phase 6: Full Platform
*Goal: All modules, real auth, company OS.*
- [ ] Full auth with roles (boss, dispatcher, driver, office)
- [ ] Planner: calendar across dispatch + projects
- [ ] Company Dashboard: KPIs, revenue, utilization
- [ ] Settings: integrations, notifications
- [ ] Architecture refactor: split types, stores, hooks, AI by module

### Phase 7: Central Brain
*Goal: All data feeds one AI.*
- [ ] Phone call transcription → auto-update jobs
- [ ] Email parsing → automated intake
- [ ] GPS + field app + dispatch + projects = unified data
- [ ] Cross-module AI insights

---

## Bugs

### Open

| # | Bug | Where | Severity | Notes |
|---|-----|-------|----------|-------|
| B1 | "1 stops" grammar | route-overview-panel.tsx | Low | Should be "1 stop" singular |
| B2 | Conflict message wall of text | ai-chat-sidebar.tsx | Medium | AI dumps every conflict as prose. Needs categorized summary |
| B3 | Job assignment incomplete | job-dashboard.tsx / war-room-panel.tsx | Medium | Assigning driver doesn't prompt for truck |
| B4 | Driver-without-truck state | job-dashboard.tsx | Medium | No warning when job has driver but no truck |
| B7 | Double map from route panel | route-overview-panel → job-dashboard | Medium | Opening job from route mini map renders two Leaflet instances |
| B8 | Dropdown menus no backdrop | job-dashboard.tsx | Low | Dropdowns overlap notes/save. Z-index missing |
| B9 | Intake tab UX overhaul needed | intake-tab.tsx / intake-card.tsx | High | AI text walls, too many buttons, no clear flow |
| B10 | API cost — $0.44 in 30 mins | lib/ai/claude.ts | 🔴 Critical | 901K input / 136K output in 2 days |
| B11 | "Failed to parse intent" | ai-chat-sidebar → voice-command | High | Natural commands fail, parser too rigid |
| B12 | No graceful API error handling | ai-chat-sidebar.tsx | High | API failures show raw error |
| B13 | Token burn — 0% cache hit | lib/ai/claude.ts | 🔴 Critical | Full prompts resent every call, 40K tok/min spikes |
| B14 | No UI refresh after AI changes | ai-chat-sidebar.tsx, hooks/index.ts | Medium | Must manually reload to see AI-applied changes |
| B15 | Greeting doesn't fire on empty dates | api/jobs/conflicts/route.ts | Medium | API 500 on dates with no jobs |
| B16 | Greeting repeats on rapid date switch | ai-chat-sidebar.tsx | Low | Date-switch dedup not fully working |
| B17 | AI assigned Packer 24 (doesn't exist) | lib/ai/claude.ts | Medium | AI hallucinated a truck not in fleet |
| B18 | OneDrive corrupts .next cache | .next/ | Low | Workaround: Remove-Item -Recurse -Force .next |
| B19 | Port collision orphan node processes | System | Low | Workaround: taskkill /F /IM node.exe |

### Fixed ✅

| # | Bug | Fix |
|---|-----|-----|
| B5 | AI says "All clear" when conflicts exist | V7a — greeting waits for conflict data before firing |
| B6 | Double "All clear" messages | V7a — greetingPosted ref + per-date dedup |
| — | 151 false conflict positives | Conflict engine rewrite — time-overlap detection |
| — | AI responses land on wrong date's chat | V7a — selectedDateRef + addMessageForDate helper |
| — | SWAP/HAUL job types in system | V7b — removed from schema, AI, UI, seed |

---

## Feature Backlog

### High Priority (Phase 1-2)

| # | Feature | Module | Notes |
|---|---------|--------|-------|
| F12 | Conflict summary in sidebar | Dispatch | Categorized count, not sentence dump |
| F-NEW | Schedule Health Check cards | Dispatch | Tappable cards: missing times, unassigned, sick workers |
| F-NEW | Project → Dispatch handoff | Projects | Carting phase auto-creates dispatch jobs |

### Medium Priority (Phase 3)

| # | Feature | Module | Notes |
|---|---------|--------|-------|
| F2 | Routes map panel redesign | Dispatch | Upper = all-routes map, lower = route cards |
| F3 | AI-ranked recs replace dropdowns | Dispatch | Top 3 scored recs + search bar |
| F4 | Container count field | Dispatch | Orders can need 20 mini containers |
| F5 | Job rows show route color | Dispatch | 4px left border matching route color |
| F6 | Unassigned jobs blink red | Dispatch | Pulsing red for no-truck jobs |
| F7 | Stats bar clickable filters | Dispatch | Toggle buttons filter the grid |
| F8 | focusStopIndex | Dispatch | Click timeline → map flies to pin |
| F9 | onStopClick | Dispatch | Click marker → timeline highlights |
| F10 | Route preview on truck swap | Dispatch | Preview shows projected route on map |
| F11 | AI reads intake | Dispatch | "What fits today's routes?" → AI loads + schedules |
| F-NEW | AI cost dashboard | Settings | Token usage per feature |
| F-NEW | Batch job creation from templates | Dispatch | "Create Tony's usual Bronx route" |

### Low Priority (Phase 4+)

| # | Feature | Module | Notes |
|---|---------|--------|-------|
| D1 | Bell icon checkpoint / undo | Dispatch | |
| D2 | Global search (⌘K) | All | |
| D8 | Voice recording → AI chat | All | Mic button exists, not wired |
| D9 | AI auto-confirmation (call + email + SMS) | Dispatch | |
| D10 | Low-confidence intake flagging | Intake | |
| F-NEW | Photo upload from field | Crew App | Before/after demo site photos |
| F-NEW | Client portal | Projects | Project status for customers |
| F-NEW | Dark/light theme toggle | Settings | Dark-only for now |

---

## Build Notes

- PowerShell: semicolons (`;`) not `&&`
- OneDrive: `Remove-Item -Recurse -Force .next` before builds if EINVAL/EPERM
- react-leaflet v4.2.1 only (v5 needs React 19)
- fetch calls: `fetch(` not tagged template literals
- Seed: `npx prisma db seed`
- Leaflet: `L.divIcon`, NOT default icons
- pnpm only (NEVER npm)
- Port stuck: `taskkill /F /IM node.exe` then `pnpm dev`

---

## Architecture Notes

See `docs/architecture-audit.md` for full audit (Feb 6, 2026).

**Key decisions:**
- Single-page app for MVP → route-based splitting in Phase 6
- All types/stores/hooks in single files → split when adding 3rd module
- No auth for MVP → password gate Phase 1, full auth Phase 6
- Conflict engine static durations → GPS data replaces in Phase 4
- Mobile-first for Projects (Fabio's phone), desktop-first for Dispatch (office)

**Tech debt tracked:**
- God components: intake-card.tsx (777L), war-room-panel.tsx (683L)
- Store monolith: useCommandCenterStore (30+ fields)
- API duplication: 5 patterns repeated across routes
- Silent error swallowing in approval routes
- No Zod validation despite being installed
