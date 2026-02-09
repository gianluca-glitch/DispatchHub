// DispatchHub — Projects AI System Prompt + Tool Definitions
// Compact, token-efficient prompt for Fabio's project management chat.

import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';

export function buildProjectsSystemPrompt(context: {
  projectsSummary: string;
  workersList: string;
  trucksList: string;
}): string {
  return `You are the Project Brain for EDCC Services Corp — a NYC demolition & carting company. Boss is Fabio.

RULES:
- ALWAYS confirm which project before any write action. If ambiguous, ask.
- For add_note: suggest a category and ask "Filing under [Category] — OK?" before saving.
- Use EXACT names from context when calling tools. Never guess IDs.
- Be concise. Fabio is busy. No fluff.
- Use NYC-specific references (boroughs, neighborhoods).
- Phases: PLANNING → ACTIVE_DEMO → CARTING → CLEANUP → COMPLETE

AVAILABLE PROJECTS:
${context.projectsSummary || 'No projects yet.'}

WORKERS:
${context.workersList || 'No workers loaded.'}

TRUCKS:
${context.trucksList || 'No trucks loaded.'}

NOTE CATEGORIES: general, workers, equipment, purchase_orders, schedule, client, budget, change_orders, permits`;
}

export const PROJECT_TOOLS: Tool[] = [
  {
    name: 'create_project',
    description: 'Create a new demolition project',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Project name' },
        address: { type: 'string', description: 'Street address' },
        borough: {
          type: 'string',
          enum: ['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN_ISLAND'],
        },
        clientName: { type: 'string', description: 'Client/customer name' },
        clientPhone: { type: 'string', description: 'Client phone (optional)' },
        phase: {
          type: 'string',
          enum: ['PLANNING', 'ACTIVE_DEMO', 'CARTING', 'CLEANUP', 'COMPLETE'],
          description: 'Default: PLANNING',
        },
      },
      required: ['name', 'address', 'borough', 'clientName'],
    },
  },
  {
    name: 'update_project',
    description: 'Update project fields (phase, dates, costs, notes)',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string' },
        phase: {
          type: 'string',
          enum: ['PLANNING', 'ACTIVE_DEMO', 'CARTING', 'CLEANUP', 'COMPLETE'],
        },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
        notes: { type: 'string' },
        estimatedCost: { type: 'number' },
        actualCost: { type: 'number' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'add_note',
    description: 'Add a note to a project with a category',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string' },
        content: { type: 'string', description: 'Note content' },
        suggestedCategory: {
          type: 'string',
          enum: [
            'general', 'workers', 'equipment', 'purchase_orders',
            'schedule', 'client', 'budget', 'change_orders', 'permits',
          ],
          description: 'Suggest best category for this note',
        },
      },
      required: ['projectId', 'content', 'suggestedCategory'],
    },
  },
  {
    name: 'assign_worker',
    description: 'Assign a worker to a project with a role',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string' },
        workerName: { type: 'string', description: 'Worker name — will be resolved to ID' },
        role: {
          type: 'string',
          enum: ['FOREMAN', 'LABORER', 'OPERATOR', 'DRIVER'],
        },
      },
      required: ['projectId', 'workerName', 'role'],
    },
  },
  {
    name: 'remove_worker',
    description: 'Remove a worker from a project',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string' },
        workerName: { type: 'string', description: 'Worker name to remove' },
      },
      required: ['projectId', 'workerName'],
    },
  },
  {
    name: 'assign_truck',
    description: 'Assign a truck to a project',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string' },
        truckIdentifier: { type: 'string', description: 'Truck name (e.g. "Packer 07") — resolved to ID' },
      },
      required: ['projectId', 'truckIdentifier'],
    },
  },
  {
    name: 'remove_truck',
    description: 'Remove a truck from a project',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string' },
        truckIdentifier: { type: 'string', description: 'Truck name to remove' },
      },
      required: ['projectId', 'truckIdentifier'],
    },
  },
  {
    name: 'list_projects',
    description: 'List project summaries with optional filter',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['active', 'planning', 'complete', 'all'],
          description: 'Default: all',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_notes',
    description: 'Search notes by content across one or all projects',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term' },
        projectId: { type: 'string', description: 'Optional — scope to one project' },
      },
      required: ['query'],
    },
  },
];
