import Anthropic from '@anthropic-ai/sdk';

// Singleton client
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

const MODEL = 'claude-sonnet-4-5-20250929'; // Fast + smart. Swap to opus-4-5 for heavier reasoning.

// ─── INTAKE PARSING ────────────────────────────────────────
// Takes raw phone transcript / email body / form data → structured fields

export async function parseIntakeContent(rawContent: string, source: 'phone' | 'email' | 'form') {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a dispatcher intake parser for a NYC demolition and carting company (EDCC Services Corp).
Parse incoming service requests into structured data. The company handles: pickups, drop-offs, dump-outs, and container swaps.
NYC boroughs: Manhattan, Brooklyn, Queens, Bronx, Staten Island.
Container sizes: 10yd, 20yd, 30yd, 40yd.

Return ONLY valid JSON with this exact shape:
{
  "customer": string | null,
  "phone": string | null,
  "email": string | null,
  "serviceType": "PICKUP" | "DROP_OFF" | "DUMP_OUT" | "SWAP" | null,
  "address": string | null,
  "borough": "MANHATTAN" | "BROOKLYN" | "QUEENS" | "BRONX" | "STATEN_ISLAND" | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "containerSize": string | null,
  "notes": string | null,
  "confidence": number (0-100)
}

Confidence scoring:
- 90+ = all critical fields present and clear
- 70-89 = most fields present but some ambiguity
- Below 70 = missing critical fields or very unclear

Be strict about confidence. If the caller is mumbling or unclear, score it low.`,
    messages: [
      { role: 'user', content: `Parse this ${source} intake:\n\n${rawContent}` }
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}


// ─── WORKER RECOMMENDATIONS ────────────────────────────────
// Given a job and available workers, returns ranked recommendations

export async function getWorkerRecommendations(
  jobContext: string,
  availableWorkers: { id: string; name: string; role: string; certifications: string[]; currentAssignment: string | null }[]
) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a workforce optimizer for a NYC demolition and carting company.
Given a job description and a list of available workers, recommend the top 3 best matches.

Consider: role match, certifications required, current proximity/assignment, experience.

Return ONLY valid JSON array:
[
  { "workerId": string, "score": number (0-100), "reasons": string[] },
  ...
]

Max 3 recommendations. Score honestly — don't inflate.`,
    messages: [
      { role: 'user', content: `Job:\n${jobContext}\n\nAvailable workers:\n${JSON.stringify(availableWorkers, null, 2)}` }
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}


// ─── VOICE INTENT PARSING ──────────────────────────────────
// Takes a voice transcript and returns the dispatcher's intent

export async function parseVoiceIntent(transcript: string, currentScheduleContext: string) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a voice command interpreter for a dispatch system.
The dispatcher speaks naturally and you need to extract the intent.

Possible intents:
- TRUCK_DOWN: truck is out of service (broke, down, out)
- MARK_SICK: worker is out sick, remove from schedule
- RESCHEDULE: move a job to a different date/time
- ADD_NOTE: add a note to a job
- MARK_COMPLETE: mark a job as completed
- SWAP_WORKER: replace one worker with another
- SWAP_TRUCK: replace one truck with another
- GENERAL_QUERY: asking a question about the schedule

Return ONLY valid JSON:
{
  "intent": string,
  "entities": {
    "workerName": string | null,
    "jobIdentifier": string | null,
    "truckName": string | null,
    "date": string | null,
    "time": string | null,
    "note": string | null,
    "status": string | null
  },
  "confidence": number (0-100),
  "suggestedAction": string
}`,
    messages: [
      { role: 'user', content: `Current schedule context:\n${currentScheduleContext}\n\nDispatcher said: "${transcript}"` }
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}


// ─── PROJECT BRAIN (Per-Project AI Chat) ───────────────────
// Context-aware AI assistant for each demo project

export async function projectBrainChat(
  projectContext: string,
  globalScheduleContext: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
) {
  const messages = [
    ...chatHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are the "Project Brain" — an AI assistant embedded in a specific demolition project.
You have full context on this project AND the entire company's schedule.

PROJECT CONTEXT:
${projectContext}

GLOBAL SCHEDULE (today + upcoming):
${globalScheduleContext}

RULES:
- Always check global schedule for conflicts before recommending changes
- Surface conflicts proactively with amber/red severity
- Never make changes silently — always show what would be affected
- Reference previous chat messages when relevant
- Be concise but thorough. This is a busy dispatcher.
- Use concrete data: names, dates, truck numbers. No vague answers.`,
    messages,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}


