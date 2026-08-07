(async () => {
  const base = process.env.API_BASE || 'http://localhost:5000';
  const email = process.env.TEST_EMAIL || 'manager@wezesha.org';
  const password = process.env.TEST_PASSWORD || 'manager@1234';

  let fetchFn = globalThis.fetch;
  if (!fetchFn) {
    try {
      fetchFn = (await import('node-fetch')).default;
    } catch (err) {
      console.error('No fetch available. Run on Node 18+ or install node-fetch.');
      process.exit(1);
    }
  }

  console.log('Logging in as', email, 'against', base);
  try {
    const loginRes = await fetchFn(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginJson = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed:', loginJson);
      process.exit(1);
    }
    const token = loginJson.token;
    if (!token) {
      console.error('No token returned by login');
      process.exit(1);
    }
    console.log('Got token, running endpoint checks...');

    const endpoints = [
      { path: '/api/health', fmt: 'text' },
      { path: '/api/dashboard', fmt: 'json' },
      { path: '/api/youth', fmt: 'json' },
      { path: '/api/partners', fmt: 'json' },
      { path: '/api/outcomes', fmt: 'json' },
      { path: '/api/cohorts', fmt: 'json' },
      { path: '/api/sessions/calendar.ics', fmt: 'text' },
    ];

    for (const ep of endpoints) {
      const url = base + ep.path;
      try {
        const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
        console.log('\n===', ep.path, '=>', res.status, res.statusText);
        const text = await res.text();
        if (ep.fmt === 'json') {
          try { console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 2000)); }
          catch (e) { console.log('Non-JSON response:', text.slice(0,2000)); }
        } else {
          console.log(text.slice(0,2000));
        }
      } catch (err) {
        console.error('\n===', ep.path, 'ERROR:', err.message);
      }
    }
  } catch (err) {
    console.error('Test runner error:', err.message);
    process.exit(1);
  }
})();
