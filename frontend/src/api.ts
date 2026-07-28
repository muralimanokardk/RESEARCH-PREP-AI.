import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const TOKEN_KEY = 'rpa_token';
const USER_KEY = 'rpa_user';

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
};

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(t: string) {
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
export async function setUser(u: User) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
}
export async function getUser(): Promise<User | null> {
  const s = await AsyncStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/api${path}`, { ...options, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && body.detail) || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body as T;
}

export const api = {
  register: (name: string, email: string, password: string, role = 'student') =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/auth/me'),

  dashboardStats: () => request('/dashboard/stats'),

  listProjects: () => request<any[]>('/projects'),
  createProject: (data: any) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => request(`/projects/${id}`),
  deleteProject: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),

  generateTopics: (project_id: string, extra: any = {}) =>
    request('/topics/generate', { method: 'POST', body: JSON.stringify({ project_id, ...extra }) }),
  listTopics: (project_id: string) => request<any[]>(`/projects/${project_id}/topics`),

  uploadPaper: (project_id: string, filename: string, base64_data: string) =>
    request('/papers/upload', { method: 'POST', body: JSON.stringify({ project_id, filename, base64_data }) }),
  addPaperText: (data: any) => request('/papers/text', { method: 'POST', body: JSON.stringify(data) }),
  listPapers: (project_id: string) => request<any[]>(`/projects/${project_id}/papers`),
  deletePaper: (id: string) => request(`/papers/${id}`, { method: 'DELETE' }),

  literatureReview: (project_id: string) =>
    request('/literature-review', { method: 'POST', body: JSON.stringify({ project_id }) }),
  getLiteratureReview: (project_id: string) => request(`/projects/${project_id}/literature-review`),

  researchGap: (project_id: string) =>
    request('/research-gap', { method: 'POST', body: JSON.stringify({ project_id }) }),
  getResearchGap: (project_id: string) => request(`/projects/${project_id}/research-gap`),

  generateProposal: (project_id: string, selected_topic?: string) =>
    request('/proposal/generate', { method: 'POST', body: JSON.stringify({ project_id, selected_topic }) }),
  getProposal: (project_id: string) => request(`/projects/${project_id}/proposal`),
  updateProposal: (project_id: string, data: any) =>
    request(`/projects/${project_id}/proposal`, { method: 'PATCH', body: JSON.stringify(data) }),

  citations: (project_id: string, style: string) =>
    request('/citations/generate', { method: 'POST', body: JSON.stringify({ project_id, style }) }),

  generatePPT: (project_id: string) =>
    request('/ppt/generate', { method: 'POST', body: JSON.stringify({ project_id }) }),
  getPPT: (project_id: string) => request(`/projects/${project_id}/ppt`),

  chat: (project_id: string, question: string) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ project_id, question }) }),
};
