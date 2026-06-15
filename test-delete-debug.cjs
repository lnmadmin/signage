// Debug delete: check MinIO object exists, then attempt delete via API
const http = require('http');

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  // Login
  const loginRes = await request(
    { hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@example.com', password: 'changeme' })
  );
  const { token } = JSON.parse(loginRes.body);
  console.log('Logged in, token:', token.slice(0, 20) + '...');

  // List media
  const mediaRes = await request(
    { hostname: 'localhost', port: 3000, path: '/api/media', method: 'GET', headers: { Authorization: `Bearer ${token}` } }
  );
  const assets = JSON.parse(mediaRes.body);
  console.log('Assets count:', assets.length);
  if (!assets.length) { console.log('No assets to delete'); return; }

  const first = assets[0];
  console.log('First asset:', first.id, first.filename, 'key:', first.storageKey);

  // Try delete
  const delRes = await request(
    { hostname: 'localhost', port: 3000, path: `/api/media/${first.id}`, method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  console.log('Delete status:', delRes.status);
  console.log('Delete body:', delRes.body);

  // Verify count decreased
  const afterRes = await request(
    { hostname: 'localhost', port: 3000, path: '/api/media', method: 'GET', headers: { Authorization: `Bearer ${token}` } }
  );
  const afterAssets = JSON.parse(afterRes.body);
  console.log('Assets after delete:', afterAssets.length);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
