import express from 'express';
import {
  accessChat,
  getUserChats,
  getChatById,
  sendMessage,
  getChatMessages,
  markMessagesAsRead
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route /api/chat
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// All chat routes require authentication
router.use(protect);

router.post('/', accessChat);
router.get('/', getUserChats);
router.get('/:id', getChatById);
router.post('/:id/messages', sendMessage);
router.get('/:id/messages', getChatMessages);
router.put('/:id/read', markMessagesAsRead);

export default router;