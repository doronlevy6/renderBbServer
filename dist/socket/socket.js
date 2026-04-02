"use strict";
// src/socket.ts/socket.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToTeam = exports.getIo = exports.initialize = void 0;
const socket_io_1 = require("socket.io");
let io;
const teamRoom = (teamId) => `team:${teamId}`;
const initialize = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*', // Replace with your client's origin if needed
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        socket.on('joinTeam', (payload) => {
            const teamId = payload === null || payload === void 0 ? void 0 : payload.team_id;
            if (teamId === undefined || teamId === null || teamId === '')
                return;
            socket.join(teamRoom(teamId));
        });
        socket.on('leaveTeam', (payload) => {
            const teamId = payload === null || payload === void 0 ? void 0 : payload.team_id;
            if (teamId === undefined || teamId === null || teamId === '')
                return;
            socket.leave(teamRoom(teamId));
        });
    });
    return io;
};
exports.initialize = initialize;
const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
exports.getIo = getIo;
const emitToTeam = (teamId, event, payload) => {
    if (!io)
        return;
    io.to(teamRoom(teamId)).emit(event, payload);
};
exports.emitToTeam = emitToTeam;
