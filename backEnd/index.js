const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("./db");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

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
  admin: ['read', 'write', 'delete', 'manage_users', 'system_config'],
  program_manager: ['read', 'write', 'approve_records'],
  ybf: ['read_youth', 'write_sessions', 'write_case_notes'],
  instructor: ['read_sessions', 'write_attendance'],
  enumerator: ['read_outcomes', 'write_outcomes', 'read_limited']
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

// Dashboard — summary counts
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    // Summary counts
    // Compute attendance-based metrics from attendance_record instead of using
    // non-existent columns on the youth table (attendance_rate, risk_flag).
    const [youthRes, partnersRes, sessionsRes, casesRes, usersRes, pendingSyncsRes, atRiskRes, avgAttendanceRes] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM youth WHERE deleted_by IS NULL"),
      pool.query("SELECT COUNT(*) FROM partner_institution WHERE deleted_by IS NULL"),
      pool.query("SELECT COUNT(*) FROM session"),
      pool.query("SELECT COUNT(*) FROM case_note"),
      pool.query("SELECT COUNT(*) FROM users"),
      // pendingSyncs: youth with no attendance records (possible missing sync)
      pool.query(
        `SELECT COUNT(*) FROM youth y LEFT JOIN attendance_record a ON a.youth_id = y.id WHERE a.id IS NULL AND y.deleted_by IS NULL`
      ),
      // atRisk: youth whose computed attendance percentage across records is < 70
      pool.query(
        `SELECT COUNT(*) FROM (
           SELECT y.id,
                  CASE WHEN COUNT(a.id)=0 THEN 0 ELSE (COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100 END AS pct
           FROM youth y
           LEFT JOIN attendance_record a ON a.youth_id = y.id
           WHERE y.deleted_by IS NULL
           GROUP BY y.id
         ) t
         WHERE t.pct < 70`
      ),
      // avgAttendance: overall attendance percentage across attendance_record
      pool.query(
        `SELECT
           CASE WHEN COUNT(a.id)=0 THEN NULL ELSE (SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::float / COUNT(a.id)::float) * 100 END AS avg_attendance
         FROM attendance_record a
         JOIN youth y ON y.id = a.youth_id
         WHERE y.deleted_by IS NULL`
      ),
    ]);

    const totalYouth = Number(youthRes.rows[0].count || 0);
    const totalPartners = Number(partnersRes.rows[0].count || 0);
    const totalSessions = Number(sessionsRes.rows[0].count || 0);
    const totalCases = Number(casesRes.rows[0].count || 0);
    const totalUsers = Number(usersRes.rows[0].count || 0);
    const pendingSyncs = Number(pendingSyncsRes.rows[0].count || 0);
    const atRiskCount = Number(atRiskRes.rows[0].count || 0);
    const avgAttendance = avgAttendanceRes.rows[0].avg_attendance !== null ? Number(avgAttendanceRes.rows[0].avg_attendance) : null;

    res.json({
      totalYouth,
      totalPartners,
      totalSessions,
      totalCases,
      totalUsers,
      pendingSyncs,
      atRiskCount,
      avgAttendance,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Partners
app.get("/api/partners", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf', 'instructor', 'enumerator'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, COALESCE(c.cohort_count, 0) AS cohorts_count
       FROM partner_institution p
       LEFT JOIN (
         SELECT partner_institution_id, COUNT(*) AS cohort_count
         FROM cohort
         GROUP BY partner_institution_id
       ) c ON p.id = c.partner_institution_id
       WHERE p.deleted_by IS NULL
       ORDER BY p.created_at DESC`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/personnel", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf', 'instructor', 'enumerator'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users WHERE role IN ('ybf', 'instructor', 'enumerator') ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paginated list of at-risk youth
app.get('/api/youth/at-risk', authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf'), async (req, res) => {
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
       WHERE t.pct < 70`
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
      [limit, offset]
    );

    res.json({ total: Number(countRes.rows[0].count || 0), page, limit, rows: rowsRes.rows });
  } catch (err) {
    console.error('At-risk query error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sessions with low attendance (paginated)
app.get('/api/sessions/low-attendance', authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf', 'instructor'), async (req, res) => {
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

    const countRes = await pool.query(countQuery, [threshold]);
    const rowsRes = await pool.query(rowsQuery, [threshold, limit, offset]);

    res.json({ total: Number(countRes.rows[0].count || 0), page, limit, rows: rowsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/personnel",
  authenticateToken,
  authorizeRoles('admin', 'program_manager'),
  validateRequired(["name", "email", "role"]),
  async (req, res) => {
    const { name, email, role, assigned_to } = req.body;
    const normalizedRole = role?.toString().trim().toLowerCase();

    if (!['ybf', 'instructor', 'enumerator'].includes(normalizedRole)) {
      return res.status(400).json({ error: "Role must be one of: ybf, instructor, enumerator" });
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
      if (err.code === '23505') {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

app.post(
  "/api/partners",
  authenticateToken,
  authorizeRoles('admin', 'program_manager'),
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
    } = req.body;

    const partnerType = institution_type || type;
    const partnershipDate = partnership_date || startDate || null;

    if (!name || !district || !partnerType) {
      return res.status(400).json({
        error: "Missing required fields: name, district, institution_type/type",
      });
    }

    const insertPartner = async (typeColumn) => {
      const result = await pool.query(
        `INSERT INTO partner_institution (name, district, ${typeColumn}, location, contact_name, contact_phone, contact_email, partnership_date)
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
      return result.rows[0];
    };

    try {
      const createdPartner = await insertPartner("institution_type");
      res.status(201).json(createdPartner);
    } catch (err) {
      if (err.message.includes('column "institution_type" does not exist')) {
        try {
          const createdPartner = await insertPartner('"type"');
          res.status(201).json(createdPartner);
        } catch (innerErr) {
          res.status(500).json({ error: innerErr.message });
        }
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  },
);

app.put("/api/partners/:id", authenticateToken, authorizeRoles('admin', 'program_manager'), async (req, res) => {
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
  } = req.body;

  const partnerType = institution_type || type;
  const partnershipDate = partnership_date || startDate || null;

  const updatePartner = async (typeColumn) => {
    const result = await pool.query(
      `UPDATE partner_institution 
       SET name = $1, district = $2, ${typeColumn} = $3, location = $4, contact_name = $5, contact_phone = $6, contact_email = $7, partnership_date = $8, status = $9, updated_at = NOW()
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
    return result.rows[0];
  };

  try {
    let updatedPartner;
    try {
      updatedPartner = await updatePartner("institution_type");
    } catch (err) {
      if (err.message.includes('column "institution_type" does not exist')) {
        updatedPartner = await updatePartner('"type"');
      } else {
        throw err;
      }
    }

    if (!updatedPartner)
      return res.status(404).json({ error: "Partner not found" });
    res.json(updatedPartner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/partners/:id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE partner_institution SET deleted_by = $1, deleted_at = NOW() WHERE id = $2 AND deleted_by IS NULL RETURNING *",
      [req.user.id, id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Partner not found" });
    res.json({ message: "Partner deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Youth
app.get("/api/youth", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM youth WHERE deleted_by IS NULL ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/youth",
  authenticateToken,
  authorizeRoles('admin', 'program_manager'),
  validateRequired(["full_name", "date_of_birth", "gender", "district"]),
  async (req, res) => {
    const {
      full_name,
      date_of_birth,
      gender,
      district,
      partner_institution_id,
      cohort_id,
    } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO youth (full_name, date_of_birth, gender, district, partner_institution_id, cohort_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          full_name,
          date_of_birth,
          gender,
          district,
          partner_institution_id,
          cohort_id,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);
app.put("/api/youth/:id", authenticateToken, authorizeRoles('admin', 'program_manager'), async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    date_of_birth,
    gender,
    district,
    partner_institution_id,
    cohort_id,
    program_type,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE youth 
       SET full_name = $1, date_of_birth = $2, gender = $3, district = $4, partner_institution_id = $5, cohort_id = $6, program_type = $7, updated_at = NOW()
       WHERE id = $8 AND deleted_by IS NULL RETURNING *`,
      [
        full_name,
        date_of_birth,
        gender,
        district,
        partner_institution_id,
        cohort_id,
        program_type,
        id,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Youth not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update youth error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/youth/:id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
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
});
// Sessions
app.get("/api/sessions", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf', 'instructor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, p.name AS partner_name
       FROM session s
       LEFT JOIN cohort c ON c.id = s.cohort_id
       LEFT JOIN partner_institution p ON p.id = c.partner_institution_id
       ORDER BY s.session_date DESC`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/sessions",
  authenticateToken,  authorizeRoles('admin', 'program_manager', 'ybf'),  validateRequired(["cohort_id", "topic", "session_date"]),
  async (req, res) => {
    const {
      cohort_id,
      topic,
      session_date,
      venue,
      term_number,
      session_number,
      facilitator,
    } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO session (cohort_id, topic, session_date, venue, term_number, session_number, facilitator)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          cohort_id,
          topic,
          session_date,
          venue,
          term_number,
          session_number,
          facilitator,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put("/api/sessions/:id", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf'), async (req, res) => {
  const { id } = req.params;
  const {
    cohort_id,
    topic,
    session_date,
    venue,
    term_number,
    session_number,
    facilitator,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE session 
       SET cohort_id = $1, topic = $2, session_date = $3, venue = $4, term_number = $5, session_number = $6, facilitator = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        cohort_id,
        topic,
        session_date,
        venue,
        term_number,
        session_number,
        facilitator,
        id,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Session not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/sessions/:id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
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
});

// Cases (case_note)
app.get("/api/cases", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM case_note ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/cases",
  authenticateToken,  authorizeRoles('admin', 'program_manager', 'ybf'),  validateRequired(["youth_id", "category", "note_text"]),
  async (req, res) => {
    const { youth_id, category, note_text, follow_up_due, follow_up_required } =
      req.body;
    try {
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

app.put("/api/cases/:id", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf'), async (req, res) => {
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
});

app.delete("/api/cases/:id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
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
});

// Outcomes (output_milestone)
app.get("/api/outcomes", authenticateToken, authorizeRoles('admin', 'program_manager', 'enumerator'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM output_milestone ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/outcomes",
  authenticateToken,
  authorizeRoles('admin', 'program_manager', 'enumerator'),
  validateRequired(["youth_id", "milestone_type", "status"]),
  async (req, res) => {
    const { youth_id, milestone_type, status } = req.body;
    try {
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

app.put("/api/outcomes/:id", authenticateToken, authorizeRoles('admin', 'program_manager', 'enumerator'), async (req, res) => {
  const { id } = req.params;
  const { milestone_type, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE output_milestone 
       SET milestone_type = $1, status = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [milestone_type, status, id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Output milestone not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/outcomes/:id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
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
});

// Reports — attendance summary
app.get("/api/reports", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.session_date,
        s.topic,
        COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present,
        COUNT(a.id) FILTER (WHERE a.status = 'Absent') AS absent,
        COUNT(a.id) FILTER (WHERE a.status = 'Excused') AS excused
      FROM session s
      LEFT JOIN attendance_record a ON a.session_id = s.id
      GROUP BY s.id, s.session_date, s.topic
      ORDER BY s.session_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance
app.get("/api/attendance", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf', 'instructor'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, s.topic, s.session_date, y.full_name as youth_name
      FROM attendance_record a
      JOIN session s ON a.session_id = s.id
      JOIN youth y ON a.youth_id = y.id
      ORDER BY s.session_date DESC, y.full_name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/attendance",
  authenticateToken,
  authorizeRoles('admin', 'program_manager', 'ybf', 'instructor'),
  validateRequired(["session_id", "youth_id", "status"]),
  async (req, res) => {
    const { session_id, youth_id, status } = req.body;
    try {
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

app.put("/api/attendance/:id", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf', 'instructor'), async (req, res) => {
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
});

// User management (admin only)
app.get("/api/users", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;
  try {
    const result = await pool.query(
      "UPDATE users SET name = $1, email = $2, role = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, email, role",
      [name, email, role, id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
