const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
const pool = require("./db");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const REGIONS = ["ITS", "Central", "Eastern", "Northern-Lira", "Northern-Gulu"];
const INSTITUTIONAL_SESSION_TOTAL = 18;
const DATA_ENTRY_DAYS = 5;
const MANAGEMENT_ROLES = ["admin", "program_manager", "program_leadership", "program_manager_out_of_school", "program_manager_in_school", "program_supervisor"];

const ensureSchema = async () => {
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
  );
  await pool.query(
    `UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''`,
  );
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_to UUID`,
  );
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_regions TEXT[] DEFAULT '{}'`);
  await pool.query(`UPDATE users SET role = 'instructor' WHERE role = 'enumerator'`);
  // The two documents are tracked together; business ideas are their own output.
  await pool.query(`ALTER TABLE output_milestone DROP CONSTRAINT IF EXISTS output_milestone_milestone_type_check`);
  await pool.query(`DELETE FROM output_milestone app USING output_milestone plan
    WHERE app.youth_id = plan.youth_id AND app.milestone_type IN ('Application Letter', 'Cover Letter') AND plan.milestone_type = 'Business Plan'`);
  await pool.query(`UPDATE output_milestone SET milestone_type = 'Application Letter & Business Plan'
    WHERE milestone_type IN ('Business Plan', 'Application Letter', 'Cover Letter')`);
  await pool.query(`ALTER TABLE output_milestone ADD CONSTRAINT output_milestone_milestone_type_check CHECK (milestone_type IN ('Application Letter & Business Plan', 'Business Ideas', 'CV'))`).catch(() => {});
  await pool.query(
    `ALTER TABLE partner_institution ADD COLUMN IF NOT EXISTS deleted_by UUID`,
  );
  await pool.query(
    `ALTER TABLE partner_institution ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  );
  await pool.query(
    `ALTER TABLE partner_institution ADD COLUMN IF NOT EXISTS region VARCHAR(50)`,
  );
  await pool.query(
    `ALTER TABLE partner_institution ADD COLUMN IF NOT EXISTS program_type VARCHAR(30) DEFAULT 'In-school'`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS disability VARCHAR(100)`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS course VARCHAR(150)`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50)`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS roster_year INTEGER DEFAULT 1`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS school_name VARCHAR(200)`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS baseline_income INTEGER DEFAULT 0`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS current_income INTEGER DEFAULT 0`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS has_business BOOLEAN DEFAULT false`,
  );
  await pool.query(
    `ALTER TABLE youth ADD COLUMN IF NOT EXISTS above_ipl BOOLEAN DEFAULT false`,
  );
  await pool.query(
    `ALTER TABLE case_note ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT false`,
  );
  await pool.query(
    `ALTER TABLE case_note ALTER COLUMN follow_up_required SET DEFAULT false`,
  );
  await pool.query(
    `UPDATE case_note SET follow_up_required = false WHERE follow_up_required IS NULL`,
  );
  await pool.query(
    `ALTER TABLE case_note ADD COLUMN IF NOT EXISTS is_done BOOLEAN DEFAULT false`,
  );
  await pool.query(
    `ALTER TABLE session ADD COLUMN IF NOT EXISTS data_entry_deadline DATE`,
  );
  await pool.query(
    `ALTER TABLE session ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false`,
  );
  // Ensure youth_code is unique only for non-NULL values
  await pool.query(`
    DROP CONSTRAINT IF EXISTS youth_youth_code_key ON youth CASCADE
  `).catch(() => {}); // Ignore if constraint doesn't exist
  
  // Recreate the unique constraint to only apply to non-NULL values
  // This allows multiple NULL values (youth without codes) but keeps codes unique
  await pool.query(`
    ALTER TABLE youth ADD CONSTRAINT youth_youth_code_key UNIQUE (youth_code)
      WHERE youth_code IS NOT NULL
  `).catch(() => {}); // Ignore if constraint already exists
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ybf_partner_assignment (
      user_id UUID NOT NULL,
      partner_institution_id UUID NOT NULL,
      PRIMARY KEY (user_id, partner_institution_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ybf_assignment (
      user_id UUID NOT NULL,
      cohort_id UUID NOT NULL,
      PRIMARY KEY (user_id, cohort_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instructor_partner_assignment (
      user_id UUID NOT NULL,
      partner_institution_id UUID NOT NULL,
      PRIMARY KEY (user_id, partner_institution_id)
    )
  `);
  // Migrate legacy single-partner YBF links into the junction table
  await pool.query(`
    INSERT INTO ybf_partner_assignment (user_id, partner_institution_id)
    SELECT id, assigned_to FROM users
    WHERE role = 'ybf' AND assigned_to IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await pool.query(`
    INSERT INTO instructor_partner_assignment (user_id, partner_institution_id)
    SELECT id, assigned_to FROM users
    WHERE role = 'instructor' AND assigned_to IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await pool.query(`
    UPDATE partner_institution SET region = location
    WHERE region IS NULL AND location IS NOT NULL AND location <> ''
  `);
};
ensureSchema().catch((err) =>
  console.error("Schema bootstrap failed:", err.message),
);

const USER_STATUSES = ["active", "inactive", "blocked", "pending"];

const normalizeUserRole = (role) => {
  if (!role || typeof role !== "string") return "ybf";
  const normalized = role.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "program_manager" || normalized === "programmanager")
    return "program_manager";
  if (normalized === "ybf" || normalized === "youth_business_fellow")
    return "ybf";
  if (normalized === "instructor") return "instructor";
  if (normalized === "admin" || normalized === "administrator") return "admin";
  if (["program_leadership", "program_manager_out_of_school", "program_manager_in_school", "program_supervisor"].includes(normalized)) return normalized;
  // Enumerator is retired. Existing accounts are transitioned to instructor access.
  if (normalized === "enumerator") return "instructor";
  return normalized;
};

const getManagementScope = async (user) => {
  const role = user?.role;
  if (!role || ["admin", "program_manager", "program_leadership"].includes(role)) return null;
  if (role === "program_manager_in_school") return { programType: "In-school" };
  if (role === "program_manager_out_of_school") return { programType: "Out-of-school" };
  if (role === "program_supervisor") {
    const result = await pool.query(`SELECT assigned_regions FROM users WHERE id = $1`, [user.id]);
    const regions = result.rows[0]?.assigned_regions || [];
    return { regions: regions.length ? regions : REGIONS };
  }
  return null;
};

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const getMondayOfWeek = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const validateSessionSchedule = (sessionDate) => {
  const monday = getMondayOfWeek(sessionDate);
  const today = new Date().toISOString().slice(0, 10);
  if (today > monday) {
    return {
      ok: false,
      error: `Sessions must be scheduled by Monday (${monday}) for that week.`,
    };
  }
  return { ok: true };
};

const enrichSessionRow = (row) => {
  const today = new Date().toISOString().slice(0, 10);
  const sessionDate = row.session_date
    ? String(row.session_date).slice(0, 10)
    : null;
  let deadline =
    row.data_entry_deadline != null
      ? String(row.data_entry_deadline).slice(0, 10)
      : sessionDate
        ? addDays(sessionDate, DATA_ENTRY_DAYS)
        : null;
  const locked =
    Boolean(row.is_locked) || (deadline != null && today > deadline);
  let daysRemaining = null;
  if (sessionDate && today >= sessionDate && deadline && !locked) {
    daysRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(deadline).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
  }
  return {
    ...row,
    data_entry_deadline: deadline,
    is_locked: locked,
    days_remaining: daysRemaining,
    expected_session_total: INSTITUTIONAL_SESSION_TOTAL,
  };
};

const getInstructorPartnerIds = async (userId) => {
  const ids = new Set();
  const assignmentRes = await pool.query(
    `SELECT partner_institution_id FROM instructor_partner_assignment WHERE user_id::text = $1::text`,
    [String(userId)],
  );
  assignmentRes.rows.forEach((r) => ids.add(r.partner_institution_id));
  const userRes = await pool.query(
    `SELECT assigned_to FROM users WHERE id = $1`,
    [userId],
  );
  if (userRes.rows[0]?.assigned_to) ids.add(userRes.rows[0].assigned_to);
  return [...ids];
};

const assignInstructorToPartner = async (userId, partnerId) => {
  await pool.query(
    `INSERT INTO instructor_partner_assignment (user_id, partner_institution_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, partnerId],
  );
  await pool.query(`UPDATE users SET assigned_to = $1 WHERE id = $2`, [
    partnerId,
    userId,
  ]);
};

const assertSessionUnlocked = async (sessionId, userRole) => {
  if (userRole === "admin" || userRole === "program_manager") return null;
  const sessionRes = await pool.query(`SELECT * FROM session WHERE id = $1`, [
    sessionId,
  ]);
  if (!sessionRes.rows[0]) return "Session not found";
  const enriched = enrichSessionRow(sessionRes.rows[0]);
  if (enriched.is_locked) {
    return "Attendance entry is locked. The 5-day data entry window has closed.";
  }
  return null;
};

const computeYouthAt80Percent = async (cohortFilter, params) => {
  const res = await pool.query(
    `SELECT COUNT(*) FROM (
       SELECT y.id,
              COUNT(DISTINCT s.id) AS total_sessions,
              COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present_count
       FROM youth y
       JOIN cohort c ON c.id = y.cohort_id
       LEFT JOIN session s ON s.cohort_id = y.cohort_id
       LEFT JOIN attendance_record a ON a.session_id = s.id AND a.youth_id = y.id
       WHERE y.deleted_by IS NULL ${cohortFilter}
       GROUP BY y.id
     ) t
     WHERE t.total_sessions > 0
       AND t.present_count >= CEIL(t.total_sessions * 0.8)`,
    params,
  );
  return Number(res.rows[0]?.count || 0);
};

const computeAvgSessionsPerYouth = async (cohortFilter, params) => {
  const res = await pool.query(
    `SELECT CASE WHEN COUNT(DISTINCT y.id) = 0 THEN 0
            ELSE ROUND(COUNT(DISTINCT s.id)::numeric / COUNT(DISTINCT y.id), 1)
       END AS avg_sessions
     FROM youth y
     LEFT JOIN session s ON s.cohort_id = y.cohort_id
     WHERE y.deleted_by IS NULL ${cohortFilter}`,
    params,
  );
  return Number(res.rows[0]?.avg_sessions || 0);
};

const getAccountStatusMessage = (status) => {
  if (status === "blocked") {
    return "This account has been blocked. Contact your admin.";
  }
  if (status === "inactive") {
    return "This account is deactivated. Contact your admin.";
  }
  return null;
};

const isPendingApproval = (user) => {
  const role = String(user?.role || "").toLowerCase();
  if (role !== "ybf" && role !== "instructor") return false;
  if (user?.status === "blocked" || user?.status === "inactive") return false;
  return user?.status === "pending" || !user?.assigned_to;
};

// Input validation middleware
const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = fields.filter((field) => !req.body[field]);
    if (missing.length > 0) {
      return res
        .status(400)
        .json({ error: `Missing required fields: ${missing.join(", ")}` });
    }
    next();
  };
};

const getPartnerIdByName = async (name) => {
  if (!name || typeof name !== "string") return null;
  const result = await pool.query(
    `SELECT id FROM partner_institution WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name.trim()],
  );
  return result.rows[0]?.id || null;
};

