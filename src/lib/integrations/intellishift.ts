// DispatchHub — IntelliShift Connect API Integration
// Live fleet data: vehicle locations, status, driver assignments, trip history
// Docs: connect.intellishift.com/swagger

// Auth: Bearer token with 24hr expiry, auto-refresh

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch('https://connect.intellishift.com/api/v2/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.INTELLISHIFT_USERNAME,
      password: process.env.INTELLISHIFT_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`IntelliShift auth failed: ${res.status}`);
  const data = await res.json();

  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000, // 23 hours
  };

  return cachedToken.token;
}

async function apiFetch(endpoint: string) {
  const token = await getToken();
  const res = await fetch(`https://connect.intellishift.com/api/v2${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`IntelliShift API error: ${res.status} on ${endpoint}`);
  return res.json();
}

// ── Fleet Assets ────────────────────────────────────────────

export interface IntelliShiftAsset {
  id: string;
  name: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  status: string;
}

export async function getAssets(): Promise<IntelliShiftAsset[]> {
  return apiFetch('/assets');
}

// ── Live Vehicle Locations ──────────────────────────────────

export interface VehicleLocation {
  assetId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
  status: string; // "moving", "idle", "stopped"
}

export async function getVehicleLocations(): Promise<VehicleLocation[]> {
  return apiFetch('/vehicles/location');
}

// ── Drivers ─────────────────────────────────────────────────

export async function getDrivers() {
  return apiFetch('/drivers');
}

// ── Trip History ────────────────────────────────────────────

export async function getTrips(assetId: string, startDate: string, endDate: string) {
  return apiFetch(`/trips?assetId=${assetId}&start=${startDate}&end=${endDate}`);
}

// ── Geofence Management ─────────────────────────────────────

export async function createGeofence(name: string, coordinates: { lat: number; lng: number }[], radius?: number) {
  const token = await getToken();
  const res = await fetch('https://connect.intellishift.com/api/v2/geofences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, coordinates, radius }),
  });
  return res.json();
}
