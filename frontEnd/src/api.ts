// frontEnd/src/api.ts
const BASE_URL = `${import.meta.env.VITE_API_URL}/api`;
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  const base = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
};

const normalizeRole = (role: string | undefined | null) => {
  if (!role) return role;
  const normalized = role.toString().trim().toLowerCase();
  if (normalized === "program manager" || normalized === "program_manager")
    return "program_manager";
  if (
    normalized === "program_leadership" ||
    normalized === "program leadership"
  )
    return "program_leadership";
  if (
    normalized === "program_manager_out_of_school" ||
    normalized === "program manager out of school"
  )
    return "program_manager_out_of_school";
  if (
    normalized === "program_manager_in_school" ||
    normalized === "program manager in school"
  )
    return "program_manager_in_school";
  if (
    normalized === "program_supervisor" ||
    normalized === "program supervisor"
  )
    return "program_supervisor";
  if (normalized === "ybf") return "ybf";
  if (normalized === "instructor") return "instructor";
  if (normalized === "enumerator") return "enumerator";
  if (normalized === "admin") return "admin";
  return normalized;
};

const normalizeUser = (user: any) => {
  if (!user || typeof user !== "object") return user;
  return {
    ...user,
    role: normalizeRole(user.role),
    status: user.status || "active",
    pendingApproval: Boolean(user.pendingApproval),
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
    const msg =
      (body && (body.error || body.message)) ||
      `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }
  return body;
};

const get = (path: string) =>
  fetch(`${BASE_URL}${path}`, { headers: getAuthHeaders() }).then(
    handleResponse,
  );

const post = (path: string, body: object) =>
  fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  }).then(handleResponse);

// Auth
export const login = (email: string, password: string) =>
  post("/auth/login", { email, password }).then((data) => {
    if (data.token) {
      const normalizedUser = normalizeUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    }
    return data;
  });

export const register = (
  name: string,
  email: string,
  password: string,
  role?: string,
) =>
  post("/auth/register", { name, email, password, role }).then((data) => {
    if (data.token) {
      const normalizedUser = normalizeUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    }
    return data;
  });

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const requestPasswordReset = (email: string) =>
  post("/auth/forgot-password", { email });

export const resetPassword = (email: string, token: string, password: string) =>
  post("/auth/reset-password", { email, token, password });

export const getCurrentUser = () => {
  const user = localStorage.getItem("user");
  return user ? normalizeUser(JSON.parse(user)) : null;
};

export const getMe = () => get("/auth/me").then((data) => normalizeUser(data));

// Dashboard
export const getDashboardStats = () => get("/dashboard");

// Partners
export const getPartners = () => get("/partners");
export const getCohorts = () => get("/cohorts");
export const getPersonnel = () => get("/personnel");
export const createPersonnel = (data: object) => post("/personnel", data);
export const createPartner = (data: object) => post("/partners", data);

export const updatePartner = (id: string, data: object) =>
  fetch(`${BASE_URL}/partners/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const deletePartner = (id: string) =>
  fetch(`${BASE_URL}/partners/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const updatePersonnel = (id: string, data: object) =>
  fetch(`${BASE_URL}/personnel/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const deletePersonnel = (id: string) =>
  fetch(`${BASE_URL}/personnel/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  }).then(handleResponse);

// Youth
export const getYouth = (filters?: {
  region?: string;
  programType?: string;
  programYear?: string | number;
  rosterYear?: string | number;
}) => {
  const params = new URLSearchParams();
  if (filters?.region && filters.region !== "all")
    params.set("region", filters.region);
  if (filters?.programType && filters.programType !== "all")
    params.set("program_type", filters.programType);
  if (filters?.programYear && filters.programYear !== "all")
    params.set("program_year", String(filters.programYear));
  if (filters?.rosterYear)
    params.set("roster_year", String(filters.rosterYear));
  const qs = params.toString();
  return get(`/youth${qs ? `?${qs}` : ""}`);
};
export const createYouth = (data: object) => post("/youth", data);
export const updateYouth = (id: string, data: object) =>
  fetch(`${BASE_URL}/youth/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);
export const deleteYouth = (id: string) =>
  fetch(`${BASE_URL}/youth/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  }).then(handleResponse);

// Sessions
export const getSessions = () => get("/sessions");
export const createSession = (data: object) => post("/sessions", data);
export const updateSession = (id: string, data: object) =>
  fetch(`${BASE_URL}/sessions/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);
export const deleteSession = (id: string) =>
  fetch(`${BASE_URL}/sessions/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  }).then(handleResponse);

// Cases
export const getCases = () => get("/cases");
export const createCase = (data: object) => post("/cases", data);
export const updateCase = (id: string, data: object) =>
  fetch(`${BASE_URL}/cases/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);
export const deleteCase = (id: string) =>
  fetch(`${BASE_URL}/cases/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  }).then(handleResponse);

// Outcomes
export const getOutcomes = () => get("/outcomes");
export const createOutcome = (data: object) => post("/outcomes", data);
export const updateOutcome = (id: string, data: object) =>
  fetch(`${BASE_URL}/outcomes/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);
export const deleteOutcome = (id: string) =>
  fetch(`${BASE_URL}/outcomes/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  }).then(handleResponse);

// Reports
export const getReports = () => get("/reports");

// Users (admin only)
export const getUsers = (opts?: {
  page?: number;
  limit?: number;
  q?: string;
}) => {
  const page = opts?.page || 1;
  const limit = opts?.limit || 10;
  const q = opts?.q ? `&q=${encodeURIComponent(opts.q)}` : "";
  return get(`/users?limit=${limit}&page=${page}${q}`);
};
export const createUser = (
  name: string,
  email: string,
  password: string,
  role: string,
  regionScope?: string,
) => post("/auth/register", { name, email, password, role, region_scope: regionScope });
export const updateUser = (id: string, data: object) =>
  fetch(`${BASE_URL}/users/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);
export const deleteUser = (id: string) =>
  fetch(`${BASE_URL}/users/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  }).then(handleResponse);

export const updateUserStatus = (
  id: string,
  status: "active" | "inactive" | "blocked" | "pending",
) =>
  fetch(`${BASE_URL}/users/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  }).then(handleResponse);

export const importKoboData = (resource: string, records: any[]) =>
  post("/import/kobo", { resource, records });

export const downloadExport = (resource: string = "all") =>
  fetch(`${BASE_URL}/export?resource=${encodeURIComponent(resource)}`, {
    headers: getAuthHeaders(),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      const msg =
        body && (body.error || body.message)
          ? body.error || body.message
          : `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(msg);
    }
    return res.blob();
  });

// Attendance
export const getAttendance = () => get("/attendance");
export const createAttendance = (data: object) => post("/attendance", data);
export const updateAttendance = (id: string, data: object) =>
  fetch(`${BASE_URL}/attendance/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }).then(handleResponse);

export const createBulkAttendance = (
  records: {
    session_id: string | number;
    youth_id: string | number;
    status: string;
  }[],
) => post("/attendance/bulk", { records });

//Risk endpoints
export const getAtRiskYouth = (
  opts: { limit?: number; page?: number } = { limit: 20, page: 1 },
) => get(`/youth/at-risk?limit=${opts.limit || 20}&page=${opts.page || 1}`);

export const getLowAttendanceSessions = (
  opts: { threshold?: number; limit?: number; page?: number } = {
    threshold: 70,
    limit: 10,
    page: 1,
  },
) =>
  get(
    `/sessions/low-attendance?threshold=${opts.threshold || 70}&limit=${opts.limit || 10}&page=${opts.page || 1}`,
  );
