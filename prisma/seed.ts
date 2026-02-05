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
  await db.dumpSite.deleteMany();

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

  // ── JOBS ───────────────────────────────────────────────────
  // 6 trucks × 10 stops = 60 routed + 1 Tony overlap + 1 unassigned = 62 total
  const jobsData: Array<{
    type: 'PICKUP' | 'DROP_OFF' | 'DUMP_OUT';
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
    // ── Packer 07 — Tony Russo — Bronx route (10 DUMP_OUT) ──
    { type: 'DUMP_OUT', customer: 'Pelham Bay Construction', address: '1800 Pelham Pkwy S, Bronx', borough: 'BRONX', date: today, time: '06:00', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'COMPLETED', notes: '20yd mini — 3rd floor demo debris' },
    { type: 'DUMP_OUT', customer: 'Morris Park Partners', address: '900 Morris Park Ave, Bronx', borough: 'BRONX', date: today, time: '06:35', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'COMPLETED', notes: 'Gate code 4455' },
    { type: 'DUMP_OUT', customer: 'Parkchester Dev', address: '1800 Eastchester Rd, Bronx', borough: 'BRONX', date: today, time: '07:15', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'IN_PROGRESS', notes: 'Container behind building C' },
    { type: 'DUMP_OUT', customer: 'Bronx River Partners', address: '1600 Bronx River Ave, Bronx', borough: 'BRONX', date: today, time: '08:00', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Ask for site super Mike' },
    { type: 'DUMP_OUT', customer: 'Soundview Industrial', address: '1100 Metcalf Ave, Bronx', borough: 'BRONX', date: today, time: '08:45', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Metcalf Ave — gate 7788' },
    { type: 'DUMP_OUT', customer: 'Throggs Neck LLC', address: '3200 E Tremont Ave, Bronx', borough: 'BRONX', date: today, time: '09:30', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'HIGH', containerSize: '20yd', status: 'SCHEDULED', notes: 'Concrete debris — alley access' },
    { type: 'DUMP_OUT', customer: 'Castle Hill Partners', address: '2100 Bruckner Blvd, Bronx', borough: 'BRONX', date: today, time: '10:15', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Bruckner — loading dock' },
    { type: 'DUMP_OUT', customer: 'Hunts Point Terminal', address: '950 Garrison Ave, Bronx', borough: 'BRONX', date: today, time: '11:00', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Market district — badge required' },
    { type: 'DUMP_OUT', customer: 'Port Morris Industrial', address: '800 E 132nd St, Bronx', borough: 'BRONX', date: today, time: '11:45', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Heavy debris — call ahead' },
    { type: 'DUMP_OUT', customer: 'Mott Haven Dev', address: '400 E 150th St, Bronx', borough: 'BRONX', date: today, time: '14:30', truckId: trucks['Packer 07'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Structural demo — last stop' },

    // ── Packer 11 — Pete Nowak — Manhattan route (10 DUMP_OUT, 2-3 Bloomberg) — PROJECT LOCK ──
    { type: 'DUMP_OUT', customer: 'Metro Demo Group', address: '138 W 138th St, Manhattan', borough: 'MANHATTAN', date: today, time: '06:30', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'PHONE', priority: 'HIGH', containerSize: '20yd', status: 'IN_PROGRESS', projectId: bloomberg.id, notes: '20yd mini — Bloomberg Tower demo debris' },
    { type: 'DUMP_OUT', customer: 'Metro Demo Group', address: '520 W 28th St, Manhattan', borough: 'MANHATTAN', date: today, time: '07:15', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'PHONE', priority: 'HIGH', containerSize: '20yd', status: 'SCHEDULED', projectId: bloomberg.id, notes: 'Bloomberg — Chelsea staging area' },
    { type: 'DUMP_OUT', customer: 'Hamilton Heights Dev', address: '500 W 143rd St, Manhattan', borough: 'MANHATTAN', date: today, time: '08:00', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', projectId: bloomberg.id, notes: 'Upper Manhattan — Bloomberg overflow' },
    { type: 'DUMP_OUT', customer: 'East Harlem Partners', address: '240 E 123rd St, Manhattan', borough: 'MANHATTAN', date: today, time: '08:45', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Debris haul — alley access' },
    { type: 'DUMP_OUT', customer: 'Midtown East Corp', address: '155 E 44th St, Manhattan', borough: 'MANHATTAN', date: today, time: '09:30', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'EMAIL', priority: 'HIGH', containerSize: '20yd', status: 'SCHEDULED', notes: 'Office reno — freight elevator only' },
    { type: 'DUMP_OUT', customer: 'NoHo Development', address: '770 Broadway, Manhattan', borough: 'MANHATTAN', date: today, time: '10:15', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Broadway entrance — 7am-5pm dock hours' },
    { type: 'DUMP_OUT', customer: 'Chelsea Market LLC', address: '601 W 26th St, Manhattan', borough: 'MANHATTAN', date: today, time: '11:00', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Chelsea — call super on arrival' },
    { type: 'DUMP_OUT', customer: 'Hell\'s Kitchen LLC', address: '315 W 57th St, Manhattan', borough: 'MANHATTAN', date: today, time: '11:45', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Contact Maria ext 22' },
    { type: 'DUMP_OUT', customer: 'Flatiron District Co', address: '44 W 18th St, Manhattan', borough: 'MANHATTAN', date: today, time: '12:30', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: '5th floor demo debris' },
    { type: 'DUMP_OUT', customer: 'Hudson Yards Dev', address: '450 W 33rd St, Manhattan', borough: 'MANHATTAN', date: today, time: '15:00', truckId: trucks['Packer 11'].id, driverId: workers['Pete Nowak'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Hudson Yards — last stop' },

    // ── Packer 12 — Carlos Vega — Brooklyn route (10 DUMP_OUT) ──
    { type: 'DUMP_OUT', customer: 'BK Construction LLC', address: '789 Flatbush Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '06:15', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'COMPLETED', notes: 'Prospect-Lefferts — gate 4455' },
    { type: 'DUMP_OUT', customer: 'Prospect Heights Dev', address: '310 Flatbush Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '06:50', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'IN_PROGRESS', notes: 'Loading zone in rear' },
    { type: 'DUMP_OUT', customer: 'Vanderbilt Partners', address: '470 Vanderbilt Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '07:30', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Prospect Heights — gate code 2211' },
    // Tony overlap conflict: Packer 12 job at 8:00 AM with Tony Russo (he's on Packer 07 at 8:00 AM too)
    { type: 'DUMP_OUT', customer: 'Vanderbilt Ave Overflow', address: '470 Vanderbilt Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '08:00', truckId: trucks['Packer 12'].id, driverId: workers['Tony Russo'].id, source: 'PHONE', priority: 'URGENT', containerSize: '20yd', status: 'SCHEDULED', notes: 'Wrong driver assigned — Tony double-booked' },
    { type: 'DUMP_OUT', customer: 'Atlantic Center Dev', address: '625 Atlantic Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '08:20', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Atlantic Terminal — loading dock' },
    { type: 'DUMP_OUT', customer: 'MetroTech Center', address: '1 MetroTech Center, Brooklyn', borough: 'BROOKLYN', date: today, time: '08:45', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Downtown BK — dock C, badge required' },
    { type: 'DUMP_OUT', customer: 'Gowanus Industrial', address: '850 3rd Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '09:30', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Gowanus — concrete debris' },
    { type: 'DUMP_OUT', customer: 'Kent Ave LLC', address: '275 Kent Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '10:15', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Williamsburg waterfront' },
    { type: 'DUMP_OUT', customer: 'East Williamsburg Dev', address: '500 Stagg St, Brooklyn', borough: 'BROOKLYN', date: today, time: '11:00', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Industrial lot — chain link gate' },
    { type: 'DUMP_OUT', customer: 'Greenpoint Partners', address: '1155 Manhattan Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '11:45', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Greenpoint — contact Luis' },
    { type: 'DUMP_OUT', customer: 'Red Hook Marine', address: '100 Pioneer St, Brooklyn', borough: 'BROOKLYN', date: today, time: '15:00', truckId: trucks['Packer 12'].id, driverId: workers['Carlos Vega'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Red Hook — waterfront access' },

    // ── Packer 15 — James O'Brien — Queens route (10 DUMP_OUT) ──
    { type: 'DUMP_OUT', customer: 'Woodside Partners', address: '61-15 Queens Blvd, Queens', borough: 'QUEENS', date: today, time: '06:00', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'COMPLETED', notes: 'Queens Blvd — Woodside' },
    { type: 'DUMP_OUT', customer: 'Astoria Demo LLC', address: '28-15 Astoria Blvd, Queens', borough: 'QUEENS', date: today, time: '06:40', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'IN_PROGRESS', notes: 'Astoria — gate 5566' },
    { type: 'DUMP_OUT', customer: 'LIC Industrial', address: '37-18 Northern Blvd, Queens', borough: 'QUEENS', date: today, time: '07:25', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'DELAYED', notes: 'LIC — delayed, traffic on BQE' },
    { type: 'DUMP_OUT', customer: 'Maspeth Waste Co', address: '55-15 Grand Ave, Queens', borough: 'QUEENS', date: today, time: '08:15', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Maspeth — ask for site super' },
    { type: 'DUMP_OUT', customer: 'Rego Park Construction', address: '91-31 Queens Blvd, Queens', borough: 'QUEENS', date: today, time: '09:00', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Rego Park — commercial' },
    { type: 'DUMP_OUT', customer: 'Corona Partners', address: '108-50 Roosevelt Ave, Queens', borough: 'QUEENS', date: today, time: '09:45', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Roosevelt Ave — Flushing area' },
    { type: 'DUMP_OUT', customer: 'Crescent St Dev', address: '42-15 Crescent St, Queens', borough: 'QUEENS', date: today, time: '10:30', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'LIC — Crescent St' },
    { type: 'DUMP_OUT', customer: 'Flushing Partners', address: '135-20 39th Ave, Queens', borough: 'QUEENS', date: today, time: '11:15', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Flushing — Main St area' },
    { type: 'DUMP_OUT', customer: 'Jamaica Industrial', address: '148-25 Archer Ave, Queens', borough: 'QUEENS', date: today, time: '12:00', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Jamaica — gate 3344' },
    { type: 'DUMP_OUT', customer: 'Ozone Park Dev', address: '101-20 Rockaway Blvd, Queens', borough: 'QUEENS', date: today, time: '15:00', truckId: trucks['Packer 15'].id, driverId: workers["James O'Brien"].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Ozone Park — last stop' },

    // ── Packer 20 — Nick Papadopoulos — Manhattan/Bronx mixed (10 DUMP_OUT) ──
    { type: 'DUMP_OUT', customer: 'Union Square Partners', address: '100 E 17th St, Manhattan', borough: 'MANHATTAN', date: today, time: '06:30', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'COMPLETED', notes: 'Union Square — alley access' },
    { type: 'DUMP_OUT', customer: 'Gramercy Dev', address: '200 Park Ave S, Manhattan', borough: 'MANHATTAN', date: today, time: '07:15', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'IN_PROGRESS', notes: 'Park Ave S — loading dock' },
    { type: 'DUMP_OUT', customer: 'Kips Bay Corp', address: '350 E 26th St, Manhattan', borough: 'MANHATTAN', date: today, time: '08:00', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Kips Bay — gate code 2233' },
    { type: 'DUMP_OUT', customer: 'Turtle Bay LLC', address: '420 E 42nd St, Manhattan', borough: 'MANHATTAN', date: today, time: '08:45', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'UN Plaza area' },
    { type: 'DUMP_OUT', customer: 'Co-op City Construction', address: '1400 Baychester Ave, Bronx', borough: 'BRONX', date: today, time: '10:00', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Baychester — Bronx leg' },
    { type: 'DUMP_OUT', customer: 'Allerton Partners', address: '750 Allerton Ave, Bronx', borough: 'BRONX', date: today, time: '10:45', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Allerton — gate 5566' },
    { type: 'DUMP_OUT', customer: 'Fordham Dev', address: '2500 Webster Ave, Bronx', borough: 'BRONX', date: today, time: '11:30', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'FORM', priority: 'HIGH', containerSize: '20yd', status: 'SCHEDULED', notes: 'Fordham — ask for super' },
    { type: 'DUMP_OUT', customer: 'University Heights LLC', address: '200 W Burnside Ave, Bronx', borough: 'BRONX', date: today, time: '12:15', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'University Heights' },
    { type: 'DUMP_OUT', customer: 'Highbridge Partners', address: '1410 Ogden Ave, Bronx', borough: 'BRONX', date: today, time: '13:00', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Ogden Ave — Highbridge' },
    { type: 'DUMP_OUT', customer: 'Concourse Village', address: '750 Grand Concourse, Bronx', borough: 'BRONX', date: today, time: '15:30', truckId: trucks['Packer 20'].id, driverId: workers['Nick Papadopoulos'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Grand Concourse — last stop' },

    // ── Roll Off 10 — Marco Delgado — All boroughs (10 DROP_OFF/PICKUP mix) ──
    { type: 'DROP_OFF', customer: 'Apex Construction Corp', address: '2100 Bronx Park East, Bronx', borough: 'BRONX', date: today, time: '06:30', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'FORM', priority: 'URGENT', containerSize: '40yd', status: 'COMPLETED', projectId: apex.id, notes: 'Full container — ready for swap. Apex teardown.' },
    { type: 'PICKUP', customer: 'Apex Construction Corp', address: '2100 Bronx Park East, Bronx', borough: 'BRONX', date: today, time: '07:30', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '40yd', status: 'IN_PROGRESS', projectId: apex.id, notes: 'Delivering empty 40yd. Apex teardown container moves.' },
    { type: 'DROP_OFF', customer: 'Port Morris Industrial', address: '800 E 132nd St, Bronx', borough: 'BRONX', date: today, time: '08:30', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '30yd', status: 'SCHEDULED', notes: 'Hunts Point — roll-off delivery' },
    { type: 'PICKUP', customer: 'Hunts Point Terminal', address: '950 Garrison Ave, Bronx', borough: 'BRONX', date: today, time: '09:30', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '40yd', status: 'SCHEDULED', notes: 'Market district — full container pickup' },
    { type: 'DROP_OFF', customer: 'LIC Industrial', address: '37-18 Northern Blvd, Queens', borough: 'QUEENS', date: today, time: '10:45', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'FORM', priority: 'NORMAL', containerSize: '30yd', status: 'SCHEDULED', notes: 'Long Island City — empty delivery' },
    { type: 'PICKUP', customer: 'Queens Blvd Partners', address: '61-15 Queens Blvd, Queens', borough: 'QUEENS', date: today, time: '11:45', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '40yd', status: 'SCHEDULED', notes: 'Woodside — commercial demo, full container' },
    { type: 'DROP_OFF', customer: 'Gowanus Industrial', address: '850 3rd Ave, Brooklyn', borough: 'BROOKLYN', date: today, time: '13:00', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'EMAIL', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Gowanus — empty 20yd delivery' },
    { type: 'PICKUP', customer: 'Red Hook Marine', address: '100 Pioneer St, Brooklyn', borough: 'BROOKLYN', date: today, time: '14:00', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '30yd', status: 'SCHEDULED', notes: 'Red Hook — full container ready' },
    { type: 'DROP_OFF', customer: 'St George Terminal', address: '1 Bay St, Staten Island', borough: 'STATEN_ISLAND', date: today, time: '15:15', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'FORM', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', notes: 'Staten Island — ferry area' },
    { type: 'PICKUP', customer: 'Maspeth Waste Co', address: '55-15 Grand Ave, Queens', borough: 'QUEENS', date: today, time: '16:00', truckId: trucks['Roll Off 10'].id, driverId: workers['Marco Delgado'].id, source: 'PHONE', priority: 'NORMAL', containerSize: '40yd', status: 'SCHEDULED', notes: 'Maspeth — last stop, roll-off swap' },

    // ── Unassigned (Williamsburg project) ──
    { type: 'DUMP_OUT', customer: 'BK Construction LLC', address: '120 N 6th St, Brooklyn', borough: 'BROOKLYN', date: today, time: '12:00', source: 'PHONE', priority: 'NORMAL', containerSize: '20yd', status: 'SCHEDULED', projectId: wburg.id, notes: 'Williamsburg gut reno — unassigned, needs truck/driver' },
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
  console.log(`  ✅ ${jobsData.length} jobs (60 routed + 1 Tony overlap + 1 unassigned = 62 total)`);

  // ── DUMP SITES ─────────────────────────────────────────────
  const dumpSitesData = [
    { name: 'New Style Recycling', address: '49-10 Grand Ave, Maspeth, NY 11378', borough: 'QUEENS' as const, lat: 40.7214, lng: -73.8985, type: 'KEY' as const, phone: '718-326-4175', hours: 'Mon-Fri 6AM-5PM, Sat 6AM-1PM', accepts: ['C&D', 'Demo Debris', 'Concrete', 'Metal', 'Wood', 'Brick'], notes: 'Primary EDCC dump. Family-owned MWBE. Off LIE Exit 19.' },
    { name: 'Waste Management', address: '38-50 Review Ave, LIC, NY 11101', borough: 'QUEENS' as const, lat: 40.7276, lng: -73.9245, type: 'KEY' as const, phone: '718-786-2300', hours: 'Mon-Fri 5AM-8PM, Sat 5AM-4PM', accepts: ['C&D', 'MSW', 'Demo Debris', 'Bulk Waste'], notes: 'High-volume facility near Kosciuszko Bridge. Long wait times after 2PM.' },
    { name: 'American Recycling Mgmt', address: '55-15 Grand Ave, Maspeth, NY 11378', borough: 'QUEENS' as const, lat: 40.7195, lng: -73.9028, type: 'KEY' as const, phone: '718-326-7900', hours: 'Mon-Fri 6AM-6PM, Sat 6AM-2PM', accepts: ['C&D', 'Demo Debris', 'Organic', 'Metal', 'Concrete'], notes: 'Backup dump. Good for mixed loads. Roll-off swaps available.' },
    { name: 'Hamilton Ave Marine Transfer Station', address: '20 Hamilton Ave, Brooklyn, NY 11231', borough: 'BROOKLYN' as const, lat: 40.6783, lng: -73.9988, type: 'GENERAL' as const, hours: 'Mon-Sat 6AM-4PM', accepts: ['MSW', 'Bulk Waste'], notes: 'DSNY marine transfer station' },
    { name: 'East 91st St Marine Transfer Station', address: '524 E 91st St, Manhattan, NY 10128', borough: 'MANHATTAN' as const, lat: 40.7803, lng: -73.9437, type: 'GENERAL' as const, hours: 'Mon-Sat 6AM-4PM', accepts: ['MSW', 'Bulk Waste'], notes: 'DSNY marine transfer station' },
    { name: 'Tully Environmental', address: '127-20 34th Ave, Flushing, NY 11368', borough: 'QUEENS' as const, lat: 40.7612, lng: -73.8347, type: 'GENERAL' as const, hours: 'Mon-Fri 6AM-6PM', accepts: ['C&D', 'Demo Debris', 'Fill'], notes: 'Large C&D processor' },
    { name: 'Hi-Tech Resource Recovery', address: '130 Varick Ave, Brooklyn, NY 11237', borough: 'BROOKLYN' as const, lat: 40.7065, lng: -73.9273, type: 'GENERAL' as const, hours: 'Mon-Fri 6AM-5PM', accepts: ['C&D', 'Metal', 'Concrete'], notes: 'C&D processing near Newtown Creek' },
    { name: 'Metropolitan Transfer Station', address: '287 Halleck St, Bronx, NY 10474', borough: 'BRONX' as const, lat: 40.8142, lng: -73.8831, type: 'GENERAL' as const, hours: 'Mon-Fri 5AM-7PM, Sat 5AM-3PM', accepts: ['MSW', 'C&D', 'Bulk Waste'], notes: 'Hunts Point area' },
    { name: 'Richmond Recycling', address: '200 Muldoon Ave, Staten Island, NY 10306', borough: 'STATEN_ISLAND' as const, lat: 40.5674, lng: -74.1196, type: 'GENERAL' as const, hours: 'Mon-Fri 6AM-5PM, Sat 6AM-1PM', accepts: ['C&D', 'Demo Debris', 'Fill', 'Metal'], notes: "SI's main C&D transfer station" },
    { name: 'Cooper Tank & Welding', address: '123 Varick Ave, Brooklyn, NY 11237', borough: 'BROOKLYN' as const, lat: 40.7058, lng: -73.9279, type: 'GENERAL' as const, hours: 'Mon-Fri 6AM-5PM', accepts: ['C&D', 'Concrete', 'Asphalt'], notes: 'C&D processing' },
  ];
  for (const d of dumpSitesData) {
    await db.dumpSite.create({
      data: {
        name: d.name,
        address: d.address,
        borough: d.borough,
        lat: d.lat,
        lng: d.lng,
        type: d.type,
        phone: d.phone ?? null,
        hours: d.hours ?? null,
        accepts: d.accepts,
        notes: d.notes ?? null,
      },
    });
  }
  console.log(`  ✅ ${dumpSitesData.length} dump sites (3 KEY, 7 GENERAL)`);

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
      parsedCustomer: 'Bronx Hauling Co', parsedPhone: '718-555-0444', parsedServiceType: 'PICKUP', parsedAddress: 'Grand Concourse, Bronx', parsedContainerSize: '40yd', parsedNotes: 'Container full, caller unclear on details',
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
