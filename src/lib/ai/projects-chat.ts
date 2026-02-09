// DispatchHub — Projects AI Chat with Tool Use
// Uses Anthropic tool_use API for reliable action execution.
// Name resolution: AI returns names → code resolves to DB IDs.

import Anthropic from '@anthropic-ai/sdk';
import type { Message, ContentBlock, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages.js';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity-log';
import { buildProjectsSystemPrompt, PROJECT_TOOLS } from './projects-prompt';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return client;
}

const MODEL = 'claude-sonnet-4-5-20250929';

type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
type CreateParams = Parameters<Anthropic['messages']['create']>[0] & { system?: SystemBlock[] };

interface ToolResult {
  toolName: string;
  success: boolean;
  message: string;
  data?: unknown;
}

// ─── NAME RESOLUTION ────────────────────────────────────────

async function resolveWorker(name: string) {
  const workers = await db.worker.findMany({ select: { id: true, name: true } });
  const lower = name.toLowerCase();
  const exact = workers.find((w) => w.name.toLowerCase() === lower);
  if (exact) return exact;
  const partial = workers.filter((w) => w.name.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) return { error: `Multiple matches for "${name}": ${partial.map((w) => w.name).join(', ')}. Be more specific.` };
  return { error: `No worker found matching "${name}". Available: ${workers.map((w) => w.name).join(', ')}` };
}

async function resolveTruck(identifier: string) {
  const trucks = await db.truck.findMany({ select: { id: true, name: true } });
  const lower = identifier.toLowerCase();
  const exact = trucks.find((t) => t.name.toLowerCase() === lower);
  if (exact) return exact;
  const partial = trucks.filter((t) => t.name.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) return { error: `Multiple matches for "${identifier}": ${partial.map((t) => t.name).join(', ')}. Be more specific.` };
  return { error: `No truck found matching "${identifier}". Available: ${trucks.map((t) => t.name).join(', ')}` };
}

