# DispatchHub — Cursor Starter Kit

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres + Redis
docker compose up -d

# 3. Copy env file and fill in your keys
cp .env.example .env.local

# 4. Generate Prisma client + push schema
pnpm db:generate
pnpm db:push

# 5. Seed the database (18 trucks, 16 workers, jobs, projects)
pnpm db:seed

# 6. Install shadcn/ui components you need
npx shadcn@latest add button dialog dropdown-menu input select tabs tooltip badge separator scroll-area sheet popover command switch

# 7. Run dev server
pnpm dev
```

Open http://localhost:3000 — you should see the header with all 7 tabs.

---

## Build Phases — Cursor Prompts

Feed each prompt to Cursor one at a time. Keep these files open as context for every prompt:
- `prisma/schema.prisma`
- `src/types/index.ts`
- `.cursorrules`

---

### PHASE 1: Skeleton ✅ (Already Done)

The starter kit IS Phase 1. You have:
- Next.js + TypeScript + Tailwind + shadcn
- Prisma schema with all entities
- Seed data (18 trucks, 16 workers, 3 projects, 8 jobs, 3 intake items)
- Root layout with dark theme, header, tab nav, mic button, search shortcut
- Zustand stores, hooks, types
- AI wrapper, conflict engine, integration stubs
- Docker Compose for Postgres + Redis

---

### PHASE 2: Core CRUD + Dispatch View

Paste this into Cursor:

```
Build the Dispatch tab — the daily command center. Reference prisma/schema.prisma for all models and src/types/index.ts for TypeScript types.

API routes needed:
1. GET /api/jobs?date=YYYY-MM-DD — returns all CartingJobs for that date with truck, driver, project relations included
2. GET /api/jobs/[id] — single job with all relations
3. PATCH /api/jobs/[id] — update any job field, log change to ChangeLog table
4. GET /api/jobs/conflicts?jobId=X&date=Y — runs conflict detection (use src/lib/conflicts.ts)
5. GET /api/workers — all workers
6. GET /api/trucks — all trucks
7. GET /api/search?q=X — search across jobs (customer, address), workers (name), trucks (name, VIN), projects (name)

Components to build in src/components/dispatch/:
1. JobRow — table row: time (font-mono), customer, address, type pill (color-coded), truck name, driver name, status pill (dot + label), priority badge. Click opens JobDashboard.
2. JobDashboard — modal (shadcn Dialog). Shows all job fields with inline editing (click field to edit). Top section: conflict banners (amber = warning, red = critical). Below conflicts: 3 AI fix options (one-click apply). Below job info: 3 worker recommendations with "Assign" button. Every edit fires PATCH + conflict recheck + ChangeLog entry.
3. ConflictBanner — amber/red banner with icon, message, severity. Shows at top of JobDashboard when conflicts exist.

