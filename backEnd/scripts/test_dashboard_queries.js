const pool = require('../db');
(async () => {
  const queries = [
    { name: 'totalYouth', sql: "SELECT COUNT(*) FROM youth WHERE deleted_by IS NULL" },
    { name: 'totalPartners', sql: "SELECT COUNT(*) FROM partner_institution WHERE deleted_by IS NULL" },
    { name: 'totalSessions', sql: "SELECT COUNT(*) FROM session" },
    { name: 'totalCases', sql: "SELECT COUNT(*) FROM case_note" },
    { name: 'totalUsers', sql: "SELECT COUNT(*) FROM users" },
    { name: 'pendingSyncs', sql: `SELECT COUNT(*) FROM youth y LEFT JOIN attendance_record a ON a.youth_id = y.id WHERE a.id IS NULL AND y.deleted_by IS NULL` },
    { name: 'atRisk', sql: `SELECT COUNT(*) FROM (
           SELECT y.id,
                  CASE WHEN COUNT(a.id)=0 THEN 0 ELSE (COUNT(a.id) FILTER (WHERE a.status='Present')::float / NULLIF(COUNT(a.id),0)::float) * 100 END AS pct
           FROM youth y
           LEFT JOIN attendance_record a ON a.youth_id = y.id
           WHERE y.deleted_by IS NULL
           GROUP BY y.id
         ) t
         WHERE t.pct < 70` },
    { name: 'avgAttendance', sql: `SELECT
           CASE WHEN COUNT(a.id)=0 THEN NULL ELSE (SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::float / COUNT(a.id)::float) * 100 END AS avg_attendance
         FROM attendance_record a
         JOIN youth y ON y.id = a.youth_id
         WHERE y.deleted_by IS NULL` },
  ];

  for (const q of queries) {
    try {
      const res = await pool.query(q.sql);
      console.log(q.name, '=>', res.rows[0]);
    } catch (err) {
      console.error(q.name, 'ERROR =>', err.message);
    }
  }

  await pool.end();
})();
