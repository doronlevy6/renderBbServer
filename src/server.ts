// src/server.ts

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import userRoutes from './controllers/userController'; // Existing routes
import financeRoutes from './controllers/financeController'; // NEW: Finance routes
import { initialize } from './socket/socket';
import createTables from './dbInit';

const defaultEnvFile =
  process.env.NODE_ENV === 'production' ? '.env.production.lock' : '.env';
const envFile = process.env.ENV_FILE || defaultEnvFile;
dotenv.config({ path: envFile });
console.log(`Using environment file: ${envFile}`);

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 9090;

app.use(cors()); // Enable CORS
app.use(express.json());
app.use((_req: Request, res: Response, next) => {
  // Dynamic API responses should never be cached by browsers/proxies.
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Mount Routes
app.use('/', userRoutes);
app.use('/finance', financeRoutes); // Base path for finance endpoints

const server: http.Server = http.createServer(app);
const io = initialize(server); // Capture the returned io object

// Initialize DB Tables
createTables();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
