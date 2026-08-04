(async () => {
  const base = process.env.API_BASE || 'http://localhost:3000';
  const token = process.env.API_TOKEN || process.env.TOKEN || null;
  const endpoints = [
    { path: '/api/health', fmt: 'text' },
    { path: '/api/dashboard', fmt: 'json' },
    { path: '/api/youth', fmt: 'json' },
    { path: '/api/partners', fmt: 'json' },
    { path: '/api/outcomes', fmt: 'json' },
    { path: '/api/cohorts', fmt: 'json' },
    { path: '/api/sessions/calendar.ics', fmt: 'text' },
  ];

  // ensure fetch exists (Node 18+), else try node-fetch
  let fetchFn = globalThis.fetch;
  if (!fetchFn) {
    try {
      fetchFn = (await import('node-fetch')).default;
    } catch (err) {
      console.error('No fetch available. Run on Node 18+ or install node-fetch.');
      process.exit(1);
    }
  }

  console.log('API base:', base);
  if (token) console.log('Using API token from env');

  for (const ep of endpoints) {
    const url = base + ep.path;
    try {
      const res = await fetchFn(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      console.log('\n===', ep.path, '=>', res.status, res.statusText);
      if (ep.fmt === 'json') {
        const text = await res.text();
        try {
          const j = JSON.parse(text);
          console.log(JSON.stringify(j, null, 2).slice(0, 2000));
        } catch (e) {
          console.log('Response not JSON:', text.slice(0, 2000));
        }
      } else {
        const text = await res.text();
        console.log(text.slice(0, 2000));
      }
    } catch (err) {
      console.error('\n===', ep.path, 'ERROR:', err.message);
    }
  }
})();
