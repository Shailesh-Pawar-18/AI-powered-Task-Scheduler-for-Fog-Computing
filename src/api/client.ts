const TOKEN_KEY = 'fog_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (res.status === 401) {
    setToken(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:logout'));
    throw new ApiError(401, 'Session expired. Please log in again.');
  }
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null;
  if (!res.ok) throw new ApiError(res.status, (data && (data as any).error) || res.statusText);
  return data as T;
}

export async function login(username: string, password: string): Promise<void> {
  const { token } = await apiFetch<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(token);
}

export interface DatasetRow {
  timestamp?: string;
  device_type: string;
  priority: string;
  cpu: number;
  memory: number;
  latency: number;
  sensor_id?: string;
}

export interface ImportBatch {
  source: string;
  rowsReceived: number;
  rowsInvalid: number;
  duplicatesRemoved: number;
  rowsStored: number;
}

export function importDataset(source: string, rows: DatasetRow[]) {
  return apiFetch<{ batch: ImportBatch }>('/datasets/import', {
    method: 'POST',
    body: JSON.stringify({ source, rows }),
  });
}

export function getNodePlan(records: number) {
  return apiFetch<{ nodeCount: number; nodes: any[] }>(`/nodes/plan?records=${records}`);
}

export interface DatasetRecordDoc {
  _id: string;
  timestamp: string | null;
  deviceType: string;
  priority: string;
  cpu: number;
  memory: number;
  latency: number;
  sensorId?: string;
}

export function getDatasets(limit = 1000) {
  return apiFetch<{ total: number; records: DatasetRecordDoc[] }>(`/datasets?limit=${limit}`);
}
