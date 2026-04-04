const http = require('http');
const urls = [
  'http://localhost:3000/@vite/client/env.mjs',
  'http://localhost:3001/@vite/client/env.mjs',
];

let pending = urls.length;
urls.forEach((url) => {
  http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('URL:', url);
      console.log('status:', res.statusCode);
      console.log('content-type:', res.headers['content-type']);
      console.log('body:', data.slice(0, 320));
      console.log('---');
      if (--pending === 0) process.exit(0);
    });
  }).on('error', (err) => {
    console.log('URL:', url);
    console.log('ERROR:', err.message);
    console.log('---');
    if (--pending === 0) process.exit(1);
  });
});