// ─── DISPATCH AI SIDEBAR ───────────────────────────────────
// General dispatch assistant with schedule context

export async function dispatchAiChat(
  scheduleContext: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
) {
  const messages = [
    ...chatHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are the DispatchHub AI assistant for EDCC Services Corp, a NYC demolition and carting company.
You have access to today's full dispatch schedule.

CURRENT SCHEDULE:
${scheduleContext}

You can help with:
- Schedule overview and status
- Conflict detection and resolution
- Worker availability and recommendations
- Route information
- Job rescheduling suggestions
- Answering questions about any job, worker, or truck

Be direct and practical. Dispatchers are busy — no fluff. Use names and numbers.`,
    messages,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ─── PREVIEW ASSIGNMENT ANALYSIS ───────────────────────────
// Analyzes a proposed truck/driver/worker assignment for an intake item
// Returns efficiency score, conflicts, warnings, positives, deadhead, workload, suggestion

export interface PreviewAnalysisInput {
  parsed: {
    customer: string | null;
    address: string | null;
    borough: string | null;
    serviceType: string | null;
    date: string | null;
    time: string | null;
    containerSize: string | null;
    notes: string | null;
  };
  assignment: {
    truckId: string | null;
    driverId: string | null;
    workerIds: string[];
    timeOverride: string | null;
  };
  existingJobs: Array<{
    id: string;
    customer: string;
    address: string;
    borough: string;
    time: string;
    truckId: string | null;
    truckName?: string | null;
    driverId: string | null;
    driverName?: string | null;
    workerIds?: string[];
  }>;
  otherPreviews: Array<{
    intakeItemId: string;
    customerName?: string;
    truckId: string;
    driverId: string;
    workerIds: string[];
    time: string;
  }>;
  workers: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    certifications: string[];
    jobCountToday: number;
  }>;
  trucks: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    currentLocation: string | null;
    jobCountToday: number;
  }>;
}

export async function analyzePreviewAssignment(input: PreviewAnalysisInput) {
  const system = `You are the dispatch analysis engine for EDCC Services Corp, a NYC demolition and carting company. Analyze this proposed dispatch assignment. Be specific with borough names, street references, and times. Compare against alternatives. Give honest pros and cons. If there's a clearly better option, say so directly. The dispatcher wants to make informed decisions, not be told what to do. Respond ONLY with valid JSON matching the PreviewAnalysis schema.`;

  const schema = `PreviewAnalysis: {
  "efficiencyScore": number (0-100),
  "conflicts": [] (leave empty; server injects conflict engine results),
  "warnings": string[],
  "positives": string[],
  "estimatedDeadhead": string,
  "workloadBalance": string,
  "alternativeSuggestion": string,
  "routeImpact": string
}`;

  const userContent = `Schema to return:\n${schema}\n\nInput data:\n${JSON.stringify(input, null, 2)}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `${system}\n\nReturn only valid JSON. Set "conflicts" to [].`,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as import('@/types').PreviewAnalysis;
}

// ─── DISPATCH COMMAND CENTER: SCENARIO ANALYSIS ─────────────
// Analyzes a scenario (truck down, worker sick, swap, reschedule, etc.)

export interface AnalyzeScenarioInput {
  scenario: import('@/types').ScenarioInput;
  todayJobs: Array<{
    id: string;
    customer: string;
    address: string;
    borough: string;
    time: string;
    type: string;
    status: string;
    truckId: string | null;
    truckName?: string | null;
    driverId: string | null;
    driverName?: string | null;
    workerIds?: string[];
    workerNames?: string[];
  }>;
  trucks: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    currentLocation: string | null;
    todayJobCount?: number;
  }>;
  workers: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    certifications: string[];
    todayJobCount?: number;
  }>;
  truckRoutes: Array<{
    truckId: string;
    truckName: string;
    stops: Array<{ jobId: string; customer: string; address: string; borough: string; time: string; type: string; status: string; sequence: number }>;
  }>;
}

export async function analyzeScenario(input: AnalyzeScenarioInput): Promise<import('@/types').ScenarioResult> {
  const system = `You are the dispatch scenario engine for EDCC Services Corp, a NYC demolition and carting company operating 18 trucks across 5 boroughs.

Analyze this dispatch scenario. Consider:
- Equipment compatibility (roll-off for containers, packers for waste, box trucks for debris)
- Borough proximity and realistic NYC travel times (not straight-line distance)
- Driver certifications and current assignments
- Time windows and feasibility of rerouting mid-day
- Which jobs become unassigned and need coverage
- Workload balance across the fleet

Be specific: use truck names, driver names, borough names, and estimated times.
Give the dispatcher clear options ranked by quality score.

Respond ONLY with valid JSON matching this exact schema:
{
  "feasible": boolean,
  "score": number (0-100),
  "affectedRoutes": [{ "truckId": string, "truckName": string, "before": { "totalStops": number, "estimatedDuration": string (under 10 words), "boroughs": string[] }, "after": { "totalStops": number, "estimatedDuration": string, "boroughs": string[] }, "impact": string (under 20 words) }],
  "unassignedJobs": [{ "jobId": string, "customer": string, "address": string, "time": string, "suggestedTruck": string, "suggestedDriver": string, "reason": string (under 20 words) }],
  "warnings": string[] (each under 20 words),
  "recommendation": string (1-2 sentences, under 40 words),
  "alternativeScenarios": [{ "label": string (under 10 words), "score": number, "summary": string (under 25 words) }]
}

No markdown, no explanation, no code fences. JSON only.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: `Analyze this scenario:\n\n${JSON.stringify(input, null, 2)}` }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned) as import('@/types').ScenarioResult;
  } catch {
    return {
      feasible: false,
      score: 0,
      affectedRoutes: [],
      unassignedJobs: [],
      warnings: [],
      recommendation: cleaned || 'Scenario analysis failed to parse.',
      alternativeScenarios: [],
    };
  }
}

