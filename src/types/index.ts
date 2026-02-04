// DispatchHub — Shared TypeScript Types
// These mirror the Prisma schema for client-side use
// Import from '@/types' everywhere

// ── ENUMS ───────────────────────────────────────────────────

export type TruckType = 'BOX_TRUCK' | 'CONTAINER' | 'PACKER' | 'ROLL_OFF' | 'SERVICE' | 'VAN';
export type TruckStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SITE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
export type WorkerRole = 'DRIVER' | 'LABORER' | 'FOREMAN' | 'OPERATOR';
export type WorkerStatus = 'AVAILABLE' | 'ON_SITE' | 'EN_ROUTE' | 'OFF_DUTY' | 'OUT_SICK' | 'VACATION';
export type JobType = 'PICKUP' | 'DROP_OFF' | 'DUMP_OUT' | 'SWAP' | 'HAUL';
export type JobStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DELAYED';
export type Borough = 'MANHATTAN' | 'BROOKLYN' | 'QUEENS' | 'BRONX' | 'STATEN_ISLAND';
export type IntakeSource = 'PHONE' | 'EMAIL' | 'FORM';
export type Priority = 'NORMAL' | 'HIGH' | 'URGENT';
export type IntakeStatus = 'PENDING' | 'NEEDS_REVIEW' | 'FLAGGED' | 'APPROVED' | 'DECLINED' | 'ON_HOLD';
export type ProjectPhase = 'PLANNING' | 'ACTIVE_DEMO' | 'CARTING' | 'CLEANUP' | 'COMPLETE';
export type ConfirmChannel = 'CALL' | 'EMAIL' | 'SMS';
export type ConfirmStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'FAILED';

// ── DISPLAY HELPERS ─────────────────────────────────────────

export const TRUCK_TYPE_LABELS: Record<TruckType, string> = {
  BOX_TRUCK: 'Box Truck', CONTAINER: 'Container', PACKER: 'Packer',
  ROLL_OFF: 'Roll-Off', SERVICE: 'Service', VAN: 'Van',
};

export const TRUCK_STATUS_LABELS: Record<TruckStatus, string> = {
  AVAILABLE: 'Available', EN_ROUTE: 'En Route', ON_SITE: 'On Site',
  MAINTENANCE: 'Maintenance', OUT_OF_SERVICE: 'Out of Service',
};

export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  AVAILABLE: 'Available', ON_SITE: 'On Site', EN_ROUTE: 'En Route',
  OFF_DUTY: 'Off Duty', OUT_SICK: 'Out Sick', VACATION: 'Vacation',
};

export const BOROUGH_LABELS: Record<Borough, string> = {
  MANHATTAN: 'Manhattan', BROOKLYN: 'Brooklyn', QUEENS: 'Queens',
  BRONX: 'Bronx', STATEN_ISLAND: 'Staten Island',
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  PICKUP: 'Pickup', DROP_OFF: 'Drop-Off', DUMP_OUT: 'Dump-Out', SWAP: 'Swap', HAUL: 'Haul',
};

export const WORKER_ROLE_LABELS: Record<WorkerRole, string> = {
  DRIVER: 'Driver', LABORER: 'Laborer', FOREMAN: 'Foreman', OPERATOR: 'Operator',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  SCHEDULED: 'Scheduled', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', DELAYED: 'Delayed',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent',
};

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  PENDING: 'Pending', NEEDS_REVIEW: 'Needs Review', FLAGGED: 'Flagged',
  APPROVED: 'Approved', DECLINED: 'Declined', ON_HOLD: 'On Hold',
};

// ── ENTITIES ────────────────────────────────────────────────

