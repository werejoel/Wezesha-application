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
    const [youth, partners, sessions, cases] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM youth WHERE deleted_by IS NULL"),
      pool.query(
        "SELECT COUNT(*) FROM partner_institution WHERE deleted_by IS NULL",
      ),
      pool.query("SELECT COUNT(*) FROM session"),
      pool.query("SELECT COUNT(*) FROM case_note"),
    ]);
    res.json({
      totalYouth: youth.rows[0].count,
      totalPartners: partners.rows[0].count,
      totalSessions: sessions.rows[0].count,
      totalCases: cases.rows[0].count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Partners
app.get("/api/partners", authenticateToken, authorizeRoles('admin', 'program_manager', 'ybf', 'instructor', 'enumerator'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM partner_institution WHERE deleted_by IS NULL ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/partners",
  authenticateToken,
  authorizeRoles('admin', 'program_manager'),
  validateRequired(["name", "district", "institution_type"]),
  async (req, res) => {
    const {
      name,
      district,
      institution_type,
      contact_name,
      contact_phone,
      contact_email,
    } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO partner_institution (name, district, institution_type, contact_name, contact_phone, contact_email)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          name,
          district,
          institution_type,
          contact_name,
          contact_phone,
          contact_email,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put("/api/partners/:id", authenticateToken, authorizeRoles('admin', 'program_manager'), async (req, res) => {
  const { id } = req.params;
  const {
    name,
    district,
    institution_type,
    contact_name,
    contact_phone,
    contact_email,
    status,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE partner_institution 
       SET name = $1, district = $2, institution_type = $3, contact_name = $4, contact_phone = $5, contact_email = $6, status = $7, updated_at = NOW()
       WHERE id = $8 AND deleted_by IS NULL RETURNING *`,
      [
        name,
        district,
        institution_type,
        contact_name,
        contact_phone,
        contact_email,
        status,
        id,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Partner not found" });
    res.json(result.rows[0]);
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
    attendance_rate,
    risk_flag,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE youth 
       SET full_name = $1, date_of_birth = $2, gender = $3, district = $4, partner_institution_id = $5, cohort_id = $6, program_type = $7, attendance_rate = $8, risk_flag = $9, updated_at = NOW()
       WHERE id = $10 AND deleted_by IS NULL RETURNING *`,
      [
        full_name,
        date_of_birth,
        gender,
        district,
        partner_institution_id,
        cohort_id,
        program_type,
        attendance_rate,
        risk_flag,
        id,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Youth not found" });
    res.json(result.rows[0]);
  } catch (err) {
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
      "SELECT * FROM session ORDER BY session_date DESC",
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