// ─── QUICK RECOMMENDATION (card preview) ───────────────────

export interface QuickRecommendationInput {
  job: {
    customer: string;
    address: string;
    borough: string;
    time: string;
    type: string;
  };
  proposedTruckName: string;
  proposedDriverName: string;
  truckType: string;
  driverCerts: string[];
  todayScheduleSummary: string;
}

export interface QuickRecommendationResult {
  score: number;
  oneliner: string;
  proceed: boolean;
}

export async function getQuickRecommendation(input: QuickRecommendationInput): Promise<QuickRecommendationResult> {
  const system = `Rate this dispatch assignment 0-100. One sentence why. Consider equipment match, borough proximity, driver certs, and schedule fit.
Respond ONLY with JSON: { "score": number, "oneliner": string (under 20 words), "proceed": boolean }
No markdown, no explanation. JSON only.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 256,
    system,
    messages: [{ role: 'user', content: JSON.stringify(input, null, 2) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned) as QuickRecommendationResult;
  } catch {
    return { score: 0, oneliner: 'Unable to rate assignment.', proceed: false };
  }
}

// ─── JOB DASHBOARD: ANALYZE JOB ──────────────────────────────
// Returns structured analysis for a specific job in context of full day schedule

export interface AnalyzeJobInput {
  job: {
    id: string;
    customer: string;
    address: string;
    borough: string;
    date: string;
    time: string;
    type: string;
    status: string;
    truckId: string | null;
    truckName: string | null;
    driverId: string | null;
    driverName: string | null;
    notes: string | null;
  };
  action: 'initial' | 'swap_truck' | 'swap_driver' | 'reschedule' | 'freeform';
  proposedTruckId?: string | null;
  proposedTruckName?: string | null;
  proposedDriverId?: string | null;
  proposedDriverName?: string | null;
  todayJobs: Array<{
    id: string;
    customer: string;
    address: string;
    borough: string;
    time: string;
    truckId: string | null;
    truckName: string | null;
    driverId: string | null;
    driverName: string | null;
  }>;
  truckRoutes: Array<{
    truckId: string;
    truckName: string;
    stops: Array<{ jobId: string; customer: string; address: string; borough: string; time: string }>;
  }>;
  workers: Array<{ id: string; name: string; role: string; status: string; todayJobCount: number }>;
  trucks: Array<{ id: string; name: string; type: string; status: string; todayJobCount: number }>;
}

export type JobAnalysisResult = import('@/types').JobAnalysis;

export async function analyzeJob(input: AnalyzeJobInput): Promise<JobAnalysisResult> {
  const system = `You are the dispatch analysis engine for EDCC Services Corp, a NYC demolition and carting company.

Analyze the FOCUS JOB in context of today's full schedule. Consider:
- Double-bookings (same truck or driver at same time)
- Route impact (travel time, borough clustering)
- Load balancing (trucks/drivers with too many jobs)
- Consolidation opportunities (nearby jobs, same borough)

Return ONLY valid JSON with this exact schema:
{
  "conflicts": string[] (each under 30 words - scheduling conflicts for this job),
  "recommendations": string[] (each under 30 words - proactive suggestions),
  "warnings": string[] (each under 30 words - potential issues),
  "impactSummary": string (one line, under 40 words - e.g. "Swapping to Truck 6 adds 15min to route, no conflicts"),
  "workerRecs": [{ "workerId": string, "name": string, "score": number (0-100), "reason": string (under 25 words) }],
  "truckRecs": [{ "truckId": string, "name": string, "type": string (e.g. PACKER, ROLL_OFF), "reason": string (under 25 words) }],
  "optimizationTip": string | null (one actionable tip, e.g. "This job is 0.5mi from Harbor View's 8am stop — consolidate onto same truck to save a trip", or null)
}

- conflicts: red-bordered card (double-book, overlap, conflict)
- recommendations: green-bordered (move job, consolidate, optimize)
- warnings: yellow-bordered (heavy load, long route, risk)
- impactSummary: one sentence for map/header
- workerRecs: top 3 workers for this job with score and short reason
- truckRecs: top 3 trucks (available, equipment match, no jobs today or closest to job site)
- optimizationTip: single best consolidation/optimization suggestion or null

No markdown, no code fences. JSON only.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: `Analyze this job:\n\n${JSON.stringify(input, null, 2)}` }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      impactSummary: typeof parsed.impactSummary === 'string' ? parsed.impactSummary : '',
      workerRecs: Array.isArray(parsed.workerRecs) ? parsed.workerRecs : [],
      truckRecs: Array.isArray(parsed.truckRecs) ? parsed.truckRecs : [],
      optimizationTip: typeof parsed.optimizationTip === 'string' ? parsed.optimizationTip : undefined,
    };
  } catch {
    return {
      conflicts: [],
      recommendations: [],
      warnings: [],
      impactSummary: cleaned.slice(0, 80) || 'Analysis unavailable.',
      workerRecs: [],
      truckRecs: [],
    };
  }
}
