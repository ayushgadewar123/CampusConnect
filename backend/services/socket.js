const { Server } = require('socket.io');

let ioInstance = null;

const initSocket = (httpServer, allowedOrigins = []) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  ioInstance.on("connection", (socket) => {
    socket.on("join:event", (eventId) => {
      if (eventId) socket.join(`event:${eventId}`);
    });

    socket.on("leave:event", (eventId) => {
      if (eventId) socket.leave(`event:${eventId}`);
    });

    socket.on("join:admin", () => socket.join("admins"));
    socket.on("join:user", (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

const emitToEvent = (eventId, eventName, payload) => {
  if (!ioInstance || !eventId) return;
  ioInstance.to(`event:${eventId}`).emit(eventName, payload);
};

const emitToAdmins = (eventName, payload) => {
  if (!ioInstance) return;
  ioInstance.to("admins").emit(eventName, payload);
};

const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
};

module.exports = { initSocket, getIO, emitToEvent, emitToAdmins, emitToUser };
