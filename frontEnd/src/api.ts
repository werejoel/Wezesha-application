// frontEnd/src/api.ts
const BASE_URL = `${import.meta.env.VITE_API_URL}/api`;
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const base = { Accept: 'application/json', 'Content-Type': 'application/json' };
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
};

const normalizeRole = (role: string | undefined | null) => {
  if (!role) return role;
  const normalized = role.toString().trim().toLowerCase();
  if (normalized === 'program manager' || normalized === 'program_manager') return 'program_manager';
  if (normalized === 'ybf') return 'ybf';
  if (normalized === 'instructor') return 'instructor';
  if (normalized === 'enumerator') return 'enumerator';
  if (normalized === 'admin') return 'admin';
  return normalized;
};

const normalizeUser = (user: any) => {
  if (!user || typeof user !== 'object') return user;
  return {
    ...user,
    role: normalizeRole(user.role),
  };
};

const handleResponse = async (res: Response) => {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }
  return body;
};

const get = (path: string) =>
  fetch(`${BASE_URL}${path}`, { headers: getAuthHeaders() }).then(handleResponse);

const post = (path: string, body: object) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  }).then(handleResponse);

// Auth
export const login = (email: string, password: string) =>
  post('/auth/login', { email, password }).then(data => {
    if (data.token) {
      const normalizedUser = normalizeUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    }
    return data;
  });

export const register = (name: string, email: string, password: string, role?: string) =>
  post('/auth/register', { name, email, password, role }).then(data => {
    if (data.token) {
      const normalizedUser = normalizeUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    }
    return data;
  });

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? normalizeUser(JSON.parse(user)) : null;
};

// Dashboard
export const getDashboardStats = () => get('/dashboard');

// Partners
export const getPartners = () => get('/partners');
export const getPersonnel = () => get('/personnel');
export const createPersonnel = (data: object) => post('/personnel', data);
export const createPartner = (data: object) => post('/partners', data);
export const updatePartner = (id: string, data: object) => fetch(`${BASE_URL}/partners/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(handleResponse);
export const deletePartner = (id: string) => fetch(`${BASE_URL}/partners/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(handleResponse);

// Youth
export const getYouth = () => get('/youth');
export const createYouth = (data: object) => post('/youth', data);
export const updateYouth = (id: string, data: object) => fetch(`${BASE_URL}/youth/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(handleResponse);
export const deleteYouth = (id: string) => fetch(`${BASE_URL}/youth/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(handleResponse);

// Sessions
export const getSessions = () => get('/sessions');
export const createSession = (data: object) => post('/sessions', data);
export const updateSession = (id: string, data: object) => fetch(`${BASE_URL}/sessions/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(handleResponse);
export const deleteSession = (id: string) => fetch(`${BASE_URL}/sessions/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(handleResponse);

// Cases
export const getCases = () => get('/cases');
export const createCase = (data: object) => post('/cases', data);
export const updateCase = (id: string, data: object) => fetch(`${BASE_URL}/cases/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(handleResponse);
export const deleteCase = (id: string) => fetch(`${BASE_URL}/cases/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(handleResponse);

// Outcomes
export const getOutcomes = () => get('/outcomes');
export const createOutcome = (data: object) => post('/outcomes', data);
export const updateOutcome = (id: string, data: object) => fetch(`${BASE_URL}/outcomes/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(handleResponse);
export const deleteOutcome = (id: string) => fetch(`${BASE_URL}/outcomes/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(handleResponse);

// Reports
export const getReports = () => get('/reports');

// Users (admin only)
export const getUsers = () => get('/users');
export const createUser = (name: string, email: string, password: string, role: string) => post('/auth/register', { name, email, password, role });
export const updateUser = (id: string, data: object) => fetch(`${BASE_URL}/users/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(handleResponse);
export const deleteUser = (id: string) => fetch(`${BASE_URL}/users/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(handleResponse);

// Attendance
export const getAttendance = () => get('/attendance');
export const createAttendance = (data: object) => post('/attendance', data);
export const updateAttendance = (id: string, data: object) => fetch(`${BASE_URL}/attendance/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(handleResponse);

// Additional admin endpoints
export const getAtRiskYouth = (opts: { limit?: number; page?: number } = { limit: 20, page: 1 }) =>
  get(`/youth/at-risk?limit=${opts.limit || 20}&page=${opts.page || 1}`);

export const getLowAttendanceSessions = (opts: { threshold?: number; limit?: number; page?: number } = { threshold: 70, limit: 10, page: 1 }) =>
  get(`/sessions/low-attendance?threshold=${opts.threshold || 70}&limit=${opts.limit || 10}&page=${opts.page || 1}`);