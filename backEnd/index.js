const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// Dashboard — summary counts
app.get('/api/dashboard', async (req, res) => {
  try {
    const [youth, partners, sessions, cases] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM youth WHERE deleted_by IS NULL'),
      pool.query('SELECT COUNT(*) FROM partner_institution WHERE deleted_by IS NULL'),
      pool.query('SELECT COUNT(*) FROM session'),
      pool.query('SELECT COUNT(*) FROM case_note'),
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
app.get('/api/partners', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM partner_institution WHERE deleted_by IS NULL ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/partners', async (req, res) => {
  const { name, district, institution_type, contact_name, contact_phone, contact_email } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO partner_institution (name, district, institution_type, contact_name, contact_phone, contact_email)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, district, institution_type, contact_name, contact_phone, contact_email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Youth
app.get('/api/youth', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM youth WHERE deleted_by IS NULL ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youth', async (req, res) => {
  const { full_name, date_of_birth, gender, district, partner_institution_id, cohort_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO youth (full_name, date_of_birth, gender, district, partner_institution_id, cohort_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [full_name, date_of_birth, gender, district, partner_institution_id, cohort_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM session ORDER BY session_date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cases (case_note)
app.get('/api/cases', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM case_note ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Outcomes (output_milestone)
app.get('/api/outcomes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM output_milestone ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports — attendance summary
app.get('/api/reports', async (req, res) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));