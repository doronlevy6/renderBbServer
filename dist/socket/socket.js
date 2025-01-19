"use strict";
// src/socket.ts/socket.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIo = exports.initialize = void 0;
const socket_io_1 = require("socket.io");
let io;
const initialize = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*', // Replace with your client's origin if needed
            methods: ['GET', 'POST'],
        },
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
