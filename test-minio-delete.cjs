const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, 'backend', '.env'), 'utf8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const { Client } = require(path.join(__dirname, 'node_modules', 'minio'));
const client = new Client({
  endPoint: process.env.MINIO_ENDPOINT, port: Number(process.env.MINIO_PORT),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY,
});
const bucket = process.env.MINIO_BUCKET;

(async () => {
  // Test removing a key that does NOT exist
  const nonExistentKey = 'fdb211ad-e4e7-42c2-9a85-ba8611f3e64a';
  console.log('Removing non-existent key:', nonExistentKey);
  try {
    await client.removeObject(bucket, nonExistentKey);
    console.log('SUCCESS (idempotent - no error for missing key)');
  } catch (e) {
    console.log('ERROR:', e.message, '| code:', e.code);
  }
})().catch(e => { console.error('Unexpected:', e); process.exit(1); });