export interface Truck {
  id: string;
  name: string;
  type: TruckType;
  year: string | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  status: TruckStatus;
  currentLocation: string | null;
  intellishiftId: string | null;
  lastGpsLat: number | null;
  lastGpsLng: number | null;
  lastGpsUpdate: string | null;
  assignedDriverId: string | null;
  assignedDriver?: Worker;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  role: WorkerRole;
  status: WorkerStatus;
  phone: string;
  email: string;
  certifications: string[];
  hireDate: string;
  photo: string | null;
  emergencyContact: string | null;
  performanceNotes: string | null;
  currentAssignment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartingJob {
  id: string;
  type: JobType;
  status: JobStatus;
  customer: string;
  address: string;
  borough: Borough;
  date: string;        // ISO date
  time: string;        // "HH:MM"
  containerSize: string | null;
  notes: string | null;
  source: IntakeSource;
  priority: Priority;
  truckId: string | null;
  truck?: Truck;
  driverId: string | null;
  driver?: Worker;
  workers?: Worker[];
  projectId: string | null;
  project?: DemoProject;
  intakeItemId: string | null;
  confirmations?: Confirmation[];
  createdAt: string;
  updatedAt: string;
}

export interface IntakeItem {
  id: string;
  source: IntakeSource;
  rawContent: string;
  audioUrl: string | null;
  parsedCustomer: string | null;
  parsedPhone: string | null;
  parsedEmail: string | null;
  parsedServiceType: string | null;
  parsedAddress: string | null;
  parsedDate: string | null;
  parsedTime: string | null;
  parsedContainerSize: string | null;
  parsedNotes: string | null;
  confidence: number;
  status: IntakeStatus;
  receivedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface DemoProject {
  id: string;
  name: string;
  customer: string;
  address: string;
  borough: Borough;
  phase: ProjectPhase;
  startDate: string;
  endDate: string;
  cartingNeeds: string | null;
  notes: string | null;
  assignedWorkers?: Worker[];
  assignedTrucks?: Truck[];
  jobs?: CartingJob[];
  chatMessages?: ProjectChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectChatMessage {
  id: string;
  projectId: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface Confirmation {
  id: string;
  jobId: string;
  channel: ConfirmChannel;
  status: ConfirmStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failReason: string | null;
  externalId: string | null;
}

export interface Route {
  id: string;
  truckId: string;
  truck?: Truck;
  date: string;
  optimizedPath: any;
  actualPath: any;
  totalDistance: number | null;
  totalDuration: number | null;
  deviationCount: number;
  stops?: RouteStop[];
}

export interface RouteStop {
  id: string;
  routeId: string;
  jobId: string;
  job?: CartingJob;
  sequence: number;
  eta: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
}

export interface ChangeLogEntry {
  id: string;
  entityType: 'job' | 'worker' | 'truck' | 'project' | 'intake';
  entityId: string;
  entityName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  userName: string | null;
  jobId: string | null;
  timestamp: string;
}

// ── CONFLICT ENGINE ─────────────────────────────────────────

export interface Conflict {
  type: 'TRUCK_DOUBLE_BOOK' | 'DRIVER_DOUBLE_BOOK' | 'WORKER_OUT_SICK' | 'PROJECT_RESOURCE_LOCK';
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  affectedJobId?: string;
  affectedWorkerId?: string;
  affectedTruckId?: string;
}

// ── AI TYPES ────────────────────────────────────────────────

export interface AiIntakeParseResult {
  customer: string | null;
  phone: string | null;
  email: string | null;
  serviceType: JobType | null;
  address: string | null;
  date: string | null;
  time: string | null;
  containerSize: string | null;
  notes: string | null;
  confidence: number;
}

export interface AiWorkerRecommendation {
  workerId: string;
  worker: Worker;
  score: number;        // 0-100 match score
  reasons: string[];    // ["CDL-A holder", "Available today", "Closest proximity"]
}

export interface AiFixOption {
  id: string;
  label: string;
  detail: string;
  type: 'SWAP_TRUCK' | 'SWAP_DRIVER' | 'RESCHEDULE';
  payload: Record<string, any>;
}

// ── API RESPONSE WRAPPERS ───────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── SEARCH ──────────────────────────────────────────────────

export interface SearchResult {
  type: 'job' | 'worker' | 'truck' | 'project' | 'intake';
  id: string;
  label: string;
  sublabel: string;
  url: string;
}

// ── PREVIEW / SANDBOX ───────────────────────────────────────

export interface PreviewAnalysis {
  efficiencyScore: number;           // 0-100
  conflicts: Conflict[];             // from conflict engine
  warnings: string[];                // soft warnings (e.g. "heavy day", "long deadhead")
  positives: string[];               // good things (e.g. "keeps crew paired", "short repositioning")
  estimatedDeadhead: string;         // e.g. "3.2 miles from previous job"
  workloadBalance: string;           // e.g. "Marco: 4 jobs today (above average)"
  alternativeSuggestion: string;     // e.g. "Swapping to Packer 09 saves 20 min travel"
  routeImpact: string;              // e.g. "Adds 15 min to Packer 11's route"
}

export interface PreviewAssignment {
  intakeItemId: string;
  truckId: string | null;
  driverId: string | null;
  workerIds: string[];
  timeOverride: string | null;
  containerSize: string | null;
  analysis: PreviewAnalysis | null;
  analysisLoading: boolean;
}

export interface PreviewAnalyzeRequest {
  intakeItemId: string;
  truckId: string | null;
  driverId: string | null;
  workerIds: string[];
  timeOverride: string | null;
  otherPreviews: {
    intakeItemId: string;
    truckId: string;
    driverId: string;
    workerIds: string[];
    time: string;
  }[];
}

export interface BatchApproveItem {
  intakeItemId: string;
  truckId: string;
  driverId: string;
  workerIds: string[];
  timeOverride: string | null;
  containerSize?: string | null;
}

// ── DISPATCH COMMAND CENTER ─────────────────────────────────

export interface RoutePoint {
  jobId: string;
  customer: string;
  address: string;
  borough: Borough;
  time: string;
  type: JobType;
  status: JobStatus;
  sequence: number;
  lat: number | null;
  lng: number | null;
  truckId: string;
  truckName: string;
}

export interface TruckRoute {
  truckId: string;
  truckName: string;
  truckType: TruckType;
  truckStatus: TruckStatus;
  driverName: string | null;
  driverId: string | null;
  stops: RoutePoint[];
  totalJobs: number;
  boroughs: Borough[];
  currentStopIndex: number;
}

export interface ScenarioInput {
  type: 'TRUCK_DOWN' | 'WORKER_SICK' | 'ADD_JOB' | 'SWAP_TRUCK' | 'SWAP_DRIVER' | 'RESCHEDULE' | 'REASSIGN';
  affectedTruckId?: string;
  affectedWorkerId?: string;
  affectedJobId?: string;
  replacementTruckId?: string;
  replacementDriverId?: string;
  newTime?: string;
  newDate?: string;
}

export interface ScenarioResult {
  feasible: boolean;
  score: number;
  affectedRoutes: {
    truckId: string;
    truckName: string;
    before: { totalStops: number; estimatedDuration: string; boroughs: string[] };
    after: { totalStops: number; estimatedDuration: string; boroughs: string[] };
    impact: string;
  }[];
  unassignedJobs: {
    jobId: string;
    customer: string;
    address: string;
    time: string;
    suggestedTruck: string;
    suggestedDriver: string;
    reason: string;
  }[];
  warnings: string[];
  recommendation: string;
  alternativeScenarios: {
    label: string;
    score: number;
    summary: string;
    scenarioInput?: ScenarioInput;
  }[];
}

export interface ResourceCard {
  id: string;
  type: 'truck' | 'worker';
  name: string;
  truckType?: TruckType;
  truckStatus?: TruckStatus;
  currentBorough?: string;
  todayJobs?: number;
  currentStop?: string;
  role?: WorkerRole;
  workerStatus?: WorkerStatus;
  certs?: string[];
  todayAssignments?: number;
  available: boolean;
  inScenario: boolean;
}

// ── JOB DASHBOARD AI ANALYSIS ───────────────────────────────

export interface JobAnalysisWorkerRec {
  workerId: string;
  name: string;
  score: number;
  reason: string;
}

export interface JobAnalysisTruckRec {
  truckId: string;
  name: string;
  type: string;
  reason: string;
}

export interface JobAnalysis {
  conflicts: string[];
  recommendations: string[];
  warnings: string[];
  impactSummary: string;
  workerRecs: JobAnalysisWorkerRec[];
  truckRecs?: JobAnalysisTruckRec[];
  optimizationTip?: string;
}

export interface JobAnalysisFeedEntry {
  timestamp: Date;
  trigger: string;
  analysis?: JobAnalysis;
  /** Freeform chat Q&A entry */
  question?: string;
  answer?: string;
}

// ── AGENTIC DISPATCH AI ─────────────────────────────────────

export type VoiceCommandAction =
  | 'assign_driver'
  | 'assign_truck'
  | 'mark_complete'
  | 'mark_delayed'
  | 'reschedule'
  | 'swap_truck'
  | 'swap_driver';

export interface VoiceCommandActionItem {
  action: VoiceCommandAction;
  jobId: string;
  jobName: string;
  params: Record<string, string>;
}

export interface AgenticVoiceResponse {
  type: 'update' | 'scenario' | 'query';
  message: string;
  actions: VoiceCommandActionItem[];
  autoApply: boolean;
}
