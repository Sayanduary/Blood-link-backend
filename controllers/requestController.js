import Notification from '../models/Notification.js';
import Request from '../models/Request.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { notifyUser } from '../utils/notify.js';

/**
 * Get user notifications
 * @route GET /api/notifications
 * @access Private
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
 */
export const getNotificationById = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
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
    message: `${result.nModified} notifications marked as read`,
    count: result.nModified
  });
});

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 * @access Private
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
  
  await notification.remove();
  
  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

/**
 * Delete all notifications
 * @route DELETE /api/notifications/delete-all
 * @access Private
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
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${userId}`).emit('notification', notification);
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
      io.to(`user:${userId}`).emit('notification', {
        title,
        message,
        type: type || 'system'
      });
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
      notifyByPush: true
    }
  });
});

/**
 * Update notification settings
 * @route PUT /api/notifications/settings
 * @access Private
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
  if (radius !== undefined) user.preferences.radius = radius;
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Notification settings updated',
    data: user.preferences
  });
});

/**
 * Donor accepts a blood request
 * @route PUT /api/requests/:id/accept
 * @access Private (Donor only)
 */
export const acceptRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.id;
  const donorId = req.user.id;

  // Find the request
  const request = await Request.findById(requestId).populate('requester');
  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Only allow accepting if pending
  if (request.status !== 'pending') {
    throw new AppError('Only pending requests can be accepted', 400);
  }

  // Prevent self-accept
  if (request.requester._id.toString() === donorId) {
    throw new AppError('You cannot accept your own request', 403);
  }

  // Assign donor and update status
  request.assignedDonor = donorId;
  request.status = 'matched';
  request.matchedAt = new Date();
  await request.save();

  // Notify requester
  const notificationData = {
    title: 'A donor has accepted your request!',
    message: `Donor has accepted your blood request for ${request.bloodGroup}. Please coordinate for donation.`,
    type: 'match',
    actionUrl: `/requests/${request._id}`,
    details: {
      requestId: request._id,
      donorId: donorId
    }
  };
  await notifyUser(request.requester, notificationData, Notification);

  res.status(200).json({
    success: true,
    message: 'Request accepted successfully',
    data: request
  });
});

/**
 * Cancel a blood request (by requester or admin)
 * @route PUT /api/requests/:id/cancel
 * @access Private (Requester or Admin)
 */
export const cancelRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Find the request
  const request = await Request.findById(requestId).populate('requester');
  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Only requester or admin can cancel
  if (userRole !== 'admin' && request.requester._id.toString() !== userId) {
    throw new AppError('Not authorized to cancel this request', 403);
  }

  // Only allow cancelling if not already fulfilled or cancelled
  if (['fulfilled', 'cancelled', 'expired'].includes(request.status)) {
    throw new AppError(`Cannot cancel a request with status: ${request.status}`, 400);
  }

  request.status = 'cancelled';
  request.updatedAt = new Date();
  await request.save();

  // Notify assigned donor if any
  if (request.assignedDonor) {
    const donor = await User.findById(request.assignedDonor);
    if (donor) {
      const notificationData = {
        title: 'Request Cancelled',
        message: `The blood request you accepted has been cancelled by the requester or admin.`,
        type: 'cancel',
        actionUrl: `/requests/${request._id}`,
        details: {
          requestId: request._id
        }
      };
      await notifyUser(donor, notificationData, Notification);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Request cancelled successfully',
    data: request
  });
});

/**
 * Create a new blood request
 * @route POST /api/requests
 * @access Private (Requester only)
 */
export const createRequest = asyncHandler(async (req, res) => {
  const {
    bloodGroup,
    units,
    diseases = [],
    location,
    address,
    needByDate,
    urgency = 'medium',
    patientName,
    patientAge,
    patientGender,
    purpose,
    additionalNotes,
    isPublic = true
  } = req.body;

  // Validate required fields
  if (!bloodGroup || !units || !location || !address || !needByDate || !patientName || !purpose) {
    throw new AppError('Please provide all required fields', 400);
  }

  // Create request
  const request = new Request({
    requester: req.user.id,
    bloodGroup,
    units,
    diseases,
    location,
    address,
    needByDate,
    urgency,
    patientName,
    patientAge,
    patientGender,
    purpose,
    additionalNotes,
    isPublic,
    status: 'pending',
    createdAt: new Date()
  });

  await request.save();

  res.status(201).json({
    success: true,
    message: 'Blood request created successfully',
    data: request
  });
});

