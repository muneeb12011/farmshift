// ============================================
// FARMSHIFT — API CLIENT
// Talks to the FarmShift backend (farmshift-backend). Same exported surface the mock layer had,
// plus scenario-run helpers. Base URL: NEXT_PUBLIC_API_URL (default http://localhost:4000/api/v1).
// ============================================

import type {
  EnvironmentSummary,
  EnvironmentDataPoint,
  CropInfo,
  RotationScenario,
  FieldLocation,
  SoilProfile,
  FarmerPriorities,
} from '@/types';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- session (httpOnly cookie) ----
// The credential lives in an httpOnly cookie set by the API, so page JavaScript can never read it.
// localStorage only holds a NON-secret hint ("a session probably exists") so anonymous visitors do not
// make a pointless /auth/me call on every page load.
const SESSION_HINT = 'farmshift:session';
export const AUTH_EVENT = 'farmshift:auth-changed';

export function hasSessionHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return false;
  }
}

export function setSessionHint(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(SESSION_HINT, '1');
    else window.localStorage.removeItem(SESSION_HINT);
  } catch {
    /* storage unavailable (private mode): the hint just will not persist */
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include', // send/receive the httpOnly session cookie (CORS allows credentials for known origins)
      headers: {
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        'x-auth-mode': 'cookie', // ask the API not to put the session token in response bodies
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(`Cannot reach the FarmShift API at ${BASE}. Is the backend running? (npm run dev)`, 0, 'NETWORK');
  }
  // The API clears an expired/revoked cookie itself and keeps public pages working; just keep the hint honest.
  if (res.status === 401 && hasSessionHint()) setSessionHint(false);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status, body?.error?.code);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

type Point = Pick<FieldLocation, 'lat' | 'lon'>;
const locQuery = (p: Point) => `lat=${encodeURIComponent(p.lat)}&lon=${encodeURIComponent(p.lon)}`;

// ---- environment ----

export const fetchEnvironmentSummary = (field: Point) =>
  http<EnvironmentSummary>(`/environment/summary?${locQuery(field)}`);

export const fetchEnvironmentTimeSeries = (range: string, field: Point) =>
  http<EnvironmentDataPoint[]>(`/environment/timeseries?${locQuery(field)}&range=${encodeURIComponent(range)}`);

// ---- catalog & farms ----

export const fetchCropCatalog = () => http<CropInfo[]>('/crops');

export async function fetchCropByName(name: string): Promise<CropInfo | undefined> {
  try {
    return await http<CropInfo>(`/crops/${encodeURIComponent(name)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export const fetchFarms = () => http<FieldLocation[]>('/farms');

export async function fetchFarmById(id: string): Promise<FieldLocation | undefined> {
  try {
    return await http<FieldLocation>(`/farms/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

// ---- scenarios ----

export interface ScenarioProfile {
  soil: SoilProfile;
  currentCrop: string;
  waterAvailability: 'High' | 'Moderate' | 'Limited';
  irrigationType: 'Irrigated' | 'Rain-fed' | 'Mixed';
  priorities: FarmerPriorities;
}

export interface ScenarioRequest {
  field: Point;
  profile: ScenarioProfile;
  /** Crop ids from the rotation builder; shapes the generated scenarios (length, must-include). */
  rotation?: string[];
}

export type ScenarioMetrics = RotationScenario['metrics'];

export interface ScenarioRun {
  runId: string;
  scenarios: RotationScenario[];
  /** Continuing the current crop: the real "Current Plan" for comparison charts. */
  baseline: { crops: string[]; metrics: ScenarioMetrics; overallScore: number };
  environment: EnvironmentSummary;
  warnings: string[];
}

// The rotation builder records what the user built; the scenarios page then reuses the same run.
let rotationPreference: string[] | undefined;
export const setRotationPreference = (ids: string[] | undefined) => {
  rotationPreference = ids && ids.length ? [...ids] : undefined;
};

const runCache = new Map<string, Promise<ScenarioRun>>();

function buildBody(req: ScenarioRequest, rotation: string[] | undefined) {
  const body: Record<string, unknown> = {
    location: { lat: req.field.lat, lon: req.field.lon },
    profile: req.profile,
  };
  if (rotation?.length) {
    const distinct = [...new Set(rotation)];
    body.options = {
      length: Math.min(5, Math.max(2, rotation.length, Math.min(4, distinct.length))),
      mustInclude: distinct.slice(0, 4),
    };
  }
  return body;
}

export function fetchScenarioRun(req: ScenarioRequest): Promise<ScenarioRun> {
  const rotation = req.rotation ?? rotationPreference;
  const key = JSON.stringify([req.field.lat, req.field.lon, req.profile, rotation ?? null]);
  const hit = runCache.get(key);
  if (hit) return hit;

  const post = (rot: string[] | undefined) =>
    http<ScenarioRun>('/scenarios/generate', { method: 'POST', body: JSON.stringify(buildBody(req, rot)) });

  const p = post(rotation)
    // An over-constrained builder rotation (e.g. includes a non-viable crop) falls back to unconstrained generation.
    .catch((e) => (rotation && e instanceof ApiError && e.status === 422 ? post(undefined) : Promise.reject(e)))
    .catch((e) => {
      runCache.delete(key);
      throw e;
    });
  runCache.set(key, p);
  return p;
}

export async function fetchScenarios(req: ScenarioRequest): Promise<RotationScenario[]> {
  return (await fetchScenarioRun(req)).scenarios;
}

export async function fetchScenarioById(id: string, req: ScenarioRequest): Promise<RotationScenario | undefined> {
  return (await fetchScenarioRun(req)).scenarios.find((s) => s.id === id);
}

/** Score a user-built rotation with the same engine (rotation builder). */
export const evaluateRotation = (req: ScenarioRequest, rotation: string[]) =>
  http<{ baseline: ScenarioRun['baseline']; scenario: RotationScenario; warnings: string[] }>('/scenarios/evaluate', {
    method: 'POST',
    body: JSON.stringify({ location: { lat: req.field.lat, lon: req.field.lon }, profile: req.profile, rotation }),
  });

// ---- accounts & saved plans ----

export interface AccountUser {
  id: string;
  email: string;
  name: string;
}

export interface SavedPlan {
  id: string;
  farmId: string | null;
  name: string;
  crops: string[];
  notes: string | null;
  metrics: ScenarioMetrics | null;
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthResponse {
  user: AccountUser;
}

export async function registerAccount(input: { email: string; password: string; name: string }): Promise<AccountUser> {
  const r = await http<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
  setSessionHint(true);
  return r.user;
}

export async function loginAccount(input: { email: string; password: string }): Promise<AccountUser> {
  const r = await http<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
  setSessionHint(true);
  return r.user;
}

export const fetchMe = () => http<AccountUser>('/auth/me');

/** Sign out this browser. Pass everywhere=true to also revoke this account's sessions on every device. */
export async function signOut(everywhere = false) {
  await http<void>(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }).catch(() => undefined);
  setSessionHint(false);
}

export const savePlan = (input: { name: string; crops: string[]; metrics?: ScenarioMetrics; overallScore?: number; notes?: string }) =>
  http<SavedPlan>('/plans', { method: 'POST', body: JSON.stringify(input) });

export const fetchPlans = () => http<{ items: SavedPlan[]; total: number }>('/plans?limit=100');

export const deletePlan = (id: string) => http<void>(`/plans/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- password reset ----

/** Always resolves (the API answers identically whether or not the address has an account). */
export const requestPasswordReset = (email: string) =>
  http<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });

export const resetPassword = (token: string, newPassword: string) =>
  http<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
