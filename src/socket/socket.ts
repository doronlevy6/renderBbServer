// src/socket.ts/socket.ts

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer;
const teamRoom = (teamId: number | string): string => `team:${teamId}`;

export const initialize = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Replace with your client's origin if needed
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('joinTeam', (payload: { team_id?: number | string }) => {
      const teamId = payload?.team_id;
      if (teamId === undefined || teamId === null || teamId === '') return;
      socket.join(teamRoom(teamId));
    });

    socket.on('leaveTeam', (payload: { team_id?: number | string }) => {
      const teamId = payload?.team_id;
      if (teamId === undefined || teamId === null || teamId === '') return;
      socket.leave(teamRoom(teamId));
    });
  });
  return io;
};

export const getIo = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const emitToTeam = (
  teamId: number | string,
  event: string,
  payload: Record<string, unknown>
): void => {
  if (!io) return;
  io.to(teamRoom(teamId)).emit(event, payload);
};
