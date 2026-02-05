import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages.js';

// Singleton client
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

const MODEL = 'claude-sonnet-4-5-20250929'; // Fast + smart. Swap to opus-4-5 for heavier reasoning.

/** System block with optional prompt-cache control (supported by API; SDK types may lag). */
type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
// Request body type for create() when using system blocks with cache_control (API supports it).
type CreateParams = Parameters<Anthropic['messages']['create']>[0] & { system?: SystemBlock[] };

function logUsage(functionName: string, response: { usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }) {
  const u = response.usage;
  if (u) {
    const cacheRead = (u as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;
    const cacheCreate = (u as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
    console.log(
      `[AI] ${functionName}: ${u.input_tokens} in / ${u.output_tokens} out / cache_read: ${cacheRead} / cache_create: ${cacheCreate}`
    );
  }
}

// ─── INTAKE PARSING ────────────────────────────────────────
// Takes raw phone transcript / email body / form data → structured fields

export async function parseIntakeContent(rawContent: string, source: 'phone' | 'email' | 'form') {
  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: `You are a dispatcher intake parser for a NYC demolition and carting company (EDCC Services Corp).
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
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: `Parse this ${source} intake:\n\n${rawContent}` }
      ],
    } as CreateParams)) as Message;
    logUsage('parseIntakeContent', response);
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] parseIntakeContent error:', status, (error as Error)?.message);
    throw new Error(errorMessage);
  }
}


// ─── WORKER RECOMMENDATIONS ────────────────────────────────
// Given a job and available workers, returns ranked recommendations

export async function getWorkerRecommendations(
  jobContext: string,
  availableWorkers: { id: string; name: string; role: string; certifications: string[]; currentAssignment: string | null }[]
) {
  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: `You are a workforce optimizer for a NYC demolition and carting company.
Given a job description and a list of available workers, recommend the top 3 best matches.

Consider: role match, certifications required, current proximity/assignment, experience.

Return ONLY valid JSON array:
[
  { "workerId": string, "score": number (0-100), "reasons": string[] },
  ...
]

Max 3 recommendations. Score honestly — don't inflate.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: `Job:\n${jobContext}\n\nAvailable workers:\n${JSON.stringify(availableWorkers)}` }
      ],
    } as CreateParams)) as Message;
    logUsage('getWorkerRecommendations', response);
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] getWorkerRecommendations error:', status, (error as Error)?.message);
    throw new Error(errorMessage);
  }
}


// ─── VOICE INTENT PARSING (Agentic) ─────────────────────────
// Takes a voice/chat transcript and returns executable actions.
// NEVER asks for clarification — acts or suggests concretely.

export interface AgenticVoiceInput {
  transcript: string;
  scheduleContext: string;
  conversationHistory?: { role: string; content: string }[];
}

export async function parseVoiceIntent(
  transcript: string,
  scheduleContext: string,
  conversationHistory?: { role: string; content: string }[]
): Promise<import('@/types').AgenticVoiceResponse> {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  if (conversationHistory?.length) {
    const recent = conversationHistory.slice(-4);
    for (const m of recent) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  messages.push({
    role: 'user',
    content: `FULL SCHEDULE FOR TODAY:\n${scheduleContext}\n\nDispatcher said: "${transcript}"`,
  });

  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: `You are an agentic dispatch AI for a NYC carting/demolition company. You EXECUTE commands, not ask questions.

RULES:
- NEVER ask for clarification. If ambiguous, pick the most logical interpretation and act.
- When user says 'yes', 'do it', 'apply', 'fix it', 'go ahead', 'ok' — execute the most recent suggestion.
- Always return specific, actionable changes with exact job IDs, truck names, and worker names.
- You have full authority to reassign trucks, swap drivers, mark jobs complete, and reschedule.
- IMPORTANT: You can ONLY create jobs for the date currently being viewed. You cannot create jobs for other dates from this chat. If the user asks to create a job for a different date (like "tomorrow" or "Feb 6th"), tell them: "I can only add jobs to today's schedule (the date you're viewing). To add jobs for [requested date], either switch to that date using the arrows, or use the Intake tab for multi-day scheduling."
- Never claim you created a job for a different date than the current view — jobs always go to today's date regardless of what the user requests.

You must respond with JSON only. No markdown, no explanation outside the JSON structure.

Response format:
{
  "type": "update" | "scenario" | "query",
  "message": "Human-readable summary of what you did or recommend",
  "actions": [
    {
      "action": "assign_driver" | "assign_truck" | "mark_complete" | "mark_delayed" | "reschedule" | "swap_truck" | "swap_driver" | "create_job",
      "jobId": "exact job id from schedule context (omit for create_job)",
      "jobName": "customer name for display",
      "params": { ... action-specific params }
    }
  ],
  "autoApply": false
}

When user confirms (yes/do it/apply/go ahead), set autoApply: true and the system will execute all actions immediately.

Action params:
- assign_driver: { "driverId": string, "driverName": string }
- assign_truck: { "truckId": string, "truckName": string }
- mark_complete: {}
- mark_delayed: {}
- reschedule: { "newDate": "YYYY-MM-DD", "newTime": "HH:MM" (optional) }
- swap_truck: { "newTruckId": string, "newTruckName": string }
- swap_driver: { "newDriverId": string, "newDriverName": string }
- create_job: { "customer": string, "address": string, "borough": "MANHATTAN"|"BROOKLYN"|"QUEENS"|"BRONX"|"STATEN_ISLAND", "time": "HH:MM" (24h format), "type": "PICKUP"|"DROP_OFF"|"DUMP_OUT"|"SWAP"|"HAUL", "containerSize": string (optional), "truckId": string (optional), "truckName": string (optional), "driverId": string (optional), "driverName": string (optional), "notes": string (optional) }
  NOTE: Jobs are always created for the currently viewed date. Do not include a "date" param — it will be ignored. If user requests a different date, decline and explain they need to switch dates or use Intake tab.

Use exact IDs from the schedule context. If you only have names, use truckName/driverName and the system will resolve to IDs.

RULES for create_job:
- For create_job: jobId should be omitted. jobName should be the customer name. If the user doesn't specify a customer name, use a descriptive name like "NYC Pickup" or "BK Drop-off". If no address given, use a reasonable default for the borough. If no type given, default to "PICKUP". Source is always "PHONE" for dispatcher-created jobs.
- When the user says "add a stop" or "new job" or "schedule a pickup" etc, use create_job. Don't try to assign_truck/assign_driver to a non-existent job.
- Multiple stops in one command = multiple create_job actions.
- Always output time in 24h "HH:MM" format. Convert "7am" to "07:00", "1:30pm" to "13:30", "noon" to "12:00".`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `CURRENT SCHEDULE:\n${scheduleContext}`,
        },
      ],
      messages,
    } as CreateParams)) as Message;
    logUsage('parseVoiceIntent', response);
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        type: parsed.type ?? 'query',
        message: parsed.message ?? '',
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        autoApply: !!parsed.autoApply,
      };
    } catch {
      return {
        type: 'query',
        message: cleaned || 'Could not parse response.',
        actions: [],
        autoApply: false,
      };
    }
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] parseVoiceIntent error:', status, (error as Error)?.message);
    return {
      type: 'query',
      message: errorMessage,
      actions: [],
      autoApply: false,
    };
  }
}


