// src/socket.ts/socket.ts

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer;

export const initialize = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Replace with your client's origin if needed
      methods: ['GET', 'POST'],
    },
  });
  return io;
};

export const getIo = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
