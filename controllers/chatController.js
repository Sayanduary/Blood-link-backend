import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { io } from '../server.js';
import { notifyUser } from '../utils/notify.js';
import Notification from '../models/Notification.js';

/**
 * Create or access chat
 * @route POST /api/chat
 * @access Private
 */
export const accessChat = asyncHandler(async (req, res) => {
  const { userId, requestId } = req.body;
  
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }
  
  // Find or create chat between users
  const chat = await Chat.findOrCreateChat(req.user.id, userId, requestId);
  
  res.status(200).json({
    success: true,
    data: chat
  });
});

/**
 * Get user chats
 * @route GET /api/chat
 * @access Private
 */
export const getUserChats = asyncHandler(async (req, res) => {
  const chats = await Chat.find({
    participants: { $elemMatch: { $eq: req.user.id } }
  })
    .populate('participants', 'name email profileImage')
    .populate('latestMessage')
    .populate('request', 'bloodGroup status')
    .sort({ updatedAt: -1 });
  
  // Populate sender in latest message
  const populatedChats = await User.populate(chats, {
    path: 'latestMessage.sender',
    select: 'name email profileImage'
  });
  
  res.status(200).json({
    success: true,
    count: chats.length,
    data: populatedChats
  });
});

/**
 * Get chat by ID
 * @route GET /api/chat/:id
 * @access Private
 */
export const getChatById = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id)
    .populate('participants', 'name email profileImage')
    .populate('request', 'bloodGroup status')
    .populate('latestMessage');
  
  if (!chat) {
    throw new AppError('Chat not found', 404);
  }
  
  // Check if user is a participant
  if (!chat.participants.some(p => p._id.toString() === req.user.id)) {
    throw new AppError('Not authorized to access this chat', 403);
  }
  
  // Populate sender in latest message
  const populatedChat = await User.populate(chat, {
    path: 'latestMessage.sender',
    select: 'name email profileImage'
  });
  
  res.status(200).json({
    success: true,
    data: populatedChat
  });
});

/**
 * Send message
 * @route POST /api/chat/:id/messages
 * @access Private
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { content, contentType = 'text' } = req.body;
  
  if (!content) {
    throw new AppError('Message content is required', 400);
  }
  
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new AppError('Chat not found', 404);
  }
  
  // Check if user is a participant
  if (!chat.participants.some(p => p.toString() === req.user.id)) {
    throw new AppError('Not authorized to send message in this chat', 403);
  }
  
  // Create message
  const message = new Message({
    chat: chat._id,
    sender: req.user.id,
    content,
    contentType,
    readBy: [req.user.id],
    createdAt: new Date()
  });
  
  await message.save();
  
  // Update chat with latest message
  chat.latestMessage = message._id;
  chat.updatedAt = new Date();
  await chat.save();
  
  // Populate message with sender info
  const populatedMessage = await Message.findById(message._id)
    .populate('sender', 'name email profileImage');
  
  // Send message via socket.io
  io.to(`chat:${chat._id}`).emit('new-message', populatedMessage);
  
  // Notify other participants
  const otherParticipants = chat.participants.filter(
    p => p.toString() !== req.user.id
  );
  
  if (otherParticipants.length > 0) {
    const sender = await User.findById(req.user.id).select('name');
    
    for (const participantId of otherParticipants) {
      const notificationData = {
        title: 'New Message',
        message: `${sender.name}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        type: 'message',
        actionUrl: `/chat/${chat._id}`,
        details: {
          chatId: chat._id,
          messageId: message._id
        }
      };
      
      const participant = await User.findById(participantId);
      await notifyUser(participant, notificationData, Notification);
    }
  }
  
  res.status(201).json({
    success: true,
    data: populatedMessage
  });
});

/**
 * Get chat messages
 * @route GET /api/chat/:id/messages
 * @access Private
 */
export const getChatMessages = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new AppError('Chat not found', 404);
  }
  
  // Check if user is a participant
  if (!chat.participants.some(p => p.toString() === req.user.id)) {
    throw new AppError('Not authorized to access this chat', 403);
  }
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  // Get messages with pagination (newest first, then reverse for display)
  const messages = await Message.find({ chat: chat._id })
    .populate('sender', 'name email profileImage')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  // Reverse to get chronological order
  const chronologicalMessages = messages.reverse();
  
  // Mark messages as read
  const unreadMessages = messages.filter(
    msg => !msg.readBy.includes(req.user.id)
  );
  
  if (unreadMessages.length > 0) {
    const messageUpdatePromises = unreadMessages.map(msg => {
      msg.readBy.push(req.user.id);
      return msg.save();
    });
    
    await Promise.all(messageUpdatePromises);
  }
  
  const total = await Message.countDocuments({ chat: chat._id });
  
  res.status(200).json({
    success: true,
    count: chronologicalMessages.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: chronologicalMessages
  });
});

/**
 * Mark messages as read
 * @route PUT /api/chat/:id/read
 * @access Private
 */
export const markMessagesAsRead = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id);
  
  if (!chat) {
    throw new AppError('Chat not found', 404);
  }
  
  // Check if user is a participant
  if (!chat.participants.some(p => p.toString() === req.user.id)) {
    throw new AppError('Not authorized to access this chat', 403);
  }
  
  // Find unread messages
  const unreadMessages = await Message.find({
    chat: chat._id,
    readBy: { $ne: req.user.id }
  });
  
  // Mark messages as read
  if (unreadMessages.length > 0) {
    const messageUpdatePromises = unreadMessages.map(msg => {
      msg.readBy.push(req.user.id);
      return msg.save();
    });
    
    await Promise.all(messageUpdatePromises);
    
    // Emit read status via socket
    io.to(`chat:${chat._id}`).emit('messages-read', {
      chat: chat._id,
      user: req.user.id
    });
  }
  
  res.status(200).json({
    success: true,
    count: unreadMessages.length,
    message: `${unreadMessages.length} messages marked as read`
  });
});