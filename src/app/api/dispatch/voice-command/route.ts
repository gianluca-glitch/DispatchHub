import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseVoiceIntent } from '@/lib/ai/claude';
import { analyzeScenario } from '@/lib/ai/claude';
import type { ScenarioInput, ScenarioResult } from '@/types';

type Intent =
  | 'TRUCK_DOWN'
  | 'MARK_SICK'
  | 'RESCHEDULE'
  | 'ADD_NOTE'
  | 'MARK_COMPLETE'
  | 'SWAP_WORKER'
  | 'SWAP_TRUCK'
  | 'GENERAL_QUERY';

const SCENARIO_INTENTS: Intent[] = [
  'TRUCK_DOWN',
  'MARK_SICK',
  'RESCHEDULE',
  'SWAP_TRUCK',
  'SWAP_WORKER', // maps to SWAP_DRIVER scenario
];

// POST /api/dispatch/voice-command
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = (body.text as string)?.trim();
  const dateParam = (body.date as string) ?? new Date().toISOString().slice(0, 10);
  const date = new Date(dateParam + 'T12:00:00');
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  const [jobs, trucks, workers] = await Promise.all([
    db.cartingJob.findMany({
      where: { date: dateOnly, status: { notIn: ['CANCELLED'] } },
      include: {
        truck: true,
        driver: true,
        workers: { include: { worker: true } },
      },
      orderBy: { time: 'asc' },
    }),
    db.truck.findMany(),
    db.worker.findMany(),
  ]);

  const scheduleContext = [
    'Jobs today:',
    ...jobs.map(
      (j) =>
        `- ${j.customer} @ ${j.address} (${j.borough}) ${j.time} | Truck: ${j.truck?.name ?? 'unassigned'} | Driver: ${j.driver?.name ?? 'unassigned'} | Status: ${j.status}`
    ),
    'Trucks: ' + trucks.map((t) => t.name).join(', '),
    'Workers: ' + workers.map((w) => w.name).join(', '),
  ].join('\n');

  let parsed: {
    intent: string;
    entities: {
      workerName?: string | null;
      jobIdentifier?: string | null;
      truckName?: string | null;
      date?: string | null;
      time?: string | null;
      note?: string | null;
      status?: string | null;
    };
    confidence: number;
    suggestedAction: string;
  };
  try {
    parsed = await parseVoiceIntent(text, scheduleContext);
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to parse intent' },
      { status: 500 }
    );
  }

  const intent = parsed.intent as Intent;
  const entities = parsed.entities ?? {};

  const resolveTruck = (name: string | null | undefined): string | null => {
    if (!name) return null;
    const n = name.toLowerCase().replace(/\s+/g, '');
    const t = trucks.find(
      (x) =>
        x.name.toLowerCase().replace(/\s+/g, '').includes(n) ||
        n.includes(x.name.toLowerCase().replace(/\s+/g, ''))
    );
    return t?.id ?? null;
  };
  const resolveWorker = (name: string | null | undefined): string | null => {
    if (!name) return null;
    const n = name.toLowerCase();
    const w = workers.find((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()));
    return w?.id ?? null;
  };
  const resolveJob = (identifier: string | null | undefined): (typeof jobs)[0] | null => {
    if (!identifier) return null;
    const id = identifier.toLowerCase();
    const j = jobs.find(
      (x) =>
        x.customer.toLowerCase().includes(id) ||
        id.includes(x.customer.toLowerCase()) ||
        x.address.toLowerCase().includes(id) ||
        id.includes(x.address.toLowerCase()) ||
        x.borough.toLowerCase().includes(id)
    );
    return j ?? null;
  };

  // ── SCENARIO: run analysis and return result ──
  if (SCENARIO_INTENTS.includes(intent)) {
    let scenario: ScenarioInput;
    if (intent === 'TRUCK_DOWN') {
      const truckId = resolveTruck(entities.truckName ?? null);
      if (!truckId) {
        return NextResponse.json({
          type: 'query',
          result: { answer: 'Could not identify which truck. Say the truck name or number.' },
        });
      }
      scenario = { type: 'TRUCK_DOWN', affectedTruckId: truckId };
    } else if (intent === 'MARK_SICK') {
      const workerId = resolveWorker(entities.workerName ?? null);
      if (!workerId) {
        return NextResponse.json({
          type: 'query',
          result: { answer: 'Could not identify which worker. Say the worker name.' },
        });
      }
      scenario = { type: 'WORKER_SICK', affectedWorkerId: workerId };
    } else if (intent === 'SWAP_TRUCK' || intent === 'SWAP_WORKER') {
      const job = resolveJob(entities.jobIdentifier ?? null);
      if (!job) {
        return NextResponse.json({
          type: 'query',
          result: { answer: 'Could not identify which job. Specify customer or address.' },
        });
      }
      scenario = {
        type: intent === 'SWAP_TRUCK' ? 'SWAP_TRUCK' : 'SWAP_DRIVER',
        affectedJobId: job.id,
      };
    } else if (intent === 'RESCHEDULE') {
      const job = resolveJob(entities.jobIdentifier ?? null);
      if (!job) {
        return NextResponse.json({
          type: 'query',
          result: { answer: 'Could not identify which job to reschedule.' },
        });
      }
      scenario = {
        type: 'RESCHEDULE',
        affectedJobId: job.id,
        newDate: entities.date ?? undefined,
        newTime: entities.time ?? undefined,
      };
    } else {
      return NextResponse.json({
        type: 'query',
        result: { answer: parsed.suggestedAction || 'Scenario not supported.' },
      });
    }

    const todayJobs = jobs.map((j) => ({
      id: j.id,
      customer: j.customer,
      address: j.address,
      borough: j.borough,
      time: j.time,
      type: j.type,
      status: j.status,
      truckId: j.truckId,
      truckName: j.truck?.name ?? null,
      driverId: j.driverId,
      driverName: j.driver?.name ?? null,
      workerIds: j.workers.map((w) => w.workerId),
      workerNames: j.workers.map((w) => w.worker.name),
    }));
    const truckJobCount = new Map<string, number>();
    jobs.forEach((j) => {
      if (j.truckId) truckJobCount.set(j.truckId, (truckJobCount.get(j.truckId) ?? 0) + 1);
    });
    const workerJobCount = new Map<string, number>();
    jobs.forEach((j) => {
      if (j.driverId) workerJobCount.set(j.driverId, (workerJobCount.get(j.driverId) ?? 0) + 1);
      j.workers.forEach((w) =>
        workerJobCount.set(w.workerId, (workerJobCount.get(w.workerId) ?? 0) + 1)
      );
    });
    const byTruck = new Map<string, typeof jobs>();
    jobs.forEach((j) => {
      if (!j.truckId) return;
      const list = byTruck.get(j.truckId) ?? [];
      list.push(j);
      byTruck.set(j.truckId, list);
    });
    const truckRoutes = Array.from(byTruck.entries()).map(([truckId, truckJobs]) => {
      const truck = truckJobs[0].truck!;
      return {
        truckId,
        truckName: truck.name,
        stops: truckJobs.map((j, idx) => ({
          jobId: j.id,
          customer: j.customer,
          address: j.address,
          borough: j.borough,
          time: j.time,
          type: j.type,
          status: j.status,
          sequence: idx,
        })),
      };
    });

    const result: ScenarioResult = await analyzeScenario({
      scenario,
      todayJobs,
      trucks: trucks.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        currentLocation: t.currentLocation,
        todayJobCount: truckJobCount.get(t.id) ?? 0,
      })),
      workers: workers.map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        status: w.status,
        certifications: w.certifications,
        todayJobCount: workerJobCount.get(w.id) ?? 0,
      })),
      truckRoutes,
    });

    return NextResponse.json({ type: 'scenario', result });
  }

  // ── DIRECT UPDATE: mark complete, add note, update status ──
  if (intent === 'MARK_COMPLETE' || intent === 'ADD_NOTE') {
    const job = resolveJob(entities.jobIdentifier ?? null);
    if (!job) {
      return NextResponse.json({
        type: 'query',
        result: { answer: 'Could not find that job to update.' },
      });
    }
    if (intent === 'MARK_COMPLETE') {
      await db.cartingJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      });
      return NextResponse.json({
        type: 'update',
        result: { success: true, message: `Marked ${job.customer} as completed.` },
      });
    }
    if (intent === 'ADD_NOTE') {
      const note = (entities.note as string)?.trim() || '';
      const existing = (job.notes ?? '').trim();
      const newNotes = existing ? `${existing}\n${note}` : note;
      await db.cartingJob.update({
        where: { id: job.id },
        data: { notes: newNotes || null },
      });
      return NextResponse.json({
        type: 'update',
        result: { success: true, message: 'Note added.' },
      });
    }
  }

  // ── QUERY: answer from schedule ──
  const answer =
    parsed.suggestedAction ||
    (jobs.length === 0
      ? 'No jobs scheduled for this date.'
      : `There are ${jobs.length} jobs today. ${scheduleContext.slice(0, 300)}...`);
  return NextResponse.json({ type: 'query', result: { answer } });
}