// ─── TOOL EXECUTION ─────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'create_project': {
        const project = await db.demoProject.create({
          data: {
            name: input.name as string,
            address: input.address as string,
            borough: input.borough as 'MANHATTAN' | 'BROOKLYN' | 'QUEENS' | 'BRONX' | 'STATEN_ISLAND',
            customer: input.clientPhone
              ? `${input.clientName} (${input.clientPhone})`
              : (input.clientName as string),
            phase: (input.phase as 'PLANNING' | 'ACTIVE_DEMO' | 'CARTING' | 'CLEANUP' | 'COMPLETE') ?? 'PLANNING',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 86400000),
          },
        });
        logActivity({
          userId: 'fabio', userName: 'Fabio', action: 'create_project',
          module: 'projects', detail: `${project.name} — ${project.address}`, projectId: project.id,
        });
        return { toolName: name, success: true, message: `Created project "${project.name}" (${project.borough})`, data: project };
      }

      case 'update_project': {
        const projectId = input.projectId as string;
        const data: Record<string, unknown> = {};
        const changes: string[] = [];
        if (input.phase) { data.phase = input.phase; changes.push(`phase → ${input.phase}`); }
        if (input.startDate) { data.startDate = new Date(input.startDate as string); changes.push(`startDate → ${input.startDate}`); }
        if (input.endDate) { data.endDate = new Date(input.endDate as string); changes.push(`endDate → ${input.endDate}`); }
        if (input.notes !== undefined) { data.notes = input.notes; changes.push('notes updated'); }
        if (input.estimatedCost !== undefined) { data.estimatedCost = input.estimatedCost; changes.push(`estimatedCost → $${input.estimatedCost}`); }
        if (input.actualCost !== undefined) { data.actualCost = input.actualCost; changes.push(`actualCost → $${input.actualCost}`); }

        const project = await db.demoProject.update({ where: { id: projectId }, data });
        logActivity({
          userId: 'fabio', userName: 'Fabio', action: 'update_project',
          module: 'projects', detail: changes.join(', '), projectId,
        });
        return { toolName: name, success: true, message: `Updated ${project.name}: ${changes.join(', ')}`, data: project };
      }

      case 'add_note': {
        const note = await db.projectNote.create({
          data: {
            projectId: input.projectId as string,
            content: input.content as string,
            category: input.suggestedCategory as string,
            createdBy: 'ai',
          },
        });
        const project = await db.demoProject.findUnique({ where: { id: input.projectId as string }, select: { name: true } });
        logActivity({
          userId: 'ai', userName: 'AI', action: 'add_note',
          module: 'projects', detail: `[${input.suggestedCategory}] ${(input.content as string).slice(0, 100)}`,
          projectId: input.projectId as string,
        });
        return {
          toolName: name, success: true,
          message: `Note added to ${project?.name ?? 'project'} under "${input.suggestedCategory}"`,
          data: { note, suggestedCategory: input.suggestedCategory, projectName: project?.name },
        };
      }

      case 'assign_worker': {
        const resolved = await resolveWorker(input.workerName as string);
        if ('error' in resolved) return { toolName: name, success: false, message: resolved.error };

        const project = await db.demoProject.findUnique({ where: { id: input.projectId as string }, select: { name: true } });
        await db.projectWorker.create({
          data: {
            projectId: input.projectId as string,
            workerId: resolved.id,
            role: input.role as 'FOREMAN' | 'LABORER' | 'OPERATOR' | 'DRIVER',
          },
        });
        logActivity({
          userId: 'fabio', userName: 'Fabio', action: 'assign_worker',
          module: 'projects', detail: `${resolved.name} (${input.role}) → ${project?.name}`,
          projectId: input.projectId as string,
        });
        return { toolName: name, success: true, message: `Assigned ${resolved.name} as ${input.role} to ${project?.name}` };
      }

      case 'remove_worker': {
        const resolved = await resolveWorker(input.workerName as string);
        if ('error' in resolved) return { toolName: name, success: false, message: resolved.error };

        const assignment = await db.projectWorker.findFirst({
          where: { projectId: input.projectId as string, workerId: resolved.id },
        });
        if (!assignment) return { toolName: name, success: false, message: `${resolved.name} is not assigned to this project` };

        await db.projectWorker.delete({ where: { id: assignment.id } });
        const project = await db.demoProject.findUnique({ where: { id: input.projectId as string }, select: { name: true } });
        logActivity({
          userId: 'fabio', userName: 'Fabio', action: 'remove_worker',
          module: 'projects', detail: `${resolved.name} removed from ${project?.name}`,
          projectId: input.projectId as string,
        });
        return { toolName: name, success: true, message: `Removed ${resolved.name} from ${project?.name}` };
      }

      case 'assign_truck': {
        const resolved = await resolveTruck(input.truckIdentifier as string);
        if ('error' in resolved) return { toolName: name, success: false, message: resolved.error };

        const project = await db.demoProject.findUnique({ where: { id: input.projectId as string }, select: { name: true } });
        await db.projectTruck.create({
          data: { projectId: input.projectId as string, truckId: resolved.id },
        });
        logActivity({
          userId: 'fabio', userName: 'Fabio', action: 'assign_truck',
          module: 'projects', detail: `${resolved.name} → ${project?.name}`,
          projectId: input.projectId as string,
        });
        return { toolName: name, success: true, message: `Assigned ${resolved.name} to ${project?.name}` };
      }

      case 'remove_truck': {
        const resolved = await resolveTruck(input.truckIdentifier as string);
        if ('error' in resolved) return { toolName: name, success: false, message: resolved.error };

        const assignment = await db.projectTruck.findFirst({
          where: { projectId: input.projectId as string, truckId: resolved.id },
        });
        if (!assignment) return { toolName: name, success: false, message: `${resolved.name} is not assigned to this project` };

        await db.projectTruck.delete({ where: { id: assignment.id } });
        const project = await db.demoProject.findUnique({ where: { id: input.projectId as string }, select: { name: true } });
        logActivity({
          userId: 'fabio', userName: 'Fabio', action: 'remove_truck',
          module: 'projects', detail: `${resolved.name} removed from ${project?.name}`,
          projectId: input.projectId as string,
        });
        return { toolName: name, success: true, message: `Removed ${resolved.name} from ${project?.name}` };
      }

      case 'list_projects': {
        const filter = input.filter as string ?? 'all';
        const where: Record<string, unknown> = {};
        if (filter === 'active') where.phase = { in: ['ACTIVE_DEMO', 'CARTING', 'CLEANUP'] };
        else if (filter === 'planning') where.phase = 'PLANNING';
        else if (filter === 'complete') where.phase = 'COMPLETE';

        const projects = await db.demoProject.findMany({
          where,
          include: {
            assignedWorkers: { include: { worker: { select: { name: true } } } },
            assignedTrucks: { include: { truck: { select: { name: true } } } },
            _count: { select: { projectNotes: true } },
          },
          orderBy: { updatedAt: 'desc' },
        });

        const summary = projects.map((p) =>
          `• ${p.name} (${p.phase}) — ${p.address}, ${p.borough} | ${p.assignedWorkers.length} crew, ${p.assignedTrucks.length} trucks, ${p._count.projectNotes} notes`
        ).join('\n');

        return { toolName: name, success: true, message: summary || 'No projects found.', data: projects };
      }

      case 'search_notes': {
        const where: Record<string, unknown> = {
          content: { contains: input.query as string, mode: 'insensitive' },
        };
        if (input.projectId) where.projectId = input.projectId;

        const notes = await db.projectNote.findMany({
          where,
          include: { project: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        const summary = notes.map((n) =>
          `• [${n.category}] ${n.project.name}: ${n.content.slice(0, 80)}`
        ).join('\n');

        return { toolName: name, success: true, message: summary || `No notes matching "${input.query}"`, data: notes };
      }

      default:
        return { toolName: name, success: false, message: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logActivity({
      userId: 'system', userName: 'System', action: 'error',
      module: 'projects', detail: `Tool ${name} failed`, error: errMsg,
      projectId: input.projectId as string | undefined,
    });
    if (errMsg.includes('Unique constraint')) {
      return { toolName: name, success: false, message: 'Already exists — duplicate assignment.' };
    }
    return { toolName: name, success: false, message: `Error: ${errMsg}` };
  }
}

// ─── BUILD CONTEXT ──────────────────────────────────────────

async function buildContext() {
  const [projects, workers, trucks] = await Promise.all([
    db.demoProject.findMany({
      include: {
        assignedWorkers: { include: { worker: { select: { name: true } } } },
        assignedTrucks: { include: { truck: { select: { name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.worker.findMany({ select: { id: true, name: true, role: true, status: true } }),
    db.truck.findMany({ select: { id: true, name: true, type: true, status: true } }),
  ]);

  const projectsSummary = projects.map((p) =>
    `${p.name} (id=${p.id}) | ${p.phase} | ${p.address}, ${p.borough} | crew: ${p.assignedWorkers.map((w) => w.worker.name).join(',')||'none'} | trucks: ${p.assignedTrucks.map((t) => t.truck.name).join(',')||'none'}`
  ).join('\n');

  const workersList = workers.map((w) => `${w.name} (${w.role}, ${w.status})`).join(', ');
  const trucksList = trucks.map((t) => `${t.name} (${t.type}, ${t.status})`).join(', ');

  return { projectsSummary, workersList, trucksList };
}

// ─── MAIN CHAT FUNCTION ─────────────────────────────────────

export interface ProjectsChatResult {
  response: string;
  toolResults: ToolResult[];
}

export async function projectsChatWithTools(
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
): Promise<ProjectsChatResult> {
  const context = await buildContext();
  const systemPrompt = buildProjectsSystemPrompt(context);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...chatHistory.slice(-6),
    { role: 'user', content: userMessage },
  ];

  const allToolResults: ToolResult[] = [];
  let finalResponse = '';

  // Tool use loop — AI may call multiple tools in sequence
  let currentMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let iteration = 0; iteration < 5; iteration++) {
    const response = (await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools: PROJECT_TOOLS,
      messages: currentMessages,
    } as CreateParams)) as Message;

    // Log usage
    const u = response.usage;
    if (u) {
      const cacheRead = (u as unknown as Record<string, number>).cache_read_input_tokens ?? 0;
      console.log(`[AI] projectsChat: ${u.input_tokens} in / ${u.output_tokens} out / cache: ${cacheRead}`);
    }

    // Collect text blocks
    const textBlocks = response.content.filter((b): b is TextBlock => b.type === 'text');
    const toolBlocks = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');

    if (textBlocks.length > 0) {
      finalResponse = textBlocks.map((b) => b.text).join('\n');
    }

    // If no tool calls, we're done
    if (toolBlocks.length === 0 || response.stop_reason !== 'tool_use') {
      break;
    }

    // Execute tool calls
    const toolResultMessages: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tool of toolBlocks) {
      const result = await executeTool(tool.name, tool.input as Record<string, unknown>);
      allToolResults.push(result);
      toolResultMessages.push({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: result.success ? result.message : `Error: ${result.message}`,
        is_error: !result.success,
      });
    }

    // Add assistant response + tool results to conversation for next iteration
    currentMessages = [
      ...currentMessages,
      { role: 'assistant' as const, content: response.content as ContentBlock[] },
      { role: 'user' as const, content: toolResultMessages },
    ];
  }

  return { response: finalResponse, toolResults: allToolResults };
}

// ─── GREETING ───────────────────────────────────────────────

export async function generateProjectGreeting(): Promise<string> {
  const projects = await db.demoProject.findMany({
    include: {
      assignedWorkers: true,
      assignedTrucks: true,
    },
  });

  const active = projects.filter((p) => ['ACTIVE_DEMO', 'CARTING', 'CLEANUP'].includes(p.phase));
  const planning = projects.filter((p) => p.phase === 'PLANNING');
  const complete = projects.filter((p) => p.phase === 'COMPLETE');

  const issues: string[] = [];
  for (const p of [...active, ...planning]) {
    if (p.assignedWorkers.length === 0) issues.push(`${p.name} has no crew`);
    if (p.assignedTrucks.length === 0) issues.push(`${p.name} has no trucks`);
    if (p.phase === 'ACTIVE_DEMO') {
      const hasForeman = p.assignedWorkers.some((w) => w.role === 'FOREMAN');
      if (!hasForeman) issues.push(`${p.name} (active demo) has no foreman`);
    }
  }

  const lines: string[] = [];
  lines.push(`${active.length} active, ${planning.length} planning, ${complete.length} complete.`);

  if (issues.length > 0) {
    lines.push(`Heads up: ${issues.slice(0, 3).join('; ')}.`);
  } else if (projects.length > 0) {
    lines.push('All projects staffed and equipped.');
  }

  lines.push('What do you need?');
  return lines.join(' ');
}
