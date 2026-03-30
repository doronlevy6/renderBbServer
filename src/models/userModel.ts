// src/models/userModel.ts

import { Pool } from 'pg';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
dotenv.config({ path: envFile });

const {
  DATABASE_URL,
  PGHOST,
  PGPORT,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  SSL_FALSE,
} = process.env;

// הגדרת SSL בהתאם למשתנה SSL_FALSE
const sslConfig = SSL_FALSE === 'false' ? false : { rejectUnauthorized: false };

const usingConnectionString =
  typeof DATABASE_URL === 'string' && DATABASE_URL.trim().length > 0;

let pool: Pool;

if (usingConnectionString) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: sslConfig,
  });
  console.log('DB connection mode: DATABASE_URL');
} else {
  const missing = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing DB configuration: ${missing.join(', ')}. ` +
        `Set DATABASE_URL or PG* environment variables.`
    );
  }

  pool = new Pool({
    host: PGHOST,
    database: PGDATABASE,
    user: PGUSER,
    password: PGPASSWORD,
    port: Number(PGPORT) || 5432,
    ssl: sslConfig,
  });
  console.log(`DB connection mode: PG vars (host=${PGHOST})`);
}

export default pool;
