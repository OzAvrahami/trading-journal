import 'dotenv/config';
import app from './src/app.js';
import { databaseConfig } from './src/db/config.js';

// Fail fast with a clear message if required env vars are missing
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n[STARTUP ERROR] Missing required environment variables:\n  ${missing.join('\n  ')}\n`);
  console.error('Copy server/.env.example to server/.env and fill in the values.\n');
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

try { databaseConfig(); } catch (error) {
  console.error('[STARTUP ERROR]', error.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
