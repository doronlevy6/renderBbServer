// src/models/userModel.ts

import { Pool } from 'pg';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
dotenv.config({ path: envFile });

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, SSL_FALSE } =
  process.env;

// הגדרת SSL בהתאם למשתנה SSL_FALSE
const sslConfig = SSL_FALSE === 'false' ? false : { rejectUnauthorized: false };

const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  user: PGUSER, // ודא שהמשתמש מוגדר נכון
  password: PGPASSWORD,
  port: 5432,
  ssl: sslConfig,
});
console.log('PGHOST', PGHOST);
export default pool;
