// src/server.ts

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import userRoutes from './controllers/userController';
import { initialize } from './socket/socket';
import createTables from './dbInit';
dotenv.config();

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 9090;

app.use(cors()); // Enable CORS
app.use(express.json());
app.use('/', userRoutes);

const server: http.Server = http.createServer(app);
const io = initialize(server); // Capture the returned io object

createTables();

io.on('connection', (socket: any) => {
  // מומלץ להגדיר טיפוס מדויק ל-socket
  console.log('Client connected12');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