// ─── PROJECT BRAIN (Per-Project AI Chat) ───────────────────
// Context-aware AI assistant for each demo project

export async function projectBrainChat(
  projectContext: string,
  globalScheduleContext: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
) {
  const trimmedHistory = chatHistory.slice(-6);
  const messages = [
    ...trimmedHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: `You are the "Project Brain" — an AI assistant embedded in a specific demolition project.
You have full context on this project AND the entire company's schedule.

RULES:
- Always check global schedule for conflicts before recommending changes
- Surface conflicts proactively with amber/red severity
- Never make changes silently — always show what would be affected
- Reference previous chat messages when relevant
- Be concise but thorough. This is a busy dispatcher.
- Use concrete data: names, dates, truck numbers. No vague answers.`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `PROJECT CONTEXT:\n${projectContext}\n\nGLOBAL SCHEDULE (today + upcoming):\n${globalScheduleContext}`,
        },
      ],
      messages,
    } as CreateParams)) as Message;
    logUsage('projectBrainChat', response);
    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] projectBrainChat error:', status, (error as Error)?.message);
    return errorMessage;
  }
}


// ─── DISPATCH AI SIDEBAR ───────────────────────────────────
// General dispatch assistant with schedule context

export async function dispatchAiChat(
  scheduleContext: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
) {
  const trimmedHistory = chatHistory.slice(-6);
  const messages = [
    ...trimmedHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: `You are the DispatchHub AI assistant for EDCC Services Corp, a NYC demolition and carting company.
You have access to today's full dispatch schedule.

You can help with:
- Schedule overview and status
- Conflict detection and resolution
- Worker availability and recommendations
- Route information
- Job rescheduling suggestions
- Answering questions about any job, worker, or truck

Be direct and practical. Dispatchers are busy — no fluff. Use names and numbers.`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `CURRENT SCHEDULE:\n${scheduleContext}`,
        },
      ],
      messages,
    } as CreateParams)) as Message;
    logUsage('dispatchAiChat', response);
    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] dispatchAiChat error:', status, (error as Error)?.message);
    return errorMessage;
  }
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

  const userContent = `Schema to return:\n${schema}\n\nInput data:\n${JSON.stringify(input)}`;

  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: `${system}\n\nReturn only valid JSON. Set "conflicts" to [].`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    } as CreateParams)) as Message;
    logUsage('analyzePreviewAssignment', response);
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as import('@/types').PreviewAnalysis;
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] analyzePreviewAssignment error:', status, (error as Error)?.message);
    throw new Error(errorMessage);
  }
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

  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Analyze this scenario:\n\n${JSON.stringify(input)}` }],
    } as CreateParams)) as Message;
    logUsage('analyzeScenario', response);
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
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] analyzeScenario error:', status, (error as Error)?.message);
    return {
      feasible: false,
      score: 0,
      affectedRoutes: [],
      unassignedJobs: [],
      warnings: [],
      recommendation: errorMessage,
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

  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 256,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    } as CreateParams)) as Message;
    logUsage('getQuickRecommendation', response);
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(cleaned) as QuickRecommendationResult;
    } catch {
      return { score: 0, oneliner: 'Unable to rate assignment.', proceed: false };
    }
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] getQuickRecommendation error:', status, (error as Error)?.message);
    return { score: 0, oneliner: errorMessage, proceed: false };
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

  try {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Analyze this job:\n\n${JSON.stringify(input)}` }],
    } as CreateParams)) as Message;
    logUsage('analyzeJob', response);
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
  } catch (error: unknown) {
    const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
    let errorMessage = 'AI temporarily unavailable.';
    if (status === 401) errorMessage = 'API key invalid — check Settings.';
    else if (status === 429) errorMessage = 'Rate limit hit — wait 30 seconds.';
    else if (status === 529) errorMessage = 'Claude API overloaded — retrying...';
    console.error('[AI] analyzeJob error:', status, (error as Error)?.message);
    return {
      conflicts: [],
      recommendations: [],
      warnings: [],
      impactSummary: errorMessage,
      workerRecs: [],
      truckRecs: [],
    };
  }
}