/**
 * Fulfill a blood request (by doctor)
 * @route PUT /api/requests/:id/fulfill
 * @access Private (Doctor only)
 */
export const fulfillRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.id;
  const doctorId = req.user.id;
  const { donationDate, hospitalName, hospitalAddress, notes } = req.body;

  // Find the request
  const request = await Request.findById(requestId).populate('assignedDonor requester');
  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Only allow fulfilling if matched and not already fulfilled/cancelled
  if (request.status !== 'matched') {
    throw new AppError('Only matched requests can be fulfilled', 400);
  }

  // Mark as fulfilled
  request.status = 'fulfilled';
  request.fulfilledAt = new Date();
  request.verifiedBy = doctorId;
  request.verifiedAt = new Date();
  request.hospital = {
    name: hospitalName || '',
    address: hospitalAddress || '',
    phone: req.user.phone || ''
  };
  request.notes = notes || '';
  await request.save();

  // Notify requester and donor
  if (request.requester) {
    const notificationData = {
      title: 'Your blood request has been fulfilled!',
      message: 'The donation for your request has been completed and verified by a doctor.',
      type: 'fulfillment',
      actionUrl: `/requests/${request._id}`,
      details: { requestId: request._id }
    };
    await notifyUser(request.requester, notificationData, Notification);
  }
  if (request.assignedDonor) {
    const donor = await User.findById(request.assignedDonor);
    if (donor) {
      const notificationData = {
        title: 'Donation Verified',
        message: 'Your blood donation has been verified by a doctor. Thank you!',
        type: 'fulfillment',
        actionUrl: `/requests/${request._id}`,
        details: { requestId: request._id }
      };
      await notifyUser(donor, notificationData, Notification);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Request fulfilled and verified successfully',
    data: request
  });
});

/**
 * Get a blood request by ID
 * @route GET /api/requests/:id
 * @access Private
 */
export const getRequestById = asyncHandler(async (req, res) => {
  const requestId = req.params.id;
  const request = await Request.findById(requestId)
    .populate('requester', 'name email phone')
    .populate('assignedDonor', 'name email phone')
    .populate('verifiedBy', 'name email phone');

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  res.status(200).json({
    success: true,
    data: request
  });
});

/**
 * Get all blood requests (with optional filters)
 * @route GET /api/requests
 * @access Private
 */
export const getRequests = asyncHandler(async (req, res) => {
  const { status, bloodGroup, requester, assignedDonor, page = 1, limit = 10 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (bloodGroup) query.bloodGroup = bloodGroup;
  if (requester) query.requester = requester;
  if (assignedDonor) query.assignedDonor = assignedDonor;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const requests = await Request.find(query)
    .populate('requester', 'name email phone')
    .populate('assignedDonor', 'name email phone')
    .populate('verifiedBy', 'name email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Request.countDocuments(query);

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: requests
  });
});

/**
 * Update a blood request (by requester or admin)
 * @route PUT /api/requests/:id
 * @access Private (Requester or Admin)
 */
export const updateRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Find the request
  const request = await Request.findById(requestId);
  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Only requester or admin can update
  if (userRole !== 'admin' && request.requester.toString() !== userId) {
    throw new AppError('Not authorized to update this request', 403);
  }

  // Only allow updating if not fulfilled, cancelled, or expired
  if (['fulfilled', 'cancelled', 'expired'].includes(request.status)) {
    throw new AppError(`Cannot update a request with status: ${request.status}`, 400);
  }

  // Update allowed fields
  const updatableFields = [
    'bloodGroup', 'units', 'diseases', 'location', 'address', 'needByDate',
    'urgency', 'patientName', 'patientAge', 'patientGender', 'purpose', 'additionalNotes', 'isPublic'
  ];
  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      request[field] = req.body[field];
    }
  });
  request.updatedAt = new Date();
  await request.save();

  res.status(200).json({
    success: true,
    message: 'Request updated successfully',
    data: request
  });
});