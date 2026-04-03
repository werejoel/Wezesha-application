// frontEnd/src/api.ts
const BASE_URL = 'http://localhost:5000/api';

const get = (path: string) =>
  fetch(`${BASE_URL}${path}`).then(res => res.json());

const post = (path: string, body: object) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(res => res.json());

// Dashboard
export const getDashboardStats = () => get('/dashboard');

// Partners
export const getPartners = () => get('/partners');
export const createPartner = (data: object) => post('/partners', data);

// Youth
export const getYouth = () => get('/youth');
export const createYouth = (data: object) => post('/youth', data);

// Sessions
export const getSessions = () => get('/sessions');
export const createSession = (data: object) => post('/sessions', data);

// Cases
export const getCases = () => get('/cases');
export const createCase = (data: object) => post('/cases', data);

// Outcomes
export const getOutcomes = () => get('/outcomes');
export const createOutcome = (data: object) => post('/outcomes', data);

// Reports
export const getReports = () => get('/reports');