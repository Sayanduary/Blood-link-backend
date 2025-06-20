import { socketStore } from '../utils/socketStore.js';

const setupSocket = (io) => {
  // Socket.io connection handler
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Handle user authentication and store user socket mapping
    socket.on('authenticate', (userId) => {
      if (!userId) return;
      
      console.log(`User ${userId} authenticated on socket ${socket.id}`);
      socketStore.addUserSocket(userId, socket.id);
      
      // Join user-specific room for targeted messages
      socket.join(`user:${userId}`);
    });
    
    // Handle joining chat rooms
    socket.on('join-chat', (chatId) => {
      if (!chatId) return;
      
      console.log(`Socket ${socket.id} joined chat room ${chatId}`);
      socket.join(`chat:${chatId}`);
    });
    
    // Handle chat messages
    socket.on('send-message', (data) => {
      const { chatId, message } = data;
      if (!chatId || !message) return;
      
      console.log(`Message sent to chat ${chatId}`);
      io.to(`chat:${chatId}`).emit('receive-message', message);
    });
    
    // Handle blood request notifications
    socket.on('blood-request', (data) => {
      const { donorIds } = data;
      if (!donorIds || !Array.isArray(donorIds)) return;
      
      donorIds.forEach(donorId => {
        io.to(`user:${donorId}`).emit('new-request', data);
      });
    });
    
    // Handle typing indicators for chat
    socket.on('typing', (data) => {
      const { chatId, userId, isTyping } = data;
      socket.to(`chat:${chatId}`).emit('user-typing', { userId, isTyping });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      socketStore.removeSocketId(socket.id);
    });
  });
  
  return io;
};

export default setupSocket;