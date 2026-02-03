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
