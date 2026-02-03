import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/search?q=query — search across jobs, workers, trucks, projects
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ data: [] });

  const results: any[] = [];

  // Jobs — search customer, address
  const jobs = await db.cartingJob.findMany({
    where: {
      OR: [
        { customer: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 5,
    select: { id: true, customer: true, address: true, type: true, date: true },
  });
  for (const j of jobs) {
    results.push({ type: 'job', id: j.id, label: j.customer, sublabel: `${j.type} — ${j.address}` });
  }

  // Workers — search name
  const workers = await db.worker.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    take: 5,
    select: { id: true, name: true, role: true, status: true },
  });
  for (const w of workers) {
    results.push({ type: 'worker', id: w.id, label: w.name, sublabel: `${w.role} — ${w.status}` });
  }

  // Trucks — search name, VIN
  const trucks = await db.truck.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { vin: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 5,
    select: { id: true, name: true, type: true, status: true },
  });
  for (const t of trucks) {
    results.push({ type: 'truck', id: t.id, label: t.name, sublabel: `${t.type} — ${t.status}` });
  }

  // Projects — search name, customer
  const projects = await db.demoProject.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { customer: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 5,
    select: { id: true, name: true, customer: true, phase: true },
  });
  for (const p of projects) {
    results.push({ type: 'project', id: p.id, label: p.name, sublabel: `${p.customer} — ${p.phase}` });
  }

  return NextResponse.json({ data: results });
}