const getCohortIdByPartnerAndYear = async (partnerId, cohortLabel) => {
  if (!partnerId || !cohortLabel || typeof cohortLabel !== "string")
    return null;
  const yearMatch = cohortLabel.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);
  const result = await pool.query(
    `SELECT id FROM cohort WHERE partner_institution_id = $1 AND program_year = $2 LIMIT 1`,
    [partnerId, year],
  );
  return result.rows[0]?.id || null;
};

const resolveYouthIdentifiers = async (body) => {
  let partnerId = body.partner_institution_id;
  let cohortId = body.cohort_id;

  if (!partnerId && body.partner) {
    partnerId = await getPartnerIdByName(body.partner);
    if (!partnerId) {
      return { error: `Partner not found: ${body.partner}` };
    }
  }

  if (!cohortId && body.cohort) {
    if (!partnerId) {
      return {
        error: `Partner ID or partner name is required to resolve cohort`,
      };
    }
    cohortId = await getCohortIdByPartnerAndYear(partnerId, body.cohort);
    if (!cohortId) {
      return {
        error: `Cohort not found for partner '${body.partner || partnerId}' and cohort '${body.cohort}'`,
      };
    }
  }

  return { partnerId, cohortId };
};

const normalizeProgramType = (value) => {
  if (!value || typeof value !== "string") return null;
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, "");
  if (compact === "inschool") return "In-school";
  if (compact === "outofschool") return "Out-of-school";
  return null;
};

const syncYbfCohortsForPartner = async (userId, partnerId) => {
  const cohorts = await pool.query(
    `SELECT id FROM cohort WHERE partner_institution_id = $1`,
    [partnerId],
  );
  for (const row of cohorts.rows) {
    await pool.query(
      `INSERT INTO ybf_assignment (user_id, cohort_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, row.id],
    );
  }
};

const assignYbfToPartner = async (userId, partnerId) => {
  await pool.query(
    `INSERT INTO ybf_partner_assignment (user_id, partner_institution_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, partnerId],
  );
  await syncYbfCohortsForPartner(userId, partnerId);
};

const unassignYbfFromPartner = async (userId, partnerId) => {
  await pool.query(
    `DELETE FROM ybf_partner_assignment
     WHERE user_id = $1 AND partner_institution_id = $2`,
    [userId, partnerId],
  );
  await pool.query(
    `DELETE FROM ybf_assignment
     WHERE user_id = $1
       AND cohort_id IN (
         SELECT id FROM cohort WHERE partner_institution_id = $2
       )`,
    [userId, partnerId],
  );
};

const replacePartnerYbfAssignment = async (partnerId, newYbfId) => {
  const existing = await pool.query(
    `SELECT user_id FROM ybf_partner_assignment WHERE partner_institution_id = $1`,
    [partnerId],
  );
  for (const row of existing.rows) {
    if (newYbfId && String(row.user_id) === String(newYbfId)) continue;
    await unassignYbfFromPartner(row.user_id, partnerId);
  }
  if (newYbfId) {
    await assignYbfToPartner(newYbfId, partnerId);
  }
};

// Helper: get cohorts assigned to a user (YBF). Supports multiple institutions.
const getUserCohorts = async (userId) => {
  try {
    const cohortIds = new Set();

    const assignmentRes = await pool.query(
      `SELECT cohort_id FROM ybf_assignment WHERE user_id::text = $1::text`,
      [String(userId)],
    );
    assignmentRes.rows.forEach((r) => cohortIds.add(r.cohort_id));

    const partnerRes = await pool.query(
      `SELECT c.id
       FROM cohort c
       JOIN ybf_partner_assignment ypa
         ON ypa.partner_institution_id = c.partner_institution_id
       WHERE ypa.user_id::text = $1::text`,
      [String(userId)],
    );
    partnerRes.rows.forEach((r) => cohortIds.add(r.id));

    const userRes = await pool.query(
      `SELECT assigned_to FROM users WHERE id = $1`,
      [userId],
    );
    const assignedTo = userRes.rows[0]?.assigned_to;
    if (assignedTo) {
      const legacyRes = await pool.query(
        `SELECT id FROM cohort WHERE partner_institution_id = $1`,
        [assignedTo],
      );
      legacyRes.rows.forEach((r) => cohortIds.add(r.id));
    }

    return [...cohortIds];
  } catch (err) {
    console.error("getUserCohorts error:", err);
    return [];
  }
};

const getPartnerIdsForCohorts = async (cohortIds) => {
  if (!cohortIds || cohortIds.length === 0) return [];
  const res = await pool.query(
    `SELECT DISTINCT partner_institution_id FROM cohort WHERE id = ANY($1)`,
    [cohortIds],
  );
  return res.rows.map((r) => r.partner_institution_id);
};

const hasCohortAccess = (allowedCohorts, cohortId) =>
  allowedCohorts.map(String).includes(String(cohortId));

const ensureYbfCohortAccess = async (req, res, cohortId) => {
  if (!req.user || req.user.role !== "ybf") return true;
  const allowed = await getUserCohorts(req.user.id);
  const allowedIds = allowed.map(String);
  if (!allowedIds.includes(String(cohortId))) {
    res.status(403).json({ error: "You do not have access to this cohort" });
    return false;
  }
  return true;
};

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(
    token,
    process.env.JWT_SECRET || "wezesha_secret_key",
    (err, user) => {
      if (err) return res.status(403).json({ error: "Invalid token" });
      req.user = user;
      next();
    },
  );
};

// Role-based authorization middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

// Define role permissions
const PERMISSIONS = {
  admin: ["read", "write", "delete", "manage_users", "system_config"],
  program_manager: ["read", "write", "approve_records"],
  ybf: ["read_youth", "write_sessions", "write_case_notes"],
  instructor: ["read_sessions", "write_attendance"],
};

const generateRandomPassword = () => {
  const randomPart = Math.random().toString(36).slice(-8);
  const numericPart = Math.floor(100 + Math.random() * 900);
  return `${randomPart}${numericPart}`;
};

// Auth routes
app.post(
  "/api/auth/register",
  validateRequired(["name", "email", "password"]),
  async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
      const normalizedRole = normalizeUserRole(role || "ybf");
      const needsApproval =
        normalizedRole === "ybf" || normalizedRole === "instructor";
      const status = needsApproval ? "pending" : "active";
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, status, assigned_to",
        [name, email, hashedPassword, normalizedRole, status],
      );
      const user = result.rows[0];
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || "wezesha_secret_key",
      );
      res.status(201).json({
        user: {
          ...user,
          pendingApproval: isPendingApproval(user),
        },
        token,
      });
    } catch (err) {
      if (err.code === "23505") {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

app.post(
  "/api/auth/login",
  validateRequired(["email", "password"]),
  async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
      if (result.rows.length === 0)
        return res.status(400).json({ error: "User not found" });

      const user = result.rows[0];
      const statusMessage = getAccountStatusMessage(user.status || "active");
      if (statusMessage) {
        return res.status(403).json({ error: statusMessage });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword)
        return res.status(400).json({ error: "Invalid password" });

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || "wezesha_secret_key",
      );
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status || "active",
          assigned_to: user.assigned_to || null,
          pendingApproval: isPendingApproval(user),
        },
        token,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running" });
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, COALESCE(u.status, 'active') AS status,
              u.assigned_to, p.name AS assigned_partner_name
       FROM users u
       LEFT JOIN partner_institution p ON p.id = u.assigned_to
       WHERE u.id = $1`,
      [req.user.id],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result.rows[0];
    res.json({
      ...user,
      pendingApproval: isPendingApproval(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard — summary counts (scoped for YBF cohorts)
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const isYbf = req.user && req.user.role === "ybf";
    const allowedCohorts = isYbf ? await getUserCohorts(req.user.id) : null;

    if (isYbf && (!allowedCohorts || allowedCohorts.length === 0)) {
      return res.json({
        totalYouth: 0,
        totalPartners: 0,
        totalSessions: 0,
        avgSessionsPerYouth: 0,
        youthAt80Percent: 0,
        expectedSessionTotal: INSTITUTIONAL_SESSION_TOTAL,
        totalCases: 0,
        atRiskCount: 0,
        avgAttendance: null,
        outputProgress: {
          businessPlan: { completed: 0, inProgress: 0, notStarted: 0 },
          cv: { completed: 0, inProgress: 0, notStarted: 0 },
          applicationLetter: { completed: 0, inProgress: 0, notStarted: 0 },
        },
        sessionAttendance: [],
        cohorts: [],
        scoped: true,
      });
    }

    const cohortFilter = isYbf ? "AND y.cohort_id = ANY($1)" : "";
    const sessionCohortFilter = isYbf ? "WHERE s.cohort_id = ANY($1)" : "";
    const caseCohortFilter = isYbf ? "WHERE y.cohort_id = ANY($1)" : "";
    const params = isYbf ? [allowedCohorts] : [];

    const [
      youthRes,
      partnersRes,
      sessionsRes,
      casesRes,
      usersRes,
      pendingSyncsRes,
      atRiskRes,
      avgAttendanceRes,
      outputRes,
      sessionAttendanceRes,
      cohortsRes,
      avgSessionsRes,
      youth80Res,
      regionBreakdownRes,
      programBreakdownRes,
      yearBreakdownRes,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM youth y WHERE y.deleted_by IS NULL ${cohortFilter}`,
        params,
      ),
      isYbf
        ? pool.query(
            `SELECT COUNT(DISTINCT p.id) FROM partner_institution p
             JOIN cohort c ON c.partner_institution_id = p.id
             WHERE p.deleted_by IS NULL AND c.id = ANY($1)`,
            [allowedCohorts],
          )
        : pool.query(
            "SELECT COUNT(*) FROM partner_institution WHERE deleted_by IS NULL",
          ),
      pool.query(
        `SELECT COUNT(*) FROM session s ${sessionCohortFilter}`,
        isYbf ? [allowedCohorts] : [],
      ),
      pool.query(
        `SELECT COUNT(*) FROM case_note cn
         JOIN youth y ON y.id = cn.youth_id
         ${caseCohortFilter}`,
        isYbf ? [allowedCohorts] : [],
      ),
      isYbf
        ? Promise.resolve({ rows: [{ count: 0 }] })
        : pool.query("SELECT COUNT(*) FROM users"),
      pool.query(
        `SELECT COUNT(*) FROM youth y
         LEFT JOIN attendance_record a ON a.youth_id = y.id
         WHERE a.id IS NULL AND y.deleted_by IS NULL ${cohortFilter}`,
        params,
      ),
      pool.query(
        `SELECT COUNT(*) FROM (
           SELECT y.id,
                  CASE WHEN COUNT(a.id)=0 THEN 0 ELSE (COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100 END AS pct
           FROM youth y
           LEFT JOIN attendance_record a ON a.youth_id = y.id
           WHERE y.deleted_by IS NULL ${cohortFilter}
           GROUP BY y.id
         ) t
         WHERE t.pct < 70`,
        params,
      ),
      pool.query(
        `SELECT
           CASE WHEN COUNT(a.id)=0 THEN NULL ELSE (SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::float / COUNT(a.id)::float) * 100 END AS avg_attendance
         FROM attendance_record a
         JOIN youth y ON y.id = a.youth_id
         WHERE y.deleted_by IS NULL ${cohortFilter}`,
        params,
      ),
      isYbf
        ? pool.query(
            `SELECT milestone_type, status, COUNT(*) AS count
             FROM output_milestone om
             JOIN youth y ON y.id = om.youth_id
             WHERE y.deleted_by IS NULL AND y.cohort_id = ANY($1)
             GROUP BY milestone_type, status`,
            [allowedCohorts],
          )
        : Promise.resolve({ rows: [] }),
      isYbf
        ? pool.query(
            `SELECT s.id, s.topic, s.session_date,
                    CASE WHEN COUNT(a.id)=0 THEN 0 ELSE ROUND(((COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100)::numeric, 1) END AS attendance_pct
             FROM session s
             LEFT JOIN attendance_record a ON a.session_id = s.id
             WHERE s.cohort_id = ANY($1)
             GROUP BY s.id, s.topic, s.session_date
             ORDER BY s.session_date DESC
             LIMIT 6`,
            [allowedCohorts],
          )
        : Promise.resolve({ rows: [] }),
      isYbf
        ? pool.query(
            `SELECT c.id, c.program_year, p.name AS partner_name,
                    COUNT(DISTINCT y.id) AS youth_count
             FROM cohort c
             LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
             LEFT JOIN youth y ON y.cohort_id = c.id AND y.deleted_by IS NULL
             WHERE c.id = ANY($1)
             GROUP BY c.id, c.program_year, p.name
             ORDER BY c.program_year DESC`,
            [allowedCohorts],
          )
        : Promise.resolve({ rows: [] }),
      computeAvgSessionsPerYouth(cohortFilter, params),
      computeYouthAt80Percent(cohortFilter, params),
      pool.query(
        `SELECT COALESCE(y.region, p.region, 'Unassigned') AS label, COUNT(*) AS count
         FROM youth y
         LEFT JOIN partner_institution p ON p.id = y.partner_institution_id
         WHERE y.deleted_by IS NULL ${cohortFilter}
         GROUP BY COALESCE(y.region, p.region, 'Unassigned')
         ORDER BY count DESC`,
        params,
      ),
      pool.query(
        `SELECT COALESCE(y.program_type, 'Unassigned') AS label, COUNT(*) AS count
         FROM youth y
         WHERE y.deleted_by IS NULL ${cohortFilter}
         GROUP BY COALESCE(y.program_type, 'Unassigned')
         ORDER BY count DESC`,
        params,
      ),
      pool.query(
        `SELECT COALESCE(y.program_year::text, c.program_year::text, 'Unassigned') AS label, COUNT(*) AS count
         FROM youth y
         LEFT JOIN cohort c ON c.id = y.cohort_id
         WHERE y.deleted_by IS NULL ${cohortFilter}
         GROUP BY COALESCE(y.program_year::text, c.program_year::text, 'Unassigned')
         ORDER BY count DESC`,
        params,
      ),
    ]);

    const totalYouth = Number(youthRes.rows[0].count || 0);
    const totalPartners = Number(partnersRes.rows[0].count || 0);
    const totalSessions = Number(sessionsRes.rows[0].count || 0);
    const totalCases = Number(casesRes.rows[0].count || 0);
    const totalUsers = Number(usersRes.rows[0].count || 0);
    const pendingSyncs = Number(pendingSyncsRes.rows[0].count || 0);
    const atRiskCount = Number(atRiskRes.rows[0].count || 0);
    const avgSessionsPerYouth = Number(avgSessionsRes || 0);
    const youthAt80Percent = Number(youth80Res || 0);
    const avgAttendance =
      avgAttendanceRes.rows[0].avg_attendance !== null
        ? Number(avgAttendanceRes.rows[0].avg_attendance)
        : null;

    const mapBreakdown = (rows) =>
      rows.map((r) => ({
        label: r.label,
        count: Number(r.count || 0),
      }));

    const response = {
      totalYouth,
      totalPartners,
      totalSessions,
      avgSessionsPerYouth,
      youthAt80Percent,
      expectedSessionTotal: INSTITUTIONAL_SESSION_TOTAL,
      totalCases,
      totalUsers,
      pendingSyncs,
      atRiskCount,
      avgAttendance,
      filterBreakdown: {
        byRegion: mapBreakdown(regionBreakdownRes.rows),
        byProgramType: mapBreakdown(programBreakdownRes.rows),
        byYear: mapBreakdown(yearBreakdownRes.rows),
      },
    };

    if (isYbf) {
      const progress = {
        businessPlan: { completed: 0, inProgress: 0, notStarted: 0 },
        cv: { completed: 0, inProgress: 0, notStarted: 0 },
        applicationLetter: { completed: 0, inProgress: 0, notStarted: 0 },
      };
      const typeMap = {
        "Business Plan": "businessPlan",
        CV: "cv",
        "Application Letter": "applicationLetter",
        "Cover Letter": "applicationLetter",
      };
      for (const row of outputRes.rows) {
        const key = typeMap[row.milestone_type];
        if (!key) continue;
        const status = String(row.status || "Not Started");
        const count = Number(row.count || 0);
        if (status === "Completed") progress[key].completed += count;
        else if (status === "In Progress") progress[key].inProgress += count;
        else progress[key].notStarted += count;
      }
      response.outputProgress = progress;
      response.sessionAttendance = sessionAttendanceRes.rows.map((r) => ({
        session: r.topic,
        date: r.session_date,
        attendance: Number(r.attendance_pct || 0),
      }));
      response.cohorts = cohortsRes.rows.map((r) => ({
        id: r.id,
        label: r.partner_name
          ? `Cohort ${r.program_year} — ${r.partner_name}`
          : `Cohort ${r.program_year}`,
        youthCount: Number(r.youth_count || 0),
      }));
      response.scoped = true;
    }

    res.json(response);
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Partners
app.get(
  "/api/partners",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf", "instructor"),
  async (req, res) => {
    try {
      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) return res.json([]);
        const partnerIds = await getPartnerIdsForCohorts(allowed);
        if (!partnerIds.length) return res.json([]);
        const result = await pool.query(
          `SELECT p.*, COALESCE(c.cohort_count, 0) AS cohorts_count
           FROM partner_institution p
           LEFT JOIN (
             SELECT partner_institution_id, COUNT(*) AS cohort_count
             FROM cohort
             WHERE id = ANY($1)
             GROUP BY partner_institution_id
           ) c ON p.id = c.partner_institution_id
           WHERE p.deleted_by IS NULL AND p.id = ANY($2)
           ORDER BY p.name ASC`,
          [allowed, partnerIds],
        );
        return res.json(result.rows);
      }

      const result = await pool.query(
        `SELECT p.*, COALESCE(c.cohort_count, 0) AS cohorts_count,
                ybf.assigned_ybf_id,
                ybf.assigned_ybf_name,
                ybf.assigned_ybf_names
       FROM partner_institution p
       LEFT JOIN (
         SELECT partner_institution_id, COUNT(*) AS cohort_count
         FROM cohort
         GROUP BY partner_institution_id
       ) c ON p.id = c.partner_institution_id
       LEFT JOIN LATERAL (
         SELECT (array_agg(u.id ORDER BY u.name))[1] AS assigned_ybf_id,
                (array_agg(u.name ORDER BY u.name))[1] AS assigned_ybf_name,
                string_agg(u.name, ', ' ORDER BY u.name) AS assigned_ybf_names
         FROM ybf_partner_assignment ypa
         JOIN users u ON u.id = ypa.user_id AND u.role = 'ybf'
         WHERE ypa.partner_institution_id = p.id
       ) ybf ON true
       WHERE p.deleted_by IS NULL
       ORDER BY p.created_at DESC`,
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  "/api/cohorts",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf", "instructor"),
  async (req, res) => {
    try {
      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) return res.json([]);
        const result = await pool.query(
          `SELECT c.id, c.program_year, c.partner_institution_id, p.name AS partner_name
         FROM cohort c
         LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
         WHERE c.id = ANY($1)
         ORDER BY c.program_year DESC, p.name ASC`,
          [allowed],
        );
        const formatted = result.rows.map((row) => ({
          id: row.id,
          program_year: row.program_year,
          partner_name: row.partner_name,
          partner_institution_id: row.partner_institution_id,
          label: row.partner_name
            ? `Cohort ${row.program_year} — ${row.partner_name}`
            : `Cohort ${row.program_year}`,
        }));
        return res.json(formatted);
      }

      const result = await pool.query(
        `SELECT c.id, c.program_year, c.partner_institution_id, p.name AS partner_name
       FROM cohort c
       LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
       ORDER BY c.program_year DESC, p.name ASC`,
      );
      const formatted = result.rows.map((row) => ({
        id: row.id,
        program_year: row.program_year,
        partner_name: row.partner_name,
        partner_institution_id: row.partner_institution_id,
        label: row.partner_name
          ? `Cohort ${row.program_year} — ${row.partner_name}`
          : `Cohort ${row.program_year}`,
      }));
      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  "/api/personnel",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf", "instructor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, name, email, role, created_at FROM users WHERE role IN ('ybf', 'instructor') ORDER BY created_at DESC",
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/personnel",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  validateRequired(["name", "email", "role"]),
  async (req, res) => {
    const { name, email, role } = req.body;
    const normalizedRole = String(role).trim().toLowerCase();
    if (!["ybf", "instructor"].includes(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role for personnel" });
    }

    try {
      const password = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at",
        [name, email, hashedPassword, normalizedRole],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

app.put(
  "/api/personnel/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body;
    let normalizedRole = role;
    if (role) {
      normalizedRole = String(role).trim().toLowerCase();
      if (!["ybf", "instructor"].includes(normalizedRole)) {
        return res.status(400).json({ error: "Invalid role for personnel" });
      }
    }

    try {
      const result = await pool.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             role = COALESCE($3, role),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, name, email, role, created_at`,
        [name || null, email || null, normalizedRole || null, id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Personnel not found" });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

app.delete(
  "/api/personnel/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM users WHERE id = $1 RETURNING id",
        [id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Personnel not found" });
      res.json({ message: "Personnel deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Paginated list of at-risk youth
app.get(
  "/api/youth/at-risk",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const page = parseInt(req.query.page, 10) || 1;
      const offset = (page - 1) * limit;

      // Count youth whose computed attendance percentage is < 70
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM (
         SELECT y.id,
                CASE WHEN COUNT(a.id)=0 THEN 0 ELSE (COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100 END AS pct
         FROM youth y
         LEFT JOIN attendance_record a ON a.youth_id = y.id
         WHERE y.deleted_by IS NULL
         GROUP BY y.id
       ) t
       WHERE t.pct < 70`,
      );

      const rowsRes = await pool.query(
        `SELECT y.id, y.full_name, y.date_of_birth, y.gender, y.enrolment_date, y.partner_institution_id, y.cohort_id,
              p.name AS partner_name,
              CASE WHEN COUNT(a.id)=0 THEN 0 ELSE ROUND(((COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100)::numeric, 1) END AS attendance_pct
       FROM youth y
       LEFT JOIN attendance_record a ON a.youth_id = y.id
       LEFT JOIN partner_institution p ON p.id = y.partner_institution_id
       WHERE y.deleted_by IS NULL
       GROUP BY y.id, p.name
       HAVING CASE WHEN COUNT(a.id)=0 THEN 0 ELSE (COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100 END < 70
       ORDER BY y.enrolment_date DESC
       LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        total: Number(countRes.rows[0].count || 0),
        page,
        limit,
        rows: rowsRes.rows,
      });
    } catch (err) {
      console.error("At-risk query error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  "/api/export",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  async (req, res) => {
    try {
      const resource = (req.query.resource || "all").toString().toLowerCase();
      const workbook = new ExcelJS.Workbook();
      const datasets = [];

      const pushWorksheet = (name, rows) => {
        const sheet = workbook.addWorksheet(name);
        if (rows.length === 0) {
          sheet.addRow(["No data available"]);
          return;
        }
        const headers = Object.keys(rows[0]);
        sheet.columns = headers.map((header) => ({
          header,
          key: header,
          width: Math.max(12, header.length + 2),
        }));
        rows.forEach((row) => {
          sheet.addRow(headers.map((header) => row[header]));
        });
      };

      if (resource === "all" || resource === "youth") {
        const youthRes = await pool.query(
          "SELECT * FROM youth WHERE deleted_by IS NULL ORDER BY created_at DESC",
        );
        datasets.push({ name: "Youth", rows: youthRes.rows });
      }
      if (resource === "all" || resource === "partners") {
        const partnersRes = await pool.query(
          "SELECT * FROM partner_institution WHERE deleted_by IS NULL ORDER BY created_at DESC",
        );
        datasets.push({ name: "Partners", rows: partnersRes.rows });
      }
      if (resource === "all" || resource === "sessions") {
        const sessionsRes = await pool.query(
          "SELECT * FROM session ORDER BY session_date DESC",
        );
        datasets.push({ name: "Sessions", rows: sessionsRes.rows });
      }
      if (resource === "all" || resource === "reports") {
        const reportRes = await pool.query(`
        SELECT 
          s.id,
          s.session_date,
          s.topic,
          s.term_number,
          p.name AS partner_name,
          c.program_year AS cohort_year,
          COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present,
          COUNT(a.id) FILTER (WHERE a.status = 'Absent') AS absent,
          COUNT(a.id) FILTER (WHERE a.status = 'Excused') AS excused
        FROM session s
        LEFT JOIN cohort c ON c.id = s.cohort_id
        LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
        LEFT JOIN attendance_record a ON a.session_id = s.id
        GROUP BY s.id, s.session_date, s.topic, s.term_number, p.name, c.program_year
        ORDER BY s.session_date DESC
      `);
        datasets.push({ name: "Reports", rows: reportRes.rows });
      }
      if (resource === "all" || resource === "users") {
        const usersRes = await pool.query(
          "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC",
        );
        datasets.push({ name: "Users", rows: usersRes.rows });
      }

      if (datasets.length === 0) {
        return res
          .status(400)
          .json({ error: `Invalid export resource: ${resource}` });
      }

      datasets.forEach((dataset) => pushWorksheet(dataset.name, dataset.rows));
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="wezesha-${resource}-export.xlsx"`,
      );
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// Cleaned Kobo submissions can be uploaded by an administrator. Kobo Collect can
// post the same JSON to /api/kobo/submissions when KOBO_WEBHOOK_TOKEN is set.
const importKoboSubmissions = async (submissions, importedBy) => {
  if (!Array.isArray(submissions)) throw new Error("submissions must be an array");
  let imported = 0;
  const skipped = [];
  for (const submission of submissions) {
    const youthCode = submission.youth_code || submission.youthCode || submission._id;
    if (!youthCode) { skipped.push({ reason: "Missing youth_code" }); continue; }
    const youth = await pool.query(`SELECT id FROM youth WHERE youth_code = $1 AND deleted_by IS NULL`, [String(youthCode)]);
    if (!youth.rows[0]) { skipped.push({ youth_code: youthCode, reason: "Youth not found" }); continue; }
    const income = submission.current_income ?? submission.monthly_income ?? submission.income;
    if (income !== undefined && income !== null && income !== "") {
      await pool.query(`UPDATE youth SET current_income = $1, updated_at = NOW() WHERE id = $2`, [Number(income), youth.rows[0].id]);
    }
    const idea = submission.business_idea ?? submission.business_idea_generated ?? submission.has_business_idea;
    if (idea === true || String(idea).toLowerCase() === "yes") {
      const existing = await pool.query(`SELECT id FROM output_milestone WHERE youth_id = $1 AND milestone_type = 'Business Ideas' LIMIT 1`, [youth.rows[0].id]);
      if (existing.rows[0]) {
        await pool.query(`UPDATE output_milestone SET status = 'Completed', updated_at = NOW(), updated_by = $1 WHERE id = $2`, [importedBy || null, existing.rows[0].id]);
      } else {
        await pool.query(`INSERT INTO output_milestone (youth_id, milestone_type, status, updated_by) VALUES ($1, 'Business Ideas', 'Completed', $2)`, [youth.rows[0].id, importedBy || null]);
      }
    }
    imported += 1;
  }
  return { imported, skipped, received: submissions.length };
};

app.post("/api/import/kobo", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    res.json(await importKoboSubmissions(req.body.submissions || req.body.records, req.user.id));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/kobo/submissions", async (req, res) => {
  const token = req.get("x-kobo-webhook-token") || req.query.token;
  if (!process.env.KOBO_WEBHOOK_TOKEN || token !== process.env.KOBO_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: "Invalid Kobo webhook token" });
  }
  try {
    const rows = Array.isArray(req.body) ? req.body : (req.body.submissions || req.body.records || [req.body]);
    res.status(201).json(await importKoboSubmissions(rows, null));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Sessions with low attendance (paginated)
app.get(
  "/api/sessions/low-attendance",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf", "instructor"),
  async (req, res) => {
    try {
      const threshold = parseFloat(req.query.threshold) || 70;
      const limit = parseInt(req.query.limit, 10) || 10;
      const page = parseInt(req.query.page, 10) || 1;
      const offset = (page - 1) * limit;

      // Count of sessions below threshold
      const countQuery = `
      SELECT COUNT(*) FROM (
        SELECT s.id,
               COUNT(a.id) AS total,
               COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present
        FROM session s
        LEFT JOIN attendance_record a ON a.session_id = s.id
        GROUP BY s.id
      ) t
      WHERE CASE WHEN t.total = 0 THEN 0 ELSE (t.present::float / NULLIF(t.total,0)::float) * 100 END < $1
    `;

      const rowsQuery = `
      SELECT s.id, s.topic, s.session_date, p.name AS partner_name,
             COUNT(a.id) AS total,
             COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present,
             CASE WHEN COUNT(a.id)=0 THEN 0 ELSE ROUND(((COUNT(a.id) FILTER (WHERE a.status = 'Present')::float / NULLIF(COUNT(a.id),0)::float) * 100)::numeric, 1) END AS attendance_pct
      FROM session s
      LEFT JOIN attendance_record a ON a.session_id = s.id
      LEFT JOIN cohort c ON c.id = s.cohort_id
      LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
      GROUP BY s.id, p.name, s.session_date
      HAVING CASE WHEN COUNT(a.id)=0 THEN 0 ELSE (COUNT(a.id) FILTER (WHERE a.status = 'Present')::float / NULLIF(COUNT(a.id),0)::float) * 100 END < $1
      ORDER BY s.session_date DESC
      LIMIT $2 OFFSET $3
    `;

      // If requester is a YBF, restrict sessions to their cohorts
      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) {
          return res.json({ total: 0, page, limit, rows: [] });
        }
        const countQueryFiltered = `
      SELECT COUNT(*) FROM (
        SELECT s.id,
               COUNT(a.id) AS total,
               COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present
        FROM session s
        LEFT JOIN attendance_record a ON a.session_id = s.id
        WHERE s.cohort_id = ANY($2)
        GROUP BY s.id
      ) t
      WHERE CASE WHEN t.total = 0 THEN 0 ELSE (t.present::float / NULLIF(t.total,0)::float) * 100 END < $1
    `;

        const rowsQueryFiltered = `
      SELECT s.id, s.topic, s.session_date, p.name AS partner_name,
             COUNT(a.id) AS total,
             COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present,
             CASE WHEN COUNT(a.id)=0 THEN 0 ELSE ROUND(((COUNT(a.id) FILTER (WHERE a.status = 'Present')::float / NULLIF(COUNT(a.id),0)::float) * 100)::numeric, 1) END AS attendance_pct
      FROM session s
      LEFT JOIN attendance_record a ON a.session_id = s.id
      LEFT JOIN cohort c ON c.id = s.cohort_id
      LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
      WHERE s.cohort_id = ANY($4)
      GROUP BY s.id, p.name, s.session_date
      HAVING CASE WHEN COUNT(a.id)=0 THEN 0 ELSE (COUNT(a.id) FILTER (WHERE a.status = 'Present')::float / NULLIF(COUNT(a.id),0)::float) * 100 END < $1
      ORDER BY s.session_date DESC
      LIMIT $2 OFFSET $3
    `;

        const countRes = await pool.query(countQueryFiltered, [
          threshold,
          allowed,
        ]);
        const rowsRes = await pool.query(rowsQueryFiltered, [
          threshold,
          limit,
          offset,
          allowed,
        ]);

        return res.json({
          total: Number(countRes.rows[0].count || 0),
          page,
          limit,
          rows: rowsRes.rows,
        });
      }

      const countRes = await pool.query(countQuery, [threshold]);
      const rowsRes = await pool.query(rowsQuery, [threshold, limit, offset]);

      res.json({
        total: Number(countRes.rows[0].count || 0),
        page,
        limit,
        rows: rowsRes.rows,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/personnel",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  validateRequired(["name", "email", "role"]),
  async (req, res) => {
    const { name, email, role, assigned_to } = req.body;
    const normalizedRole = role?.toString().trim().toLowerCase();

    if (!["ybf", "instructor"].includes(normalizedRole)) {
      return res
        .status(400)
        .json({ error: "Role must be one of: ybf, instructor" });
    }

    try {
      const passwordHash = await bcrypt.hash(
        Math.random().toString(36).slice(-10) + "A1!",
        10,
      );
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at",
        [name, email, passwordHash, normalizedRole],
      );
      const created = result.rows[0];
      res.status(201).json({ ...created, assigned_to: assigned_to || null });
    } catch (err) {
      if (err.code === "23505") {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

app.post(
  "/api/partners",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  async (req, res) => {
    const {
      name,
      district,
      institution_type,
      type,
      location,
      region,
      program_type,
      programType,
      contact_name,
      contact_phone,
      contact_email,
      partnership_date,
      startDate,
      program_year,
      programYear,
      assigned_ybf_id,
      assignedYbfId,
    } = req.body;

    const partnerType = institution_type || type;
    const partnershipDate = partnership_date || startDate || null;
    const cohortYear = program_year ?? programYear;
    if (!name || !district || !partnerType) {
      return res.status(400).json({
        error: "Missing required fields: name, district, type",
      });
    }

    if (cohortYear !== undefined && cohortYear !== null && cohortYear !== "") {
      const year = Number(cohortYear);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({
          error: "Invalid program year for cohort (use 2000–2100)",
        });
      }
    }

    const partnerRegion = region || location || null;
    const partnerProgramType =
      normalizeProgramType(program_type || programType) || "In-school";

    try {
      const result = await pool.query(
        `INSERT INTO partner_institution (name, district, type, location, region, program_type, contact_name, contact_phone, contact_email, partnership_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          name,
          district,
          partnerType,
          partnerRegion,
          partnerRegion,
          partnerProgramType,
          contact_name,
          contact_phone,
          contact_email,
          partnershipDate,
        ],
      );
      const partner = result.rows[0];

      const assignedYbf = assigned_ybf_id ?? assignedYbfId ?? null;
      if (assignedYbf) {
        const ybfUser = await pool.query(
          `SELECT id, role FROM users WHERE id::text = $1::text`,
          [String(assignedYbf)],
        );
        if (!ybfUser.rows[0]) {
          return res.status(400).json({ error: "Assigned YBF user not found" });
        }
        if (String(ybfUser.rows[0].role).toLowerCase() !== "ybf") {
          return res.status(400).json({ error: "Assigned user must be a YBF" });
        }
        await assignYbfToPartner(String(assignedYbf), partner.id);
      }

      if (
        cohortYear !== undefined &&
        cohortYear !== null &&
        cohortYear !== ""
      ) {
        const year = Number(cohortYear);
        const existingCohort = await pool.query(
          `SELECT id FROM cohort WHERE partner_institution_id = $1 AND program_year = $2 LIMIT 1`,
          [partner.id, year],
        );
        if (!existingCohort.rows[0]) {
          await pool.query(
            `INSERT INTO cohort (partner_institution_id, program_year) VALUES ($1, $2)`,
            [partner.id, year],
          );
        }
      }

      if (assignedYbf) {
        await syncYbfCohortsForPartner(String(assignedYbf), partner.id);
      }

      res.status(201).json(partner);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/partners/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  async (req, res) => {
    const { id } = req.params;
    const {
      name,
      district,
      institution_type,
      type,
      location,
      region,
      program_type,
      programType,
      contact_name,
      contact_phone,
      contact_email,
      partnership_date,
      startDate,
      status,
      assigned_ybf_id,
      assignedYbfId,
    } = req.body;

    const partnerType = institution_type || type;
    const partnershipDate = partnership_date || startDate || null;

    const partnerRegion = region || location || null;
    const partnerProgramType =
      program_type || programType
        ? normalizeProgramType(program_type || programType)
        : null;

    try {
      const result = await pool.query(
        `UPDATE partner_institution 
       SET name = $1, district = $2, type = $3, location = $4, region = COALESCE($5, region),
           program_type = COALESCE($6, program_type),
           contact_name = $7, contact_phone = $8, contact_email = $9, partnership_date = $10, status = $11, updated_at = NOW()
       WHERE id = $12 AND deleted_by IS NULL RETURNING *`,
        [
          name,
          district,
          partnerType,
          partnerRegion,
          partnerRegion,
          partnerProgramType,
          contact_name,
          contact_phone,
          contact_email,
          partnershipDate,
          status,
          id,
        ],
      );

      if (result.rows.length === 0)
        return res.status(404).json({ error: "Partner not found" });

      const partner = result.rows[0];
      const assignedYbf = assigned_ybf_id ?? assignedYbfId;
      if (assignedYbf !== undefined) {
        if (assignedYbf) {
          const ybfUser = await pool.query(
            `SELECT id, role FROM users WHERE id::text = $1::text`,
            [String(assignedYbf)],
          );
          if (!ybfUser.rows[0]) {
            return res
              .status(400)
              .json({ error: "Assigned YBF user not found" });
          }
          if (String(ybfUser.rows[0].role).toLowerCase() !== "ybf") {
            return res
              .status(400)
              .json({ error: "Assigned user must be a YBF" });
          }
        }
        await replacePartnerYbfAssignment(id, assignedYbf || null);
      }

      res.json(partner);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/partners/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `UPDATE partner_institution
         SET deleted_by = $1, deleted_at = NOW()
         WHERE id = $2 AND deleted_by IS NULL
         RETURNING id`,
        [req.user.id, id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Partner not found" });
      }
      await pool.query(
        `DELETE FROM ybf_partner_assignment WHERE partner_institution_id = $1`,
        [id],
      );
      res.json({ message: "Partner deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Youth
app.get(
  "/api/youth",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf", "instructor"),
  async (req, res) => {
    try {
      const {
        region,
        program_type,
        programType,
        program_year,
        programYear,
        roster_year,
        rosterYear,
      } = req.query;
      const filters = [];
      const filterParams = [];
      const addFilter = (clause, value) => {
        filterParams.push(value);
        filters.push(clause.replace("$X", `$${filterParams.length}`));
      };
      if (region && region !== "all")
        addFilter(` AND COALESCE(y.region, p.region) = $X`, region);
      if (program_type || programType) {
        addFilter(` AND y.program_type = $X`, program_type || programType);
      }
      if (program_year || programYear) {
        addFilter(
          ` AND COALESCE(y.program_year, c.program_year) = $X`,
          Number(program_year || programYear),
        );
      }
      if (roster_year || rosterYear) {
        addFilter(
          ` AND COALESCE(y.roster_year, 1) = $X`,
          Number(roster_year || rosterYear),
        );
      }
      const extraFilter = filters.join("");

      // If the user is a YBF, scope youth to their assigned cohorts
      const youthSelect = `
        SELECT y.id, y.full_name, y.date_of_birth, y.gender,
               y.district_of_residence AS district, y.partner_institution_id,
               y.cohort_id, y.program_type, y.program_year, y.region, y.nationality,
               y.disability, y.course, y.employment_status, y.roster_year, y.school_name,
               y.baseline_income, y.current_income, y.has_business, y.above_ipl,
               y.created_at, y.updated_at, y.deleted_at, y.deleted_by, y.created_by, y.youth_code,
               p.name AS partner_name, p.region AS partner_region,
               c.program_year AS cohort_year,
               CASE WHEN COUNT(a.id)=0 THEN 0
                    ELSE ROUND(((COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100)::numeric, 1)
               END AS attendance_rate,
               EXISTS (
                 SELECT 1 FROM case_note cn
                 WHERE cn.youth_id = y.id AND cn.category = 'At-Risk Flag'
               ) AS risk_flag
        FROM youth y
        LEFT JOIN partner_institution p ON p.id = y.partner_institution_id
        LEFT JOIN cohort c ON c.id = y.cohort_id
        LEFT JOIN attendance_record a ON a.youth_id = y.id
        WHERE y.deleted_by IS NULL`;

      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) {
          return res.json([]);
        }
        const result = await pool.query(
          `${youthSelect} AND y.cohort_id = ANY($${filterParams.length + 1})${extraFilter}
           GROUP BY y.id, p.name, p.region, c.program_year
           ORDER BY y.full_name ASC`,
          [...filterParams, allowed],
        );
        return res.json(result.rows);
      }

      if (req.user && req.user.role === "instructor") {
        const partnerIds = await getInstructorPartnerIds(req.user.id);
        if (!partnerIds.length) return res.json([]);
        const result = await pool.query(
          `${youthSelect} AND y.partner_institution_id = ANY($${filterParams.length + 1})${extraFilter}
           GROUP BY y.id, p.name, p.region, c.program_year
           ORDER BY y.full_name ASC`,
          [...filterParams, partnerIds],
        );
        return res.json(result.rows);
      }

      const managementScope = await getManagementScope(req.user);
      if (managementScope) {
        const clauses = [];
        const params = [...filterParams];
        if (managementScope.programType) {
          params.push(managementScope.programType);
          clauses.push(`y.program_type = $${params.length}`);
        }
        if (managementScope.regions) {
          params.push(managementScope.regions);
          clauses.push(`COALESCE(y.region, p.region) = ANY($${params.length})`);
        }
        const scopedWhere = clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
        const result = await pool.query(
          `${youthSelect}${scopedWhere}${extraFilter}
           GROUP BY y.id, p.name, p.region, c.program_year
           ORDER BY y.created_at DESC`, params,
        );
        return res.json(result.rows);
      }

      const result = await pool.query(
        `${youthSelect}${extraFilter}
         GROUP BY y.id, p.name, p.region, c.program_year
         ORDER BY y.created_at DESC`,
        filterParams,
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/youth",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  validateRequired(["full_name", "date_of_birth", "gender", "district"]),
  async (req, res) => {
    const {
      full_name,
      date_of_birth,
      gender,
      district,
      partner_institution_id,
      cohort_id,
      program_type,
      programType,
      nationality,
      region,
      disability,
      course,
      employment_status,
      employmentStatus,
      roster_year,
      rosterYear,
      school_name,
      schoolName,
    } = req.body;

    if (!full_name || !date_of_birth || !gender || !district) {
      return res.status(400).json({
        error:
          "Missing required fields: full_name, date_of_birth, gender, district",
      });
    }

    if (!partner_institution_id && !req.body.partner) {
      return res
        .status(400)
        .json({ error: "partner_institution_id or partner is required" });
    }
    if (!cohort_id && !req.body.cohort) {
      return res.status(400).json({ error: "cohort_id or cohort is required" });
    }

    try {
      const { partnerId, cohortId, error } = await resolveYouthIdentifiers(
        req.body,
      );
      if (error) return res.status(400).json({ error });
      if (!partnerId || !cohortId) {
        return res
          .status(400)
          .json({ error: "partner_institution_id and cohort_id are required" });
      }

      if (!(await ensureYbfCohortAccess(req, res, cohortId))) return;

      const rawProgramType = program_type || programType;
      const resolvedProgramType = rawProgramType
        ? normalizeProgramType(rawProgramType)
        : "In-school";
      if (!resolvedProgramType) {
        return res.status(400).json({
          error: "Invalid program type. Use In-school or Out-of-school.",
        });
      }

      const cohortRes = await pool.query(
        `SELECT program_year FROM cohort WHERE id = $1 LIMIT 1`,
        [cohortId],
      );
      const programYear = cohortRes.rows[0]?.program_year;
      if (!programYear) {
        return res.status(400).json({ error: "Invalid cohort selected" });
      }

      const resolvedRosterYear = Number(roster_year ?? rosterYear ?? 1) || 1;

      // Retry logic for youth_code unique constraint violations
      let result;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          result = await pool.query(
            `INSERT INTO youth (full_name, date_of_birth, gender, district_of_residence, partner_institution_id, cohort_id, program_type, program_year, nationality, region, disability, course, employment_status, roster_year, school_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [
              full_name,
              date_of_birth,
              gender,
              district,
              partnerId,
              cohortId,
              resolvedProgramType,
              programYear,
              nationality || null,
              region || null,
              disability || null,
              course || null,
              employment_status || employmentStatus || null,
              resolvedRosterYear,
              school_name || schoolName || null,
            ],
          );
          break; // Success, exit retry loop
        } catch (insertErr) {
          // Check if it's a unique constraint violation on youth_code
          if (insertErr.code === '23505' && insertErr.constraint === 'youth_youth_code_key') {
            retryCount++;
            if (retryCount >= maxRetries) {
              throw new Error(`Failed to generate unique youth code after ${maxRetries} attempts. Please try again.`);
            }
            // Advance sequence and try again by allowing the database to generate a new code
            await pool.query('SELECT nextval(\'youth_code_seq\'::regclass)');
            continue;
          }
          throw insertErr;
        }
      }
      
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);
app.put(
  "/api/youth/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  async (req, res) => {
    const { id } = req.params;
    const {
      full_name,
      date_of_birth,
      gender,
      district,
      partner_institution_id,
      cohort_id,
      partner,
      cohort,
      program_type,
      nationality,
      region,
      disability,
      course,
      employment_status,
      employmentStatus,
      roster_year,
      rosterYear,
      school_name,
      schoolName,
    } = req.body;

    try {
      const existing = await pool.query(
        `SELECT partner_institution_id, cohort_id FROM youth WHERE id = $1 AND deleted_by IS NULL`,
        [id],
      );
      if (existing.rows.length === 0)
        return res.status(404).json({ error: "Youth not found" });

      let resolvedPartnerId =
        partner_institution_id || existing.rows[0].partner_institution_id;
      if (!resolvedPartnerId && partner) {
        resolvedPartnerId = await getPartnerIdByName(partner);
        if (!resolvedPartnerId)
          return res
            .status(400)
            .json({ error: `Partner not found: ${partner}` });
      }

      let resolvedCohortId = cohort_id || existing.rows[0].cohort_id;
      if (!resolvedCohortId && cohort) {
        if (!resolvedPartnerId) {
          return res.status(400).json({
            error:
              "Partner or partner_institution_id is required to resolve cohort",
          });
        }
        resolvedCohortId = await getCohortIdByPartnerAndYear(
          resolvedPartnerId,
          cohort,
        );
        if (!resolvedCohortId) {
          return res.status(400).json({
            error: `Cohort not found for partner '${partner || resolvedPartnerId}' and cohort '${cohort}'`,
          });
        }
      }

      if (!(await ensureYbfCohortAccess(req, res, resolvedCohortId))) return;

      let programYear = null;
      if (resolvedCohortId) {
        const cohortRes = await pool.query(
          `SELECT program_year FROM cohort WHERE id = $1 LIMIT 1`,
          [resolvedCohortId],
        );
        programYear = cohortRes.rows[0]?.program_year || null;
      }

      let resolvedProgramType =
        typeof program_type === "string"
          ? normalizeProgramType(program_type)
          : existing.rows[0]?.program_type;
      if (typeof program_type === "string" && !resolvedProgramType) {
        return res.status(400).json({
          error: "Invalid program type. Use In-school or Out-of-school.",
        });
      }
      if (!resolvedProgramType) resolvedProgramType = "In-school";

      const result = await pool.query(
        `UPDATE youth 
       SET full_name = $1, date_of_birth = $2, gender = $3, district_of_residence = $4, partner_institution_id = $5, cohort_id = $6, program_type = $7, program_year = $8,
           nationality = COALESCE($9, nationality), region = COALESCE($10, region),
           disability = COALESCE($11, disability), course = COALESCE($12, course),
           employment_status = COALESCE($13, employment_status),
           roster_year = COALESCE($14, roster_year),
           school_name = COALESCE($15, school_name),
           updated_at = NOW()
       WHERE id = $16 AND deleted_by IS NULL RETURNING *`,
        [
          full_name,
          date_of_birth,
          gender,
          district,
          resolvedPartnerId,
          resolvedCohortId,
          resolvedProgramType,
          programYear,
          nationality ?? null,
          region ?? null,
          disability ?? null,
          course ?? null,
          employment_status || employmentStatus || null,
          roster_year ?? rosterYear ?? null,
          school_name || schoolName || null,
          id,
        ],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Youth not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update youth error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/youth/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "UPDATE youth SET deleted_by = $1, deleted_at = NOW() WHERE id = $2 AND deleted_by IS NULL RETURNING *",
        [req.user.id, id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Youth not found" });
      res.json({ message: "Youth deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);
// Sessions
app.get(
  "/api/sessions",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf", "instructor"),
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE session SET is_locked = true
         WHERE data_entry_deadline IS NOT NULL
           AND data_entry_deadline < CURRENT_DATE
           AND is_locked = false`,
      );
      const baseQuery = `
        SELECT s.*, p.name AS partner_name, CONCAT('Term ', s.term_number) AS term,
               COUNT(a.id) FILTER (WHERE a.status = 'Present') AS attendance_count,
               (SELECT COUNT(*) FROM youth y WHERE y.cohort_id = s.cohort_id AND y.deleted_by IS NULL) AS total_youth
        FROM session s
        LEFT JOIN cohort c ON c.id = s.cohort_id
        LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
        LEFT JOIN attendance_record a ON a.session_id = s.id`;

      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) return res.json([]);
        const result = await pool.query(
          `${baseQuery}
           WHERE s.cohort_id = ANY($1)
           GROUP BY s.id, p.name
           ORDER BY s.session_date DESC`,
          [allowed],
        );
        return res.json(result.rows.map(enrichSessionRow));
      }

      if (req.user && req.user.role === "instructor") {
        const partnerIds = await getInstructorPartnerIds(req.user.id);
        if (!partnerIds.length) return res.json([]);
        const result = await pool.query(
          `${baseQuery}
           WHERE c.partner_institution_id = ANY($1)
           GROUP BY s.id, p.name
           ORDER BY s.session_date DESC`,
          [partnerIds],
        );
        return res.json(result.rows.map(enrichSessionRow));
      }

      const managementScope = await getManagementScope(req.user);
      if (managementScope) {
        const clauses = [];
        const params = [];
        if (managementScope.programType) {
          params.push(managementScope.programType);
          clauses.push(`EXISTS (SELECT 1 FROM youth sy WHERE sy.cohort_id = s.cohort_id AND sy.deleted_by IS NULL AND sy.program_type = $${params.length})`);
        }
        if (managementScope.regions) {
          params.push(managementScope.regions);
          clauses.push(`p.region = ANY($${params.length})`);
        }
        const result = await pool.query(
          `${baseQuery}
           WHERE ${clauses.join(" AND ")}
           GROUP BY s.id, p.name
           ORDER BY s.session_date DESC`, params,
        );
        return res.json(result.rows.map(enrichSessionRow));
      }

      const result = await pool.query(
        `${baseQuery}
         GROUP BY s.id, p.name
         ORDER BY s.session_date DESC`,
      );
      res.json(result.rows.map(enrichSessionRow));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/sessions",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  validateRequired(["cohort_id", "topic", "session_date"]),
  async (req, res) => {
    const {
      cohort_id,
      topic,
      session_date,
      venue,
      term_number,
      session_number,
    } = req.body;
    try {
      if (!cohort_id) {
        return res.status(400).json({ error: "cohort_id is required" });
      }

      if (req.user && req.user.role === "ybf") {
        if (!(await ensureYbfCohortAccess(req, res, cohort_id))) return;
      }

      const scheduleCheck = validateSessionSchedule(session_date);
      if (!scheduleCheck.ok) {
        return res.status(400).json({ error: scheduleCheck.error });
      }

      const dataEntryDeadline = addDays(session_date, DATA_ENTRY_DAYS);

      const resolvedTerm = Number(term_number) > 0 ? Number(term_number) : 1;
      const resolvedSessionNumber =
        Number(session_number) > 0 ? Number(session_number) : 1;

      const insertResult = await pool.query(
        `INSERT INTO session (cohort_id, topic, session_date, venue, term_number, session_number, data_entry_deadline, is_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING *`,
        [
          cohort_id,
          String(topic).trim(),
          session_date,
          venue || null,
          resolvedTerm,
          resolvedSessionNumber,
          dataEntryDeadline,
        ],
      );

      const enriched = await pool.query(
        `SELECT s.*, p.name AS partner_name, CONCAT('Term ', s.term_number) AS term,
                (SELECT COUNT(*) FROM youth y WHERE y.cohort_id = s.cohort_id AND y.deleted_by IS NULL) AS total_youth,
                0 AS attendance_count
         FROM session s
         LEFT JOIN cohort c ON c.id = s.cohort_id
         LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
         WHERE s.id = $1`,
        [insertResult.rows[0].id],
      );

      res
        .status(201)
        .json(enrichSessionRow(enriched.rows[0] || insertResult.rows[0]));
    } catch (err) {
      if (err.code === "23505") {
        return res.status(400).json({
          error:
            "A session with this number already exists for this cohort and term.",
        });
      }
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/sessions/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  async (req, res) => {
    const { id } = req.params;
    const {
      cohort_id,
      topic,
      session_date,
      venue,
      term_number,
      session_number,
    } = req.body;
    try {
      const result = await pool.query(
        `UPDATE session 
       SET cohort_id = $1, topic = $2, session_date = $3, venue = $4, term_number = $5, session_number = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
        [
          cohort_id,
          topic,
          session_date,
          venue,
          term_number,
          session_number,
          id,
        ],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Session not found" });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/sessions/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM session WHERE id = $1 RETURNING *",
        [id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Session not found" });
      res.json({ message: "Session deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Cases (case_note)
app.get(
  "/api/cases",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  async (req, res) => {
    try {
      const baseQuery = `
        SELECT cn.*, y.full_name AS youth_name, u.name AS author_name
        FROM case_note cn
        LEFT JOIN youth y ON y.id = cn.youth_id
        LEFT JOIN users u ON u.id = cn.author_id`;

      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) return res.json([]);
        const result = await pool.query(
          `${baseQuery}
           WHERE y.cohort_id = ANY($1)
           ORDER BY cn.created_at DESC`,
          [allowed],
        );
        return res.json(result.rows);
      }

      const result = await pool.query(
        `${baseQuery}
         ORDER BY cn.created_at DESC`,
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/cases",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  validateRequired(["youth_id", "category", "note_text"]),
  async (req, res) => {
    const { youth_id, category, note_text, follow_up_due } = req.body;
    const follow_up_required =
      typeof req.body.follow_up_required === "boolean"
        ? req.body.follow_up_required
        : false;
    try {
      if (req.user && req.user.role === "ybf") {
        const youthRes = await pool.query(
          `SELECT cohort_id FROM youth WHERE id = $1 AND deleted_by IS NULL`,
          [youth_id],
        );
        if (!youthRes.rows[0]) {
          return res.status(404).json({ error: "Youth not found" });
        }
        const allowed = await getUserCohorts(req.user.id);
        if (!hasCohortAccess(allowed, youthRes.rows[0].cohort_id)) {
          return res
            .status(403)
            .json({ error: "You do not have access to this youth" });
        }
      }

      const result = await pool.query(
        `INSERT INTO case_note (youth_id, author_id, category, note_text, follow_up_due, follow_up_required)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          youth_id,
          req.user.id,
          category,
          note_text,
          follow_up_due ?? null,
          follow_up_required,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/cases/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf"),
  async (req, res) => {
    const { id } = req.params;
    const { category, note_text, follow_up_due, follow_up_required, is_done } =
      req.body;
    try {
      const result = await pool.query(
        `UPDATE case_note 
       SET category = COALESCE($1, category), note_text = COALESCE($2, note_text),
           follow_up_due = COALESCE($3, follow_up_due),
           follow_up_required = COALESCE($4, follow_up_required),
           is_done = COALESCE($5, is_done), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
        [
          category,
          note_text,
          follow_up_due,
          follow_up_required,
          typeof is_done === "boolean" ? is_done : null,
          id,
        ],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Case note not found" });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/cases/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM case_note WHERE id = $1 RETURNING *",
        [id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Case note not found" });
      res.json({ message: "Case note deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Outcomes (output_milestone)
app.get(
  "/api/outcomes",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf"),
  async (req, res) => {
    try {
      const baseQuery = `
        SELECT om.*, y.full_name AS youth_name, y.cohort_id
        FROM output_milestone om
        JOIN youth y ON y.id = om.youth_id
        WHERE y.deleted_by IS NULL`;

      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) return res.json([]);
        const result = await pool.query(
          `${baseQuery} AND y.cohort_id = ANY($1)
           ORDER BY om.updated_at DESC NULLS LAST, om.id DESC`,
          [allowed],
        );
        return res.json(result.rows);
      }

      const result = await pool.query(
        `${baseQuery}
         ORDER BY om.id DESC`,
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/outcomes",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf"),
  validateRequired(["youth_id", "milestone_type", "status"]),
  async (req, res) => {
    const { youth_id, status } = req.body;
    const milestone_type = ["Business Plan", "Application Letter", "Cover Letter", "Business Plan & Application Letter"].includes(req.body.milestone_type)
      ? "Application Letter & Business Plan" : req.body.milestone_type;
    try {
      if (req.user && req.user.role === "ybf") {
        const youthRes = await pool.query(
          `SELECT cohort_id FROM youth WHERE id = $1 AND deleted_by IS NULL`,
          [youth_id],
        );
        if (!youthRes.rows[0]) {
          return res.status(404).json({ error: "Youth not found" });
        }
        const allowed = await getUserCohorts(req.user.id);
        if (!hasCohortAccess(allowed, youthRes.rows[0].cohort_id)) {
          return res
            .status(403)
            .json({ error: "You do not have access to this youth" });
        }
      }

      const existing = await pool.query(
        `SELECT id FROM output_milestone WHERE youth_id = $1 AND milestone_type = $2 LIMIT 1`,
        [youth_id, milestone_type],
      );

      if (existing.rows[0]) {
        const result = await pool.query(
          `UPDATE output_milestone
           SET status = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [status, existing.rows[0].id],
        );
        return res.json(result.rows[0]);
      }

      const result = await pool.query(
        `INSERT INTO output_milestone (youth_id, milestone_type, status)
         VALUES ($1, $2, $3) RETURNING *`,
        [youth_id, milestone_type, status],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/outcomes/:id",
  authenticateToken,
  authorizeRoles(...MANAGEMENT_ROLES, "ybf"),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const milestone_type = ["Business Plan", "Application Letter", "Cover Letter", "Business Plan & Application Letter"].includes(req.body.milestone_type)
      ? "Application Letter & Business Plan" : req.body.milestone_type;
    try {
      if (req.user && req.user.role === "ybf") {
        const accessRes = await pool.query(
          `SELECT y.cohort_id FROM output_milestone om
           JOIN youth y ON y.id = om.youth_id
           WHERE om.id = $1`,
          [id],
        );
        if (!accessRes.rows[0]) {
          return res.status(404).json({ error: "Output milestone not found" });
        }
        const allowed = await getUserCohorts(req.user.id);
        if (!hasCohortAccess(allowed, accessRes.rows[0].cohort_id)) {
          return res
            .status(403)
            .json({ error: "You do not have access to this record" });
        }
      }

      const result = await pool.query(
        `UPDATE output_milestone 
       SET milestone_type = COALESCE($1, milestone_type), status = COALESCE($2, status), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
        [milestone_type, status, id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Output milestone not found" });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/outcomes/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM output_milestone WHERE id = $1 RETURNING *",
        [id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Output milestone not found" });
      res.json({ message: "Output milestone deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Reports — attendance summary
app.get("/api/reports", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.session_date,
        s.topic,
        s.term_number,
        p.name AS partner_name,
        c.program_year AS cohort_year,
        COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present,
        COUNT(a.id) FILTER (WHERE a.status = 'Absent') AS absent,
        COUNT(a.id) FILTER (WHERE a.status = 'Excused') AS excused
      FROM session s
      LEFT JOIN cohort c ON c.id = s.cohort_id
      LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
      LEFT JOIN attendance_record a ON a.session_id = s.id
      GROUP BY s.id, s.session_date, s.topic, s.term_number, p.name, c.program_year
      ORDER BY s.session_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance
app.get(
  "/api/attendance",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf", "instructor"),
  async (req, res) => {
    try {
      const baseQuery = `
        SELECT a.*, s.topic, s.session_date, s.cohort_id, y.full_name AS youth_name
        FROM attendance_record a
        JOIN session s ON a.session_id = s.id
        JOIN youth y ON a.youth_id = y.id`;

      if (req.user && req.user.role === "ybf") {
        const allowed = await getUserCohorts(req.user.id);
        if (!allowed || allowed.length === 0) return res.json([]);
        const result = await pool.query(
          `${baseQuery}
           WHERE s.cohort_id = ANY($1)
           ORDER BY s.session_date DESC, y.full_name`,
          [allowed],
        );
        return res.json(result.rows);
      }

      const result = await pool.query(
        `${baseQuery}
         ORDER BY s.session_date DESC, y.full_name`,
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/attendance",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf", "instructor"),
  validateRequired(["session_id", "youth_id", "status"]),
  async (req, res) => {
    const { session_id, youth_id, status } = req.body;
    try {
      const lockError = await assertSessionUnlocked(session_id, req.user?.role);
      if (lockError) return res.status(403).json({ error: lockError });

      if (req.user && req.user.role === "ybf") {
        const sessionRes = await pool.query(
          `SELECT cohort_id FROM session WHERE id = $1`,
          [session_id],
        );
        if (!sessionRes.rows[0]) {
          return res.status(404).json({ error: "Session not found" });
        }
        if (
          !(await ensureYbfCohortAccess(req, res, sessionRes.rows[0].cohort_id))
        ) {
          return;
        }
      }

      const existing = await pool.query(
        `SELECT id FROM attendance_record WHERE session_id = $1 AND youth_id = $2`,
        [session_id, youth_id],
      );
      if (existing.rows[0]) {
        const result = await pool.query(
          `UPDATE attendance_record SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [status, existing.rows[0].id],
        );
        return res.json(result.rows[0]);
      }

      const result = await pool.query(
        `INSERT INTO attendance_record (session_id, youth_id, status)
         VALUES ($1, $2, $3) RETURNING *`,
        [session_id, youth_id, status],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/attendance/bulk",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf", "instructor"),
  validateRequired(["records"]),
  async (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res
        .status(400)
        .json({ error: "records must be a non-empty array" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const saved = [];

      for (const record of records) {
        const { session_id, youth_id, status } = record;
        if (!session_id || !youth_id || !status) {
          throw new Error(
            "Each record requires session_id, youth_id, and status",
          );
        }

        const lockError = await assertSessionUnlocked(
          session_id,
          req.user?.role,
        );
        if (lockError) throw new Error(lockError);

        if (req.user && req.user.role === "ybf") {
          const sessionRes = await client.query(
            `SELECT cohort_id FROM session WHERE id = $1`,
            [session_id],
          );
          if (!sessionRes.rows[0]) {
            throw new Error(`Session not found: ${session_id}`);
          }
          const allowed = await getUserCohorts(req.user.id);
          if (!hasCohortAccess(allowed, sessionRes.rows[0].cohort_id)) {
            throw new Error("You do not have access to one or more sessions");
          }
        }

        const existing = await client.query(
          `SELECT id FROM attendance_record WHERE session_id = $1 AND youth_id = $2`,
          [session_id, youth_id],
        );

        if (existing.rows[0]) {
          const updated = await client.query(
            `UPDATE attendance_record SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, existing.rows[0].id],
          );
          saved.push(updated.rows[0]);
        } else {
          const inserted = await client.query(
            `INSERT INTO attendance_record (session_id, youth_id, status)
             VALUES ($1, $2, $3) RETURNING *`,
            [session_id, youth_id, status],
          );
          saved.push(inserted.rows[0]);
        }
      }

      await client.query("COMMIT");
      res.json({
        message: "Attendance saved",
        count: saved.length,
        records: saved,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },
);

app.put(
  "/api/attendance/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager", "ybf", "instructor"),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const result = await pool.query(
        "UPDATE attendance_record SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Attendance record not found" });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// User management (admin and program manager)
app.get(
  "/api/users",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  async (req, res) => {
    const { page = 1, limit = 10, q } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const lim = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * lim;
    try {
      let where = "";
      const params = [];
      if (q) {
        params.push(`%${q}%`);
        params.push(`%${q}%`);
        where = `WHERE name ILIKE $${params.length - 1} OR email ILIKE $${params.length}`;
      }

      const dataQuery = `SELECT id, name, email, role, COALESCE(status, 'active') AS status, assigned_to, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(lim, offset);

      const result = await pool.query(dataQuery, params);

      // total count
      let countQuery = "SELECT COUNT(*) FROM users";
      if (q) countQuery += ` WHERE name ILIKE $1 OR email ILIKE $2`;
      const countResult = q
        ? await pool.query(countQuery, [`%${q}%`, `%${q}%`])
        : await pool.query(countQuery);
      const total = parseInt(countResult.rows[0].count, 10) || 0;

      res.json({ rows: result.rows, total, page: pageNum, limit: lim });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/users/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  async (req, res) => {
    const { id } = req.params;
    const { name, email, role, status, assigned_to, assignedTo, assigned_regions, assignedRegions } = req.body;
    try {
      if (status && !USER_STATUSES.includes(status)) {
        return res.status(400).json({
          error: "Invalid status. Use active, inactive, blocked, or pending.",
        });
      }
      const partnerId = assigned_to || assignedTo || null;
      const regions = Array.isArray(assigned_regions || assignedRegions)
        ? (assigned_regions || assignedRegions).filter((region) => REGIONS.includes(region))
        : null;
      const result = await pool.query(
        `UPDATE users
       SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role),
           status = COALESCE($4, status),
           assigned_to = COALESCE($5, assigned_to),
           assigned_regions = COALESCE($6, assigned_regions),
           updated_at = NOW()
       WHERE id = $7 RETURNING id, name, email, role, COALESCE(status, 'active') AS status, assigned_to, assigned_regions`,
        [
          name,
          email,
          role ? normalizeUserRole(role) : null,
          status || null,
          partnerId,
          regions,
          id,
        ],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "User not found" });

      const updated = result.rows[0];
      if (partnerId) {
        const roleLower = String(updated.role || "").toLowerCase();
        if (roleLower === "ybf") {
          await assignYbfToPartner(updated.id, partnerId);
        } else if (roleLower === "instructor") {
          await assignInstructorToPartner(updated.id, partnerId);
        }
      }
      if (status === "active" && updated.assigned_to) {
        await pool.query(`UPDATE users SET status = 'active' WHERE id = $1`, [
          updated.id,
        ]);
      }

      res.json({
        ...updated,
        pendingApproval: isPendingApproval(updated),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.patch(
  "/api/users/:id/status",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !USER_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use active, inactive, blocked, or pending.",
      });
    }
    try {
      if (
        req.user &&
        String(req.user.id) === String(id) &&
        status !== "active"
      ) {
        return res.status(400).json({
          error: "You cannot deactivate or block your own account.",
        });
      }
      const result = await pool.query(
        `UPDATE users SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email, role, status`,
        [status, id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/users/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const blockingRes = await pool.query(
        `SELECT table_name, count(*) AS count
         FROM (
           SELECT 'case_note' AS table_name FROM case_note WHERE author_id = $1
           UNION ALL
           SELECT 'field_visit' AS table_name FROM field_visit WHERE visitor_id = $1
           UNION ALL
           SELECT 'mentorship_session' AS table_name FROM mentorship_session WHERE mentor_id = $1
         ) t
         GROUP BY table_name`,
        [id],
      );

      const blocking = blockingRes.rows
        .filter((row) => Number(row.count) > 0)
        .map((row) => `${row.count} ${row.table_name}`);

      if (blocking.length > 0) {
        return res.status(409).json({
          error: `Cannot delete user because related records exist: ${blocking.join(", ")}. Reassign or remove those records first.`,
        });
      }

      await pool.query("BEGIN");
      const cleanupQueries = [
        "UPDATE attendance_record SET entered_by = NULL WHERE entered_by = $1",
        "UPDATE baseline_data SET recorded_by = NULL WHERE recorded_by = $1",
        "UPDATE case_note SET assigned_to = NULL WHERE assigned_to = $1",
        "UPDATE cohort SET created_by = NULL WHERE created_by = $1",
        "UPDATE config_history SET changed_by = NULL WHERE changed_by = $1",
        "UPDATE field_enumerator SET deleted_by = NULL WHERE deleted_by = $1",
        "UPDATE field_enumerator SET user_id = NULL WHERE user_id = $1",
        "UPDATE field_visit SET created_by = NULL WHERE created_by = $1",
        "UPDATE instructor SET deleted_by = NULL WHERE deleted_by = $1",
        "UPDATE instructor SET user_id = NULL WHERE user_id = $1",
        "UPDATE mentorship_session SET created_by = NULL WHERE created_by = $1",
        "UPDATE outcome_data_point SET recorded_by = NULL WHERE recorded_by = $1",
        "UPDATE output_milestone SET updated_by = NULL WHERE updated_by = $1",
        "UPDATE partner_institution SET created_by = NULL WHERE created_by = $1",
        "UPDATE partner_institution SET deleted_by = NULL WHERE deleted_by = $1",
        "UPDATE session SET created_by = NULL WHERE created_by = $1",
        "UPDATE system_config SET updated_by = NULL WHERE updated_by = $1",
        "UPDATE user_roles SET assigned_by = NULL WHERE assigned_by = $1",
        "UPDATE users SET assigned_to = NULL WHERE assigned_to = $1",
        "UPDATE users SET deleted_by = NULL WHERE deleted_by = $1",
        "UPDATE youth SET created_by = NULL WHERE created_by = $1",
        "UPDATE youth SET deleted_by = NULL WHERE deleted_by = $1",
        "UPDATE youth_business_fellow SET deleted_by = NULL WHERE deleted_by = $1",
        "UPDATE youth_business_fellow SET user_id = NULL WHERE user_id = $1",
      ];

      for (const query of cleanupQueries) {
        await pool.query(query, [id]);
      }

      const result = await pool.query(
        "DELETE FROM users WHERE id = $1 RETURNING *",
        [id],
      );
      if (result.rows.length === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      await pool.query("COMMIT");
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      await pool.query("ROLLBACK").catch(() => null);
      if (err.code === "23503") {
        return res.status(409).json({
          error:
            "Cannot delete user because related records still reference that user. Reassign or remove those records first.",
        });
      }
      res.status(500).json({ error: err.message });
    }
  },
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
