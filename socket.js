// socket.js

let io;

module.exports = {
  initialize: (httpServer) => {
    io = require("socket.io")(httpServer, {
      cors: {
        origin: "*", // Replace with your client's origin if needed
        methods: ["GET", "POST"],
      },
    });
    return io;
  },
  getIo: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  },
};
