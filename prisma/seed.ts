// DispatchHub — Database Seed
// Run: pnpm db:seed
// Seeds all 18 trucks, 16 workers, sample jobs, projects, routes, and intake items

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

// EDCC yard — depot for all routes
const DEPOT_ADDRESS = '31-10 Harper St, Flushing, NY';
const DEPOT_COORDS = [-73.8332, 40.7678] as [number, number];

// Today at noon local to avoid timezone edge cases when comparing dates
function todayNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function todayIso(): string {
  return todayNoon().toISOString().slice(0, 10);
}

async function main() {
  const today = todayNoon();
  const todayISO = today.toISOString().slice(0, 10);
  console.log('🌱 Seeding DispatchHub database...');
  console.log(`   Demo date: ${todayISO}`);

  // ── CLEAR ─────────────────────────────────────────────────
  await db.routeStop.deleteMany();
  await db.route.deleteMany();
  await db.confirmation.deleteMany();
  await db.changeLog.deleteMany();
  await db.projectChat.deleteMany();
  await db.projectWorker.deleteMany();
  await db.projectTruck.deleteMany();
  await db.jobWorker.deleteMany();
  await db.jobHistory.deleteMany();
  await db.cartingJob.deleteMany();
  await db.intakeItem.deleteMany();
  await db.demoProject.deleteMany();
  await db.clockEntry.deleteMany();
  await db.worker.deleteMany();
  await db.truck.deleteMany();
  await db.integrationConfig.deleteMany();

  // ── TRUCKS (18 total, from IntelliShift screenshot) ───────
  const truckData = [
    { name: 'Box Truck 5', type: 'BOX_TRUCK' as const, year: '2016', make: 'Hino', model: 'XJC720', vin: 'JHHRDM2H0GK002669', status: 'EN_ROUTE' as const, currentLocation: 'Brooklyn' },
    { name: 'Box Truck 6', type: 'BOX_TRUCK' as const, year: '2024', make: 'Isuzu', model: 'NRR', vin: '54DE5J1D5RSR00839', status: 'AVAILABLE' as const, currentLocation: 'Yard' },
    { name: 'Container 08', type: 'CONTAINER' as const, status: 'ON_SITE' as const, currentLocation: 'Manhattan' },
    { name: 'Container 13', type: 'CONTAINER' as const, year: '2018', make: 'Peterbilt', model: '337', vin: '2np2hj7x8jm493059', status: 'EN_ROUTE' as const, currentLocation: 'Queens' },
    { name: 'Container 23', type: 'CONTAINER' as const, year: '2023', make: 'Isuzu', model: 'FVR', vin: '54DM6S1F9PSB51754', status: 'AVAILABLE' as const, currentLocation: 'Yard' },
    { name: 'Packer 07', type: 'PACKER' as const, vin: 'I1M2AX04CX8M002715', status: 'EN_ROUTE' as const, currentLocation: 'Bronx' },
    { name: 'Packer 09', type: 'PACKER' as const, vin: 'I1M2AX04C18M003056', status: 'MAINTENANCE' as const, currentLocation: 'Shop' },
    { name: 'Packer 11', type: 'PACKER' as const, year: '2013', make: 'Mack', model: 'GU700', vin: '1M2AX04C9DM015045', status: 'ON_SITE' as const, currentLocation: 'Manhattan' },
    { name: 'Packer 12', type: 'PACKER' as const, year: '2017', make: 'Mack', model: 'GU713', vin: '4M2AX04C0HM035061', status: 'AVAILABLE' as const, currentLocation: 'Yard' },
    { name: 'Packer 15', type: 'PACKER' as const, year: '2018', make: 'Mack', model: 'GU713', vin: '1M2AX04C5JM040522', status: 'EN_ROUTE' as const, currentLocation: 'Brooklyn' },
    { name: 'Packer 20', type: 'PACKER' as const, year: '2020', make: 'Mack', model: 'Granite', vin: '1m2gr2gc0lm013128', status: 'AVAILABLE' as const, currentLocation: 'Yard' },
    { name: 'Packer 24', type: 'PACKER' as const, year: '2019', make: 'Kenworth', model: 'T880', vin: '1NKZL4EX9KJ226402', status: 'ON_SITE' as const, currentLocation: 'Queens' },
    { name: 'Roll Off 10', type: 'ROLL_OFF' as const, year: '2016', make: 'Kenworth', model: 'T880', vin: '1NKZXPTX6GJ472159', status: 'EN_ROUTE' as const, currentLocation: 'Staten Island' },
    { name: 'Service Truck', type: 'SERVICE' as const, year: '2022', make: 'Ford', model: 'F-350 SD', vin: '1FDRF3F67NEE25630', status: 'AVAILABLE' as const, currentLocation: 'Yard' },
    { name: 'Van 1', type: 'VAN' as const, status: 'EN_ROUTE' as const, currentLocation: 'Manhattan' },
    { name: 'Van 2', type: 'VAN' as const, status: 'AVAILABLE' as const, currentLocation: 'Yard' },
    { name: 'Van 3', type: 'VAN' as const, status: 'ON_SITE' as const, currentLocation: 'Brooklyn' },
    { name: 'Van 4', type: 'VAN' as const, status: 'AVAILABLE' as const, currentLocation: 'Yard' },
  ];

  const trucks: Record<string, any> = {};
  for (const t of truckData) {
    trucks[t.name] = await db.truck.create({ data: t });
  }
  console.log(`  ✅ ${truckData.length} trucks`);

  // ── WORKERS (16 total) ────────────────────────────────────
  const workerData = [
    { name: 'Tony Russo', role: 'DRIVER' as const, status: 'EN_ROUTE' as const, phone: '718-555-0101', email: 'tony.r@edcc.co', certifications: ['CDL-A', 'OSHA-30'], hireDate: new Date('2019-03-15'), currentAssignment: 'Box Truck 5 — Brooklyn runs' },
    { name: 'Marco Delgado', role: 'DRIVER' as const, status: 'EN_ROUTE' as const, phone: '718-555-0102', email: 'marco.d@edcc.co', certifications: ['CDL-A', 'CDL-B', 'Hazmat'], hireDate: new Date('2018-06-01'), currentAssignment: 'Roll Off 10 — Staten Island' },
    { name: 'Ray Jimenez', role: 'DRIVER' as const, status: 'EN_ROUTE' as const, phone: '718-555-0103', email: 'ray.j@edcc.co', certifications: ['CDL-B'], hireDate: new Date('2021-01-10'), currentAssignment: 'Container 13 — Queens' },
    { name: 'Mikey Munda', role: 'FOREMAN' as const, status: 'OUT_SICK' as const, phone: '718-555-0104', email: 'mikey.m@edcc.co', certifications: ['OSHA-30', 'Asbestos Handler', 'Foreman Cert'], hireDate: new Date('2017-09-20'), performanceNotes: 'Strong leader. Called out sick 2/2.' },
    { name: 'Carlos Vega', role: 'DRIVER' as const, status: 'EN_ROUTE' as const, phone: '718-555-0105', email: 'carlos.v@edcc.co', certifications: ['CDL-A', 'OSHA-10'], hireDate: new Date('2020-04-12'), currentAssignment: 'Packer 07 — Bronx route' },
    { name: 'Pete Nowak', role: 'DRIVER' as const, status: 'ON_SITE' as const, phone: '718-555-0106', email: 'pete.n@edcc.co', certifications: ['CDL-A', 'CDL-B'], hireDate: new Date('2019-11-01'), currentAssignment: 'Packer 11 — Manhattan' },
    { name: 'David Chen', role: 'OPERATOR' as const, status: 'AVAILABLE' as const, phone: '718-555-0107', email: 'david.c@edcc.co', certifications: ['Excavator', 'Bobcat', 'OSHA-30'], hireDate: new Date('2020-08-15') },
    { name: "James O'Brien", role: 'DRIVER' as const, status: 'EN_ROUTE' as const, phone: '718-555-0108', email: 'james.o@edcc.co', certifications: ['CDL-A'], hireDate: new Date('2022-02-20'), currentAssignment: 'Packer 15 — Brooklyn' },
    { name: 'Luis Reyes', role: 'LABORER' as const, status: 'AVAILABLE' as const, phone: '718-555-0109', email: 'luis.r@edcc.co', certifications: ['OSHA-10', 'Flagging'], hireDate: new Date('2023-01-05') },
    { name: 'Andre Williams', role: 'DRIVER' as const, status: 'ON_SITE' as const, phone: '718-555-0110', email: 'andre.w@edcc.co', certifications: ['CDL-B', 'OSHA-10'], hireDate: new Date('2021-07-14'), currentAssignment: 'Packer 24 — Queens' },
    { name: 'Nick Papadopoulos', role: 'FOREMAN' as const, status: 'AVAILABLE' as const, phone: '718-555-0111', email: 'nick.p@edcc.co', certifications: ['OSHA-30', 'Foreman Cert', 'CDL-B'], hireDate: new Date('2016-05-10') },
    { name: 'Sal Marino', role: 'LABORER' as const, status: 'EN_ROUTE' as const, phone: '718-555-0112', email: 'sal.m@edcc.co', certifications: ['OSHA-10'], hireDate: new Date('2023-06-18'), currentAssignment: 'Van 1 — Manhattan pickups' },
    { name: 'Kevin Tran', role: 'OPERATOR' as const, status: 'ON_SITE' as const, phone: '718-555-0113', email: 'kevin.t@edcc.co', certifications: ['Excavator', 'Crane', 'OSHA-30', 'Asbestos Handler'], hireDate: new Date('2018-03-25'), currentAssignment: 'Bloomberg Project' },
    { name: 'Hector Fuentes', role: 'LABORER' as const, status: 'AVAILABLE' as const, phone: '718-555-0114', email: 'hector.f@edcc.co', certifications: ['OSHA-10', 'Asbestos Handler'], hireDate: new Date('2022-09-01') },
    { name: 'Bobby Kowalski', role: 'DRIVER' as const, status: 'OFF_DUTY' as const, phone: '718-555-0115', email: 'bobby.k@edcc.co', certifications: ['CDL-A', 'Hazmat'], hireDate: new Date('2017-12-03') },
    { name: 'Omar Hassan', role: 'LABORER' as const, status: 'VACATION' as const, phone: '718-555-0116', email: 'omar.h@edcc.co', certifications: ['OSHA-10'], hireDate: new Date('2024-01-15') },
  ];

  const workers: Record<string, any> = {};
  for (const w of workerData) {
    workers[w.name] = await db.worker.create({ data: w });
  }
  console.log(`  ✅ ${workerData.length} workers`);

  // ── PROJECTS ──────────────────────────────────────────────
  const pStart = new Date(today);
  pStart.setDate(pStart.getDate() - 14);
  const pEnd = new Date(today);
  pEnd.setDate(pEnd.getDate() + 45);

  const bloomberg = await db.demoProject.create({
    data: {
      name: 'Bloomberg Tower Demo', customer: 'Metro Demo Group',
      address: '138 W 138th St, Manhattan', borough: 'MANHATTAN',
      phase: 'ACTIVE_DEMO', startDate: pStart, endDate: pEnd,
      cartingNeeds: '3x 30yd containers, daily dump-outs, asbestos abatement hauling',
      notes: 'High-profile project. Asbestos found on floors 4-6. Extended timeline.',
    },
  });

  const apex = await db.demoProject.create({
    data: {
      name: 'Apex Bronx Teardown', customer: 'Apex Construction Corp',
      address: '2100 Bronx Park East, Bronx', borough: 'BRONX',
      phase: 'CARTING', startDate: pStart, endDate: new Date(today.getTime() + 21 * 86400000),
      cartingNeeds: '2x 40yd roll-off, debris hauling 3x/week',
      notes: 'Structural demo complete. Carting phase — heavy debris removal.',
    },
  });

  const wburg = await db.demoProject.create({
    data: {
      name: 'Williamsburg Gut Reno', customer: 'BK Construction LLC',
      address: '120 N 6th St, Brooklyn', borough: 'BROOKLYN',
      phase: 'PLANNING', startDate: new Date(today.getTime() + 7 * 86400000), endDate: new Date(today.getTime() + 60 * 86400000),
      cartingNeeds: '1x 20yd container on-site, weekly swap',
      notes: 'Pending permits. Start date may shift.',
    },
  });

  // Project assignments
  await db.projectWorker.createMany({ data: [
    { projectId: bloomberg.id, workerId: workers['Mikey Munda'].id },
    { projectId: bloomberg.id, workerId: workers['Kevin Tran'].id },
    { projectId: bloomberg.id, workerId: workers['Hector Fuentes'].id },
    { projectId: bloomberg.id, workerId: workers['Pete Nowak'].id },
    { projectId: apex.id, workerId: workers['Nick Papadopoulos'].id },
    { projectId: apex.id, workerId: workers['Luis Reyes'].id },
    { projectId: apex.id, workerId: workers['Marco Delgado'].id },
  ]});

  await db.projectTruck.createMany({ data: [
    { projectId: bloomberg.id, truckId: trucks['Packer 11'].id },
    { projectId: bloomberg.id, truckId: trucks['Packer 15'].id },
    { projectId: apex.id, truckId: trucks['Roll Off 10'].id },
    { projectId: apex.id, truckId: trucks['Packer 07'].id },
  ]});

  console.log(`  ✅ 3 projects with assignments`);

  // ── JOBS (all dated TODAY at noon local; 2–3 jobs per truck for map variety) ──
  // Boroughs must match address: Manhattan → MANHATTAN, Brooklyn → BROOKLYN, etc.
  const jobsData: Array<{
    type: 'PICKUP' | 'DROP_OFF' | 'DUMP_OUT' | 'SWAP';
    customer: string;
    address: string;
    borough: 'MANHATTAN' | 'BROOKLYN' | 'QUEENS' | 'BRONX' | 'STATEN_ISLAND';
    date: Date;
    time: string;
    truckId?: string;
    driverId?: string;
    source: 'PHONE' | 'EMAIL' | 'FORM';
    priority: 'NORMAL' | 'HIGH' | 'URGENT';
    containerSize?: string;
    notes?: string;
    status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
    projectId?: string;
  }> = [
    // Box Truck 5: 3 stops — Manhattan x2, Brooklyn x1
    { type: 'PICKUP', customer: 'Manhattan Tower Group', address: '450 W 33rd St, Manhattan', borough: 'MANHATTAN', date: today, time: '06:00', truckId: trucks['Box Truck 5'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '30yd', status: 'SCHEDULED', notes: 'Demolition debris pickup — rear entrance' },
    { type: 'SWAP', customer: 'Metro Demo Group', address: '138 W 138th St, Manhattan', borough: 'MANHATTAN', date: today, time: '07:00', truckId: trucks['Box Truck 5'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'HIGH', containerSize: '30yd', status: 'DELAYED', projectId: bloomberg.id, notes: 'Dumpster swap — Bloomberg project' },
    { type: 'PICKUP', customer: 'Harbor View Development', address: '310 Flatbush Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '08:00', truckId: trucks['Box Truck 5'].id, driverId: workers['Tony Russo'].id, source: 'FORM', priority: 'NORMAL', containerSize: '30yd', status: 'DELAYED', notes: 'Scheduled pickup — Prospect Heights' },
    // Container 13: 3 stops — Brooklyn, Queens
    { type: 'DROP_OFF', customer: 'BK Construction LLC', address: '789 Flatbush Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '06:30', truckId: trucks['Container 13'].id, driverId: workers['Ray Jimenez'].id, source: 'EMAIL', priority: 'HIGH', containerSize: '20yd', status: 'SCHEDULED', notes: 'Container delivery' },
    { type: 'DUMP_OUT', customer: 'Queens Boulevard Partners', address: '61-15 Queens Blvd, Woodside, NY', borough: 'QUEENS', date: today, time: '09:00', truckId: trucks['Container 13'].id, driverId: workers['Ray Jimenez'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '30yd', status: 'IN_PROGRESS', notes: 'Demolition project haul — gate code 4455' },
    { type: 'PICKUP', customer: 'Astoria Demo LLC', address: '28-15 Astoria Blvd, Queens', borough: 'QUEENS', date: today, time: '11:00', truckId: trucks['Container 13'].id, driverId: workers['Ray Jimenez'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Astoria pickup' },
    // Roll Off 10: 2 stops — Bronx, Staten Island
    { type: 'DROP_OFF', customer: 'Bronx Hauling Co', address: '2100 Bronx Park East, Bronx', borough: 'BRONX', date: today, time: '10:00', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'FORM', priority: 'URGENT', containerSize: '40yd', status: 'SCHEDULED', projectId: apex.id, notes: 'Roll-off delivery — Apex site' },
    { type: 'PICKUP', customer: 'SI Waste Solutions', address: '300 Father Capodanno Blvd, Staten Island', borough: 'STATEN_ISLAND', date: today, time: '14:00', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '40yd', status: 'SCHEDULED', notes: 'Staten Island roll-off' },
    // Packer 07: 2 stops — Staten Island, Bronx
    { type: 'PICKUP', customer: 'SI Waste Solutions', address: '300 Father Capodanno Blvd, Staten Island', borough: 'STATEN_ISLAND', date: today, time: '11:00', truckId: trucks['Packer 07'].id, driverId: workers['Carlos Vega'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'COMPLETED', notes: 'Bulk waste pickup' },
    { type: 'DROP_OFF', customer: 'Bronx Hauling Co', address: '950 Garrison Ave, Bronx', borough: 'BRONX', date: today, time: '13:00', truckId: trucks['Packer 07'].id, driverId: workers['Carlos Vega'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Garrison Ave drop' },
    // Unassigned
    { type: 'PICKUP', customer: 'Williamsburg Collective', address: '120 N 6th St, Brooklyn', borough: 'BROOKLYN', date: today, time: '12:00', source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', projectId: wburg.id, notes: 'Unassigned — pending intake approval' },
  ];

  const createdJobs: Array<{ id: string; truckId: string | null; time: string }> = [];
  for (const j of jobsData) {
    const job = await db.cartingJob.create({
      data: {
        type: j.type,
        customer: j.customer,
        address: j.address,
        borough: j.borough,
        date: j.date,
        time: j.time,
        truckId: j.truckId ?? null,
        driverId: j.driverId ?? null,
        source: j.source,
        priority: j.priority,
        containerSize: j.containerSize ?? null,
        notes: j.notes ?? null,
        status: j.status ?? 'SCHEDULED',
        projectId: j.projectId ?? null,
      },
    });
    if (job.truckId) createdJobs.push({ id: job.id, truckId: job.truckId, time: j.time });
  }
  console.log(`  ✅ ${jobsData.length} jobs (assigned trucks have 2–3 stops each, 1 unassigned)`);

  // ── ROUTES (for trucks with jobs today) ────────────────────
  const jobsByTruck = new Map<string, typeof createdJobs>();
  for (const j of createdJobs) {
    if (!j.truckId) continue;
    const list = jobsByTruck.get(j.truckId) ?? [];
    list.push(j);
    jobsByTruck.set(j.truckId, list);
  }
  for (const [truckId, truckJobs] of jobsByTruck) {
    truckJobs.sort((a, b) => a.time.localeCompare(b.time));
    const coords = [DEPOT_COORDS];
    const route = await db.route.create({
      data: {
        truckId,
        date: today,
        optimizedPath: {
          type: 'LineString',
          coordinates: coords,
          depot: DEPOT_ADDRESS,
        },
        totalDistance: 12 + truckJobs.length * 4,
        totalDuration: 60 + truckJobs.length * 45,
      },
    });
    for (let i = 0; i < truckJobs.length; i++) {
      const eta = new Date(today);
      const [h, m] = truckJobs[i].time.split(':').map(Number);
      eta.setHours(h, m, 0, 0);
      await db.routeStop.create({
        data: {
          routeId: route.id,
          jobId: truckJobs[i].id,
          sequence: i + 1,
          eta,
        },
      });
    }
  }
  console.log(`  ✅ Routes with stops for ${jobsByTruck.size} trucks`);

  // ── INTAKE ITEMS ──────────────────────────────────────────
  const todayStr = todayISO;
  await db.intakeItem.createMany({ data: [
    {
      source: 'PHONE', rawContent: 'Hi, this is Maria from Manhattan Tower Group. We need a 30-yard container picked up from 450 West 33rd Street tomorrow morning, preferably before 8am.',
      audioUrl: '#', confidence: 95, status: 'PENDING',
      parsedCustomer: 'Manhattan Tower Group', parsedPhone: '212-555-0198', parsedServiceType: 'PICKUP', parsedAddress: '450 W 33rd St, Manhattan', parsedDate: todayStr, parsedTime: '07:00', parsedContainerSize: '30yd', parsedNotes: 'Rear parking area, before 8am',
    },
    {
      source: 'EMAIL', rawContent: 'Subject: Container Drop-off Request\nWe need a 20-yard dumpster dropped off at 789 Flatbush Ave, Brooklyn.',
      confidence: 88, status: 'NEEDS_REVIEW',
      parsedCustomer: 'BK Construction LLC', parsedPhone: '347-555-0234', parsedEmail: 'james@bkdev.com', parsedServiceType: 'DROP_OFF', parsedAddress: '789 Flatbush Ave, Brooklyn', parsedDate: todayStr, parsedContainerSize: '20yd',
    },
    {
      source: 'PHONE', rawContent: 'Yeah uh... we got a situation at the Grand Concourse site... need to swap out the container...',
      audioUrl: '#', confidence: 62, status: 'FLAGGED',
      parsedCustomer: 'Bronx Hauling Co', parsedPhone: '718-555-0444', parsedServiceType: 'SWAP', parsedAddress: 'Grand Concourse, Bronx', parsedContainerSize: '40yd', parsedNotes: 'Container full, caller unclear on details',
    },
  ]});
  console.log(`  ✅ 3 intake items`);

  // ── INTEGRATION CONFIGS ───────────────────────────────────
  await db.integrationConfig.createMany({ data: [
    { name: 'intellishift', config: {}, status: 'connected' },
    { name: 'twilio', config: {}, status: 'connected' },
    { name: 'outlook', config: {}, status: 'connected' },
    { name: 'ralco', config: {}, status: 'pending' },
  ]});
  console.log(`  ✅ 4 integration configs`);

  console.log('\n🎉 Seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
