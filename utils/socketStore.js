// In-memory store for active socket connections
class SocketStore {
  constructor() {
    this.userSockets = new Map(); // userId -> socketId
    this.socketUsers = new Map(); // socketId -> userId
  }

  addUserSocket(userId, socketId) {
    if (!userId || !socketId) return;
    this.userSockets.set(userId, socketId);
    this.socketUsers.set(socketId, userId);
  }

  getUserSocket(userId) {
    return this.userSockets.get(userId);
  }

  getUserId(socketId) {
    return this.socketUsers.get(socketId);
  }

  removeSocketId(socketId) {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      this.userSockets.delete(userId);
    }
    this.socketUsers.delete(socketId);
  }

  removeUserSockets(userId) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.socketUsers.delete(socketId);
    }
    this.userSockets.delete(userId);
  }

  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }

  getOnlineCount() {
    return this.userSockets.size;
  }
}

export const socketStore = new SocketStore();