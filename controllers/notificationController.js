import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { socketStore } from '../utils/socketStore.js';

/**
 * Get user notifications
 * @route GET /api/notifications
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const getUserNotifications = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    isRead, 
    type 
  } = req.query;
  
  // Build query
  let query = { user: req.user.id };
  
  // Filter by read status if provided
  if (isRead !== undefined) {
    query.isRead = isRead === 'true';
  }
  
  // Filter by notification type if provided
  if (type) {
    query.type = type;
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get notifications
  const notifications = await Notification.find(query)
    .populate('relatedTo.id', 'name title bloodGroup')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const total = await Notification.countDocuments(query);
  
  // Get unread count
  const unreadCount = await Notification.countDocuments({
    user: req.user.id,
    isRead: false
  });
  
  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    unreadCount,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: notifications
  });
});

/**
 * Get notification by ID
 * @route GET /api/notifications/:id
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const getNotificationById = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id)
    .populate('relatedTo.id');
  
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
  
  // Check if notification belongs to user
  if (notification.user.toString() !== req.user.id) {
    throw new AppError('Not authorized to access this notification', 403);
  }
  
  res.status(200).json({
    success: true,
    data: notification
  });
});

/**
 * Mark notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
  
  // Check if notification belongs to user
  if (notification.user.toString() !== req.user.id) {
    throw new AppError('Not authorized to update this notification', 403);
  }
  
  // Mark as read if not already
  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }
  
  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
});

/**
 * Mark all notifications as read
 * @route PUT /api/notifications/read-all
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  // Update all unread notifications for this user
  const result = await Notification.updateMany(
    { 
      user: req.user.id,
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );
  
  res.status(200).json({
    success: true,
    message: `${result.modifiedCount || result.nModified} notifications marked as read`,
    count: result.modifiedCount || result.nModified
  });
});

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
  
  // Check if notification belongs to user
  if (notification.user.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to delete this notification', 403);
  }
  
  await notification.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

/**
 * Delete all notifications
 * @route DELETE /api/notifications/delete-all
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const deleteAllNotifications = asyncHandler(async (req, res) => {
  // Delete all notifications for this user
  const result = await Notification.deleteMany({ user: req.user.id });
  
  res.status(200).json({
    success: true,
    message: `${result.deletedCount} notifications deleted`,
    count: result.deletedCount
  });
});

/**
 * Get notification count
 * @route GET /api/notifications/count
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const getNotificationCount = asyncHandler(async (req, res) => {
  // Get total and unread counts
  const totalCount = await Notification.countDocuments({ user: req.user.id });
  const unreadCount = await Notification.countDocuments({ 
    user: req.user.id,
    isRead: false
  });
  
  // Get counts by type
  const typeCounts = await Notification.aggregate([
    { $match: { user: req.user.id } },
    { $group: { _id: "$type", count: { $sum: 1 } } }
  ]);
  
  // Format type counts
  const typeData = {};
  typeCounts.forEach(item => {
    typeData[item._id] = item.count;
  });
  
  res.status(200).json({
    success: true,
    data: {
      total: totalCount,
      unread: unreadCount,
      byType: typeData
    }
  });
});

/**
 * Create notification (admin only)
 * @route POST /api/notifications
 * @access Private (Admin only)
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const createNotification = asyncHandler(async (req, res) => {
  // Only admins can create notifications directly
  if (req.user.role !== 'admin') {
    throw new AppError('Not authorized to create notifications', 403);
  }
  
  const { 
    userId, 
    title, 
    message, 
    type, 
    actionUrl, 
    relatedTo 
  } = req.body;
  
  if (!userId || !title || !message) {
    throw new AppError('Please provide userId, title, and message', 400);
  }
  
  const notification = new Notification({
    user: userId,
    title,
    message,
    type: type || 'system',
    actionUrl,
    relatedTo,
    isRead: false,
    createdAt: new Date()
  });
  
  await notification.save();
  
  // Emit to socket if connected
  const socketId = socketStore.getUserSocket(userId);
  const io = req.app.get('io');
  
  if (io && socketId) {
    io.to(socketId).emit('notification', notification);
  }
  
  res.status(201).json({
    success: true,
    message: 'Notification created successfully',
    data: notification
  });
});

/**
 * Create bulk notifications (admin only)
 * @route POST /api/notifications/bulk
 * @access Private (Admin only)
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const createBulkNotifications = asyncHandler(async (req, res) => {
  // Only admins can create bulk notifications
  if (req.user.role !== 'admin') {
    throw new AppError('Not authorized to create bulk notifications', 403);
  }
  
  const { 
    userIds, 
    title, 
    message, 
    type, 
    actionUrl, 
    relatedTo 
  } = req.body;
  
  if (!userIds || !Array.isArray(userIds) || !title || !message) {
    throw new AppError('Please provide userIds array, title, and message', 400);
  }
  
  // Create notification objects
  const notifications = userIds.map(userId => ({
    user: userId,
    title,
    message,
    type: type || 'system',
    actionUrl,
    relatedTo,
    isRead: false,
    createdAt: new Date()
  }));
  
  // Insert many
  const createdNotifications = await Notification.insertMany(notifications);
  
  // Emit to sockets if connected
  const io = req.app.get('io');
  if (io) {
    userIds.forEach(userId => {
      const socketId = socketStore.getUserSocket(userId);
      if (socketId) {
        io.to(socketId).emit('notification', {
          title,
          message,
          type: type || 'system'
        });
      }
    });
  }
  
  res.status(201).json({
    success: true,
    message: `${createdNotifications.length} notifications created`,
    count: createdNotifications.length
  });
});

/**
 * Get system notification settings
 * @route GET /api/notifications/settings
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const getNotificationSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('preferences');
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  res.status(200).json({
    success: true,
    data: user.preferences || {
      notifyByEmail: true,
      notifyBySMS: true,
      notifyByPush: true,
      radius: 10
    }
  });
});

/**
 * Update notification settings
 * @route PUT /api/notifications/settings
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const { 
    notifyByEmail, 
    notifyBySMS, 
    notifyByPush,
    radius
  } = req.body;
  
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Initialize preferences if they don't exist
  if (!user.preferences) {
    user.preferences = {};
  }
  
  // Update each preference if provided
  if (notifyByEmail !== undefined) user.preferences.notifyByEmail = notifyByEmail;
  if (notifyBySMS !== undefined) user.preferences.notifyBySMS = notifyBySMS;
  if (notifyByPush !== undefined) user.preferences.notifyByPush = notifyByPush;
  if (radius !== undefined) user.preferences.radius = parseInt(radius);
  
  user.updatedAt = new Date();
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Notification settings updated',
    data: user.preferences
  });
});

/**
 * Send test notification to user
 * @route POST /api/notifications/test
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const sendTestNotification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  const notification = new Notification({
    user: req.user.id,
    title: 'Test Notification',
    message: 'This is a test notification to verify your notification settings.',
    type: 'system',
    actionUrl: '/profile/notifications',
    isRead: false,
    createdAt: new Date()
  });
  
  await notification.save();
  
  // Emit to socket if connected
  const socketId = socketStore.getUserSocket(req.user.id);
  const io = req.app.get('io');
  
  if (io && socketId) {
    io.to(socketId).emit('notification', notification);
  }
  
  res.status(200).json({
    success: true,
    message: 'Test notification sent successfully',
    data: notification
  });
});

/**
 * Subscribe to push notifications
 * @route POST /api/notifications/subscribe
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const subscribeToPushNotifications = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  
  if (!fcmToken) {
    throw new AppError('FCM token is required', 400);
  }
  
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Update FCM token
  user.fcmToken = fcmToken;
  user.updatedAt = new Date();
  
  // Ensure push notifications are enabled
  if (!user.preferences) {
    user.preferences = {};
  }
  user.preferences.notifyByPush = true;
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Successfully subscribed to push notifications'
  });
});

/**
 * Unsubscribe from push notifications
 * @route DELETE /api/notifications/unsubscribe
 * @access Private
 * @created 2025-06-20 17:27:58 by Sayanduary
 */
export const unsubscribeFromPushNotifications = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Remove FCM token
  user.fcmToken = null;
  
  // Update preferences
  if (user.preferences) {
    user.preferences.notifyByPush = false;
  } else {
    user.preferences = { notifyByPush: false };
  }
  
  user.updatedAt = new Date();
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Successfully unsubscribed from push notifications'
  });
});