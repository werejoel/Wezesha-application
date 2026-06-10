const pool = require('../db');
(async () => {
  try {
    const res = await pool.query("select column_name from information_schema.columns where table_name='youth'");
    console.log(res.rows.map(r => r.column_name).join('\n'));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
})();