The Dispatch tab layout:
- Left 70%: Date picker at top (prev/next day arrows + date display), stats bar (total jobs, completed, in-progress, delayed), then job table sorted by time
- Right 30%: AI sidebar placeholder (we'll build this in Phase 4)

Use shadcn/ui Dialog, Badge, Button, Input, Select. Follow the dark theme in tailwind.config.ts. Font-mono for times and data. Status colors: green=available/completed, blue=scheduled, amber=on-site/in-progress, red=urgent/sick.
```

---

### PHASE 3: Intake Pipeline

```
Build the Intake tab — the AI-parsed request queue. Reference prisma/schema.prisma for IntakeItem model and src/types/index.ts.

API routes needed:
1. GET /api/intake — all IntakeItems sorted by receivedAt desc
2. PATCH /api/intake/[id] — update status, parsed fields
3. POST /api/intake/parse — accepts raw content + source, calls src/lib/ai/claude.ts parseIntakeContent(), creates IntakeItem
4. POST /api/confirm — accepts jobId, calls src/lib/confirmation.ts sendConfirmations() to fire call+email+SMS

Components to build in src/components/intake/:
1. IntakeCard — card for each intake item. Shows: source icon (phone/email/form), customer name, address, parsed service type, confidence bar (green 90+, amber 70-89, red <70), status pill, timestamp. Expandable to show all parsed fields + raw content.
2. ParsedFields — grid of parsed fields (customer, phone, address, service type, date, time, container size, notes). Fields with confidence below 70% get amber highlight. Editable in "Edit" mode.
3. ConfidenceBar — horizontal bar 0-100 with color gradient.
4. ApprovalActions — 5-button action bar:
   - Approve (green) → creates CartingJob from parsed fields, fires auto-confirmation, shows 3 worker recommendations
   - Decline (red) → marks declined
   - Hold (amber) → marks on-hold
   - Edit (blue) → toggles inline editing of parsed fields
   - Flag (purple) → marks for elevated review
5. AudioPlayer — for phone intake with audioUrl. Simple play/pause with waveform placeholder.

Intake tab layout:
- Filter bar at top: All | Pending | Needs Review | Flagged | Approved | Declined
- Grid of IntakeCards below, most recent first
- When Approve is clicked: success toast with "Job created + confirmations sent" and quick-link to the new job

Connect to the Claude AI intake parser in src/lib/ai/claude.ts. The parseIntakeContent function is already built.
```

---

### PHASE 4: AI Layer

```
Build all AI-powered features. The Claude API wrapper is already in src/lib/ai/claude.ts with functions for dispatchAiChat, projectBrainChat, parseVoiceIntent, and getWorkerRecommendations.

1. Dispatch AI Sidebar (src/components/dispatch/DispatchAiSidebar.tsx):
   - Chat interface in the right 30% of the Dispatch tab
   - POST /api/ai/dispatch-chat — accepts message + chatHistory, builds scheduleContext from today's jobs, calls dispatchAiChat()
   - Shows chat bubbles (user = right/amber, AI = left/surface-2)
   - Input bar at bottom with send button
   - Context-aware: knows today's schedule, all workers, all trucks

2. Project Brain Chat (src/components/projects/ProjectBrainChat.tsx):
   - Per-project chat inside each project detail view
   - POST /api/projects/[id]/chat — accepts message, builds projectContext + globalScheduleContext, calls projectBrainChat()
   - Saves messages to ProjectChat table for persistence
   - Same chat UI pattern as dispatch sidebar

3. Worker Recommendations integration:
   - When JobDashboard opens OR when an intake item is approved, call POST /api/workers/recommend with job context + available workers
   - Returns 3 ranked workers with scores and reasons
   - Show as cards below the job info with "Assign" button

4. Voice Dispatch:
   - When mic is active (micActive in Zustand store), use browser MediaRecorder to capture audio
   - POST /api/voice/dispatch — accepts audio blob, transcribes (Whisper API or browser SpeechRecognition), calls parseVoiceIntent()
   - Returns intent + entities + suggestedAction
   - Show a confirmation card: "Mark Mikey Munda as OUT SICK?" with Confirm/Cancel
   - On confirm, execute the action (PATCH the relevant entity)

Use the existing AI functions in src/lib/ai/claude.ts. Don't call the Anthropic SDK directly from components or routes — always go through the wrapper.
```

---

### PHASE 5: Confirmations + Integrations

```
Wire up the real third-party integrations. The wrapper functions exist in src/lib/integrations/ but have TODO placeholders.

1. RingCentral Voice (src/lib/integrations/ringcentral.ts):
   - Uncomment the ringcentral client code
   - POST /api/webhooks/ringcentral — handles inbound calls (returns TwiML to record), recording callbacks (saves audioUrl), transcription callbacks (creates IntakeItem + runs AI parse)
   - POST /api/voice/callback — handles auto-confirmation keypress (1=confirm, 2=transfer to dispatcher)
   - Update src/lib/confirmation.ts sendVoiceConfirmation to use real RingCentral

2. Outlook Email (src/lib/integrations/outlook.ts):
   - Background worker (src/workers/pollOutlook.ts) that polls every 60 seconds for new unread emails in the dispatch inbox
   - For each new email: mark as read, create IntakeItem with source=EMAIL, run AI parse
   - Wire up sendConfirmationEmail for outbound confirmations

3. IntelliShift GPS (src/lib/integrations/intellishift.ts):
   - Background worker (src/workers/pollIntellishift.ts) that polls vehicle locations every 30 seconds
   - Updates Truck records with lastGpsLat, lastGpsLng, lastGpsUpdate
   - Fleet tab should show live-ish locations (polling, not WebSocket for now)

4. Auto-confirmation flow (src/lib/confirmation.ts):
   - When intake approved → create job → fire all 3 channels simultaneously (Promise.allSettled)
   - Track delivery status per channel in Confirmation table
   - Show confirmation status on job detail (3 channel pills: ✓ sent / ⏳ pending / ✗ failed)

For background workers, use a simple setInterval in a standalone Node script, or integrate Inngest/Trigger.dev if you want proper job queues.
```

---

### PHASE 6: Planner + Fleet + Crew + Polish

```
Build the remaining tabs and polish the app.

1. Planner Tab (src/components/planner/):
   - Monthly calendar grid (6 weeks × 7 days)
   - Each DayCell shows: date number, capacity dots (green 1-3 jobs, amber 4-6, red 7+), conflict flag icon if any conflicts that day
   - Click a day → setSelectedDate + setActiveTab('dispatch') to navigate
   - GET /api/planner?month=YYYY-MM — returns job counts + conflict flags per day for the month

2. Fleet Tab (src/components/fleet/):
   - Grid of TruckCards for all 18 vehicles
   - Filter bar: All | Available | En Route | On Site | Maintenance
   - Each card: truck name, type badge, status pill, current location, assigned driver, year/make/model, VIN (font-mono)
   - Click card → detail view with trip history placeholder

3. Crew Tab (src/components/crew/):
   - Worker cards grouped by status (Available, On Site, En Route, Off Duty, Out Sick, Vacation)
   - Filter by role: All | Driver | Laborer | Foreman | Operator
   - Each card: name, role badge, status pill, certifications as small tags, current assignment, phone
   - Click card → expandable profile with clock history, job history, performance notes

4. Settings Tab:
   - 4 integration panels: IntelliShift, RingCentral, Outlook, RALCO
   - Each panel: connected/disconnected status, last sync time, config fields (API keys, etc.), test connection button
   - System config section: Claude API key, Maps provider toggle, auto-confirm defaults

5. Global Search Modal:
   - Triggered by ⌘K or search button
   - Uses cmdk (Command menu) component
   - Searches jobs, workers, trucks, projects
   - Grouped results with type icons
   - Enter → navigate to item (open job dashboard, switch to crew tab, etc.)

6. Change Log Drawer:
   - Sheet/drawer from the right
   - Lists all ChangeLog entries sorted by timestamp desc
   - Each entry: icon for entity type, entity name, "field: old → new", timestamp, user
   - Filter by entity type

Use shadcn/ui Sheet for the drawer, Command for search. Follow the dark theme throughout.
```

---

## Tips

- After each phase, run `pnpm build` to catch type errors early
- Use `pnpm db:studio` to inspect your database visually
- The `.cursorrules` file gives Cursor persistent context — keep it updated as you build
- When a phase is working, commit before starting the next one
