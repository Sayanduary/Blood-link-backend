import express from 'express';
import {
  getUserNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationCount,
  createNotification,
  createBulkNotifications,
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/notifications
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// All notification routes require authentication
router.use(protect);

// Routes for all authenticated users
router.get('/', getUserNotifications);
router.get('/count', getNotificationCount);
router.get('/:id', getNotificationById);
router.put('/:id/read', markNotificationAsRead);
router.put('/read-all', markAllNotificationsAsRead);
router.delete('/:id', deleteNotification);
router.delete('/delete-all', deleteAllNotifications);

// Notification settings
router.get('/settings', getNotificationSettings);
router.put('/settings', updateNotificationSettings);
router.post('/test', sendTestNotification);
router.post('/subscribe', subscribeToPushNotifications);
router.delete('/unsubscribe', unsubscribeFromPushNotifications);

// Admin only routes
router.post('/', restrictTo('admin'), createNotification);
router.post('/bulk', restrictTo('admin'), createBulkNotifications);

export default router;