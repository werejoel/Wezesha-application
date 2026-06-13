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

const ensureSchema = async () => {
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
  );
  await pool.query(
    `UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''`,
  );
};
ensureSchema().catch((err) =>
  console.error("Schema bootstrap failed:", err.message),
);

const USER_STATUSES = ["active", "inactive", "blocked"];

const getAccountStatusMessage = (status) => {
  if (status === "blocked") {
    return "This account has been blocked. Contact your administrator.";
  }
  if (status === "inactive") {
    return "This account is deactivated. Contact your administrator.";
  }
  return null;
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
  const compact = value.trim().toLowerCase().replace(/[-_\s]/g, "");
  if (compact === "inschool") return "In-school";
  if (compact === "outofschool") return "Out-of-school";
  return null;
};

// Helper: get cohorts assigned to a user (YBF). Tries multiple strategies and
// returns an array of cohort ids (may be empty).
const getUserCohorts = async (userId) => {
  try {
    // Strategy 1: explicit assignment table `ybf_assignment(user_id, cohort_id)`
    try {
      const res = await pool.query(
        `SELECT cohort_id FROM ybf_assignment WHERE user_id::text = $1::text`,
        [String(userId)],
      );
      if (res.rows.length > 0) return res.rows.map((r) => r.cohort_id);
    } catch (err) {
      // table may not exist; fall through to the next strategy
    }

    // Strategy 2: users.assigned_to references a partner_institution id
    try {
      const userRes = await pool.query(`SELECT assigned_to FROM users WHERE id = $1`, [userId]);
      const assignedTo = userRes.rows[0]?.assigned_to;
      if (assignedTo) {
        const cRes = await pool.query(
          `SELECT id FROM cohort WHERE partner_institution_id = $1`,
          [assignedTo],
        );
        if (cRes.rows.length > 0) return cRes.rows.map((r) => r.id);
      }
    } catch (err) {
      // ignore and continue
    }

    // Strategy 3: no explicit mapping available — return empty (no access)
    return [];
  } catch (err) {
    console.error('getUserCohorts error:', err);
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
  enumerator: ["read_outcomes", "write_outcomes", "read_limited"],
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
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
        [name, email, hashedPassword, role || "enumerator"],
      );
      const token = jwt.sign(
        { id: result.rows[0].id, role: result.rows[0].role },
        process.env.JWT_SECRET || "wezesha_secret_key",
      );
      res.status(201).json({ user: result.rows[0], token });
    } catch (err) {
      if (err.code === "23505") {
        // unique violation
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
    const caseCohortFilter = isYbf
      ? "WHERE y.cohort_id = ANY($1)"
      : "";
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
    ]);

    const totalYouth = Number(youthRes.rows[0].count || 0);
    const totalPartners = Number(partnersRes.rows[0].count || 0);
    const totalSessions = Number(sessionsRes.rows[0].count || 0);
    const totalCases = Number(casesRes.rows[0].count || 0);
    const totalUsers = Number(usersRes.rows[0].count || 0);
    const pendingSyncs = Number(pendingSyncsRes.rows[0].count || 0);
    const atRiskCount = Number(atRiskRes.rows[0].count || 0);
    const avgAttendance =
      avgAttendanceRes.rows[0].avg_attendance !== null
        ? Number(avgAttendanceRes.rows[0].avg_attendance)
        : null;

    const response = {
      totalYouth,
      totalPartners,
      totalSessions,
      totalCases,
      totalUsers,
      pendingSyncs,
      atRiskCount,
      avgAttendance,
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
  authorizeRoles("admin", "program_manager", "ybf", "instructor", "enumerator"),
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
                y.id AS assigned_ybf_id,
                y.name AS assigned_ybf_name
       FROM partner_institution p
       LEFT JOIN (
         SELECT partner_institution_id, COUNT(*) AS cohort_count
         FROM cohort
         GROUP BY partner_institution_id
       ) c ON p.id = c.partner_institution_id
       LEFT JOIN users y
         ON y.assigned_to::text = p.id::text AND y.role = 'ybf'
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
  authorizeRoles("admin", "program_manager", "ybf", "instructor", "enumerator"),
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
  authorizeRoles("admin", "program_manager", "ybf", "instructor", "enumerator"),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, name, email, role, created_at FROM users WHERE role IN ('ybf', 'instructor', 'enumerator') ORDER BY created_at DESC",
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
    if (!["ybf", "instructor", "enumerator"].includes(normalizedRole)) {
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
      if (!["ybf", "instructor", "enumerator"].includes(normalizedRole)) {
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

        const countRes = await pool.query(countQueryFiltered, [threshold, allowed]);
        const rowsRes = await pool.query(rowsQueryFiltered, [threshold, limit, offset, allowed]);

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

    if (!["ybf", "instructor", "enumerator"].includes(normalizedRole)) {
      return res
        .status(400)
        .json({ error: "Role must be one of: ybf, instructor, enumerator" });
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

    try {
      const result = await pool.query(
        `INSERT INTO partner_institution (name, district, type, location, contact_name, contact_phone, contact_email, partnership_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          name,
          district,
          partnerType,
          location,
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
        await pool.query(
          `UPDATE users SET assigned_to = $1 WHERE id::text = $2::text`,
          [partner.id, String(assignedYbf)],
        );
      }

      if (cohortYear !== undefined && cohortYear !== null && cohortYear !== "") {
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

      res.status(201).json(partner);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put(
  "/api/partners/:id",
  authenticateToken,
  authorizeRoles("admin", "program_manager","ybf"),
  async (req, res) => {
    const { id } = req.params;
    const {
      name,
      district,
      institution_type,
      type,
      location,
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

    try {
      const result = await pool.query(
        `UPDATE partner_institution 
       SET name = $1, district = $2, type = $3, location = $4, contact_name = $5, contact_phone = $6, contact_email = $7, partnership_date = $8, status = $9, updated_at = NOW()
       WHERE id = $10 AND deleted_by IS NULL RETURNING *`,
        [
          name,
          district,
          partnerType,
          location,
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
      const assignedYbf = assigned_ybf_id ?? assignedYbfId ?? null;
      if (assignedYbf !== undefined) {
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
          await pool.query(
            `UPDATE users SET assigned_to = $1 WHERE id::text = $2::text`,
            [id, String(assignedYbf)],
          );
        } else {
          await pool.query(
            `UPDATE users SET assigned_to = NULL WHERE assigned_to::text = $1::text AND role = 'ybf'`,
            [id],
          );
        }
      }

      res.json(partner);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Youth
app.get(
  "/api/youth",
  authenticateToken,
  authorizeRoles("admin", "program_manager","ybf"),
  async (req, res) => {
    try {
      // If the user is a YBF, scope youth to their assigned cohorts
      const youthSelect = `
        SELECT y.id, y.full_name, y.date_of_birth, y.gender,
               y.district_of_residence AS district, y.partner_institution_id,
               y.cohort_id, y.program_type, y.program_year, y.region, y.nationality,
               y.created_at, y.updated_at, y.deleted_at, y.deleted_by, y.created_by, y.youth_code,
               p.name AS partner_name,
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
          `${youthSelect} AND y.cohort_id = ANY($1)
           GROUP BY y.id, p.name, c.program_year
           ORDER BY y.full_name ASC`,
          [allowed],
        );
        return res.json(result.rows);
      }

      const result = await pool.query(
        `${youthSelect}
         GROUP BY y.id, p.name, c.program_year
         ORDER BY y.created_at DESC`,
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
    } = req.body;

    if (!full_name || !date_of_birth || !gender || !district) {
      return res
        .status(400)
        .json({
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
        return res
          .status(400)
          .json({ error: "Invalid program type. Use In-school or Out-of-school." });
      }

      const cohortRes = await pool.query(
        `SELECT program_year FROM cohort WHERE id = $1 LIMIT 1`,
        [cohortId],
      );
      const programYear = cohortRes.rows[0]?.program_year;
      if (!programYear) {
        return res.status(400).json({ error: "Invalid cohort selected" });
      }

      const result = await pool.query(
        `INSERT INTO youth (full_name, date_of_birth, gender, district_of_residence, partner_institution_id, cohort_id, program_type, program_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          full_name,
          date_of_birth,
          gender,
          district,
          partnerId,
          cohortId,
          resolvedProgramType,
          programYear,
        ],
      );
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
          return res
            .status(400)
            .json({
              error:
                "Partner or partner_institution_id is required to resolve cohort",
            });
        }
        resolvedCohortId = await getCohortIdByPartnerAndYear(
          resolvedPartnerId,
          cohort,
        );
        if (!resolvedCohortId) {
          return res
            .status(400)
            .json({
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
        return res
          .status(400)
          .json({ error: "Invalid program type. Use In-school or Out-of-school." });
      }
      if (!resolvedProgramType) resolvedProgramType = "In-school";

      const result = await pool.query(
        `UPDATE youth 
       SET full_name = $1, date_of_birth = $2, gender = $3, district_of_residence = $4, partner_institution_id = $5, cohort_id = $6, program_type = $7, program_year = $8, updated_at = NOW()
       WHERE id = $9 AND deleted_by IS NULL RETURNING *`,
        [
          full_name,
          date_of_birth,
          gender,
          district,
          resolvedPartnerId,
          resolvedCohortId,
          resolvedProgramType,
          programYear,
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
  authorizeRoles("admin", "program_manager", "ybf", "instructor"),
  async (req, res) => {
    try {
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
        return res.json(result.rows);
      }

      const result = await pool.query(
        `${baseQuery}
         GROUP BY s.id, p.name
         ORDER BY s.session_date DESC`,
      );
      res.json(result.rows);
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

      const resolvedTerm = Number(term_number) > 0 ? Number(term_number) : 1;
      const resolvedSessionNumber =
        Number(session_number) > 0 ? Number(session_number) : 1;

      const insertResult = await pool.query(
        `INSERT INTO session (cohort_id, topic, session_date, venue, term_number, session_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          cohort_id,
          String(topic).trim(),
          session_date,
          venue || null,
          resolvedTerm,
          resolvedSessionNumber,
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

      res.status(201).json(enriched.rows[0] || insertResult.rows[0]);
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
    const { youth_id, category, note_text, follow_up_due, follow_up_required } =
      req.body;
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
        if (!allowed.includes(youthRes.rows[0].cohort_id)) {
          return res.status(403).json({ error: "You do not have access to this youth" });
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
          follow_up_due,
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
    const { category, note_text, follow_up_due, follow_up_required } = req.body;
    try {
      const result = await pool.query(
        `UPDATE case_note 
       SET category = $1, note_text = $2, follow_up_due = $3, follow_up_required = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
        [category, note_text, follow_up_due, follow_up_required, id],
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
  authorizeRoles("admin", "program_manager", "ybf", "enumerator"),
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
           ORDER BY om.updated_at DESC NULLS LAST, om.created_at DESC`,
          [allowed],
        );
        return res.json(result.rows);
      }

      const result = await pool.query(
        `${baseQuery}
         ORDER BY om.created_at DESC`,
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
  authorizeRoles("admin", "program_manager", "ybf", "enumerator"),
  validateRequired(["youth_id", "milestone_type", "status"]),
  async (req, res) => {
    const { youth_id, milestone_type, status } = req.body;
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
        if (!allowed.includes(youthRes.rows[0].cohort_id)) {
          return res.status(403).json({ error: "You do not have access to this youth" });
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
  authorizeRoles("admin", "program_manager", "ybf", "enumerator"),
  async (req, res) => {
    const { id } = req.params;
    const { milestone_type, status } = req.body;
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
        if (!allowed.includes(accessRes.rows[0].cohort_id)) {
          return res.status(403).json({ error: "You do not have access to this record" });
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
      if (req.user && req.user.role === "ybf") {
        const sessionRes = await pool.query(
          `SELECT cohort_id FROM session WHERE id = $1`,
          [session_id],
        );
        if (!sessionRes.rows[0]) {
          return res.status(404).json({ error: "Session not found" });
        }
        if (!(await ensureYbfCohortAccess(req, res, sessionRes.rows[0].cohort_id))) {
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
      return res.status(400).json({ error: "records must be a non-empty array" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const saved = [];

      for (const record of records) {
        const { session_id, youth_id, status } = record;
        if (!session_id || !youth_id || !status) {
          throw new Error("Each record requires session_id, youth_id, and status");
        }

        if (req.user && req.user.role === "ybf") {
          const sessionRes = await client.query(
            `SELECT cohort_id FROM session WHERE id = $1`,
            [session_id],
          );
          if (!sessionRes.rows[0]) {
            throw new Error(`Session not found: ${session_id}`);
          }
          const allowed = await getUserCohorts(req.user.id);
          if (!allowed.includes(sessionRes.rows[0].cohort_id)) {
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
      res.json({ message: "Attendance saved", count: saved.length, records: saved });
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

      const dataQuery = `SELECT id, name, email, role, COALESCE(status, 'active') AS status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    const { name, email, role, status } = req.body;
    try {
      if (status && !USER_STATUSES.includes(status)) {
        return res.status(400).json({
          error: "Invalid status. Use active, inactive, or blocked.",
        });
      }
      const result = await pool.query(
        `UPDATE users
       SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role),
           status = COALESCE($4, status), updated_at = NOW()
       WHERE id = $5 RETURNING id, name, email, role, COALESCE(status, 'active') AS status`,
        [name, email, role, status || null, id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "User not found" });
      res.json(result.rows[0]);
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
        error: "Invalid status. Use active, inactive, or blocked.",
      });
    }
    try {
      if (req.user && String(req.user.id) === String(id) && status !== "active") {
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
      const result = await pool.query(
        "DELETE FROM users WHERE id = $1 RETURNING *",
        [id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "User not found" });
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
