// frontEnd/src/api.ts
const BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
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

const get = (path: string) =>
  fetch(`${BASE_URL}${path}`, { headers: getAuthHeaders() }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const post = (path: string, body: object) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

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
export const createPartner = (data: object) => post('/partners', data);
export const updatePartner = (id: string, data: object) => fetch(`${BASE_URL}/partners/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});
export const deletePartner = (id: string) => fetch(`${BASE_URL}/partners/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});

// Youth
export const getYouth = () => get('/youth');
export const createYouth = (data: object) => post('/youth', data);
export const updateYouth = (id: string, data: object) => fetch(`${BASE_URL}/youth/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});
export const deleteYouth = (id: string) => fetch(`${BASE_URL}/youth/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});

// Sessions
export const getSessions = () => get('/sessions');
export const createSession = (data: object) => post('/sessions', data);
export const updateSession = (id: string, data: object) => fetch(`${BASE_URL}/sessions/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});
export const deleteSession = (id: string) => fetch(`${BASE_URL}/sessions/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});

// Cases
export const getCases = () => get('/cases');
export const createCase = (data: object) => post('/cases', data);
export const updateCase = (id: string, data: object) => fetch(`${BASE_URL}/cases/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});
export const deleteCase = (id: string) => fetch(`${BASE_URL}/cases/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});

// Outcomes
export const getOutcomes = () => get('/outcomes');
export const createOutcome = (data: object) => post('/outcomes', data);
export const updateOutcome = (id: string, data: object) => fetch(`${BASE_URL}/outcomes/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});
export const deleteOutcome = (id: string) => fetch(`${BASE_URL}/outcomes/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});

// Reports
export const getReports = () => get('/reports');

// Users (admin only)
export const getUsers = () => get('/users');
export const updateUser = (id: string, data: object) => fetch(`${BASE_URL}/users/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});
export const deleteUser = (id: string) => fetch(`${BASE_URL}/users/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders(),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});

// Attendance
export const getAttendance = () => get('/attendance');
export const createAttendance = (data: object) => post('/attendance', data);
export const updateAttendance = (id: string, data: object) => fetch(`${BASE_URL}/attendance/${id}`, {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify(data),
}).then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
});