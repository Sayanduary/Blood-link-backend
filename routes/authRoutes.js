import User from '../models/User.js';
import Request from '../models/Request.js';
import Chat from '../models/Chat.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * Get requester's active requests
 * @route GET /api/requesters/active-requests
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const getActiveRequests = asyncHandler(async (req, res) => {
  const activeRequests = await Request.find({
    requester: req.user.id,
    status: { $in: ['pending', 'matched'] }
  })
    .populate('assignedDonor', 'name phone bloodGroup')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: activeRequests.length,
    data: activeRequests
  });
});

/**
 * Get requester's request history
 * @route GET /api/requesters/request-history
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const getRequestHistory = asyncHandler(async (req, res) => {
  const requests = await Request.find({
    requester: req.user.id
  })
    .populate('assignedDonor', 'name bloodGroup')
    .populate('verifiedBy', 'name hospitalName')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: requests.length,
    data: requests
  });
});

/**
 * Get requester statistics
 * @route GET /api/requesters/stats
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const getRequesterStats = asyncHandler(async (req, res) => {
  // Count requests by status
  const statusCounts = await Request.aggregate([
    { $match: { requester: req.user.id } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  // Format status counts
  const statusData = {};
  statusCounts.forEach(item => {
    statusData[item._id] = item.count;
  });

  // Count requests by month
  const monthlyRequests = await Request.aggregate([
    { $match: { requester: req.user.id } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  // Format monthly data
  const monthlyData = monthlyRequests.map(item => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count
  }));

  // Get fulfilled requests details
  const fulfilledRequests = await Request.find({
    requester: req.user.id,
    status: 'fulfilled'
  }).select('bloodGroup units fulfilledAt createdAt');

  // Calculate average fulfillment time
  let totalFulfillmentTime = 0;
  let fulfillmentCount = 0;

  fulfilledRequests.forEach(request => {
    if (request.createdAt && request.fulfilledAt) {
      const timeDiff = request.fulfilledAt - request.createdAt;
      totalFulfillmentTime += timeDiff;
      fulfillmentCount++;
    }
  });

  const avgFulfillmentTime = fulfillmentCount > 0
    ? totalFulfillmentTime / fulfillmentCount / (1000 * 60 * 60) // in hours
    : 0;

  res.status(200).json({
    success: true,
    data: {
      totalRequests: statusCounts.reduce((acc, curr) => acc + curr.count, 0),
      statusData,
      monthlyData,
      avgFulfillmentTime: Math.round(avgFulfillmentTime * 10) / 10, // round to 1 decimal place
      totalUnitsFulfilled: fulfilledRequests.reduce((acc, curr) => acc + curr.units, 0)
    }
  });
});

/**
 * Update requester profile
 * @route PUT /api/requesters/profile
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const updateRequesterProfile = asyncHandler(async (req, res) => {
  const {
    name,
    phone,
    address,
    location,
    bloodGroup,
    diseases
  } = req.body;

  const requester = await User.findById(req.user.id);

  if (!requester) {
    throw new AppError('Requester not found', 404);
  }

  // Update fields if provided
  if (name) requester.name = name;
  if (phone) requester.phone = phone;
  if (address) requester.address = address;
  if (location) requester.location = location;
  if (bloodGroup) requester.bloodGroup = bloodGroup;
  if (diseases) requester.diseases = diseases;

  requester.updatedAt = new Date();
  await requester.save();

  // Remove password from response
  const requesterResponse = { ...requester._doc };
  delete requesterResponse.password;

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: requesterResponse
  });
});

/**
 * Get blood donation status for requester
 * @route GET /api/requesters/donation-status/:requestId
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const getDonationStatus = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const request = await Request.findById(requestId)
    .populate('assignedDonor', 'name phone bloodGroup')
    .populate('verifiedBy', 'name hospitalName');

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Check if requester owns this request
  if (request.requester.toString() !== req.user.id) {
    throw new AppError('Not authorized to view this request', 403);
  }

  // Get chat with donor if matched
  let chat = null;
  if (request.assignedDonor) {
    chat = await Chat.findOne({
      participants: { $all: [req.user.id, request.assignedDonor._id] },
      request: requestId
    }).select('_id');
  }

  // Determine time remaining
  let timeRemaining = null;
  if (request.status === 'pending') {
    const now = new Date();
    const needBy = new Date(request.needByDate);
    const diff = needBy - now;
    timeRemaining = diff > 0 ? diff : 0;
  }

  // Determine status text and next steps
  let statusText = '';
  let nextSteps = '';

  switch (request.status) {
    case 'pending':
      statusText = 'Your request is waiting for a donor';
      nextSteps = 'We\'ll notify you when a donor accepts your request';
      break;
    case 'matched':
      statusText = 'A donor has accepted your request';
      nextSteps = 'Contact the donor to coordinate the donation';
      break;
    case 'fulfilled':
      statusText = 'Your request has been fulfilled';
      nextSteps = 'The donation has been verified by a doctor';
      break;
    case 'expired':
      statusText = 'Your request has expired';
      nextSteps = 'Create a new request if you still need blood';
      break;
    case 'cancelled':
      statusText = 'Your request was cancelled';
      nextSteps = 'Create a new request if you still need blood';
      break;
    default:
      statusText = 'Unknown status';
      nextSteps = 'Contact support for assistance';
  }

  res.status(200).json({
    success: true,
    data: {
      request,
      chat: chat ? chat._id : null,
      timeRemaining,
      statusText,
      nextSteps,
      timeElapsed: new Date() - request.createdAt,
      daysAgo: Math.floor((new Date() - request.createdAt) / (1000 * 60 * 60 * 24))
    }
  });
});

/**
 * Get compatible donors for a request
 * @route GET /api/requesters/compatible-donors/:requestId
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const getCompatibleDonors = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const request = await Request.findById(requestId);

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Check if requester owns this request
  if (request.requester.toString() !== req.user.id) {
    throw new AppError('Not authorized to view this request', 403);
  }

  // Check if request is already matched or fulfilled
  if (request.status !== 'pending') {
    throw new AppError(`Cannot find donors for a request with status: ${request.status}`, 400);
  }

  // Define blood type compatibility for recipients
  const compatibleDonorGroups = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-']
  };

  // Get compatible blood groups for the requested blood type
  const compatibleGroups = compatibleDonorGroups[request.bloodGroup] || [];

  if (compatibleGroups.length === 0) {
    throw new AppError('Invalid blood group in request', 400);
  }

  // Find eligible donors within radius
  const radius = 20; // km
  const donors = await User.find({
    role: 'donor',
    isAvailable: true,
    isActive: true,
    bloodGroup: { $in: compatibleGroups },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: request.location.coordinates
        },
        $maxDistance: radius * 1000 // Convert km to meters
      }
    }
  })
    .select('name bloodGroup lastDonationDate donationCount location')
    .limit(20);

  // Calculate distance for each donor
  const donorsWithDistance = donors.map(donor => {
    // Calculate distance using Haversine formula
    const [lon1, lat1] = request.location.coordinates;
    const [lon2, lat2] = donor.location.coordinates;

    // Earth's radius in kilometers
    const R = 6371;

    // Convert degrees to radians
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    // Haversine formula
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return {
      id: donor._id,
      name: donor.name,
      bloodGroup: donor.bloodGroup,
      distance: Math.round(distance * 10) / 10, // km rounded to 1 decimal place
      donationCount: donor.donationCount,
      lastDonationDate: donor.lastDonationDate
    };
  });

  // Sort by distance
  donorsWithDistance.sort((a, b) => a.distance - b.distance);

  res.status(200).json({
    success: true,
    count: donorsWithDistance.length,
    data: donorsWithDistance
  });
});

/**
 * Contact a donor directly
 * @route POST /api/requesters/contact-donor
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const contactDonor = asyncHandler(async (req, res) => {
  const { donorId, requestId, message } = req.body;

  if (!donorId || !message) {
    throw new AppError('Please provide donor ID and message', 400);
  }

  // Check if request exists and belongs to requester
  let request = null;
  if (requestId) {
    request = await Request.findById(requestId);

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    if (request.requester.toString() !== req.user.id) {
      throw new AppError('Not authorized to use this request', 403);
    }
  }

  // Check if donor exists
  const donor = await User.findById(donorId);
  if (!donor || donor.role !== 'donor') {
    throw new AppError('Donor not found', 404);
  }

  // Create or access chat
  const chat = await Chat.findOrCreateChat(req.user.id, donorId, requestId);

  // Create first message
  const Message = mongoose.model('Message');
  const newMessage = new Message({
    chat: chat._id,
    sender: req.user.id,
    content: message,
    contentType: 'text',
    readBy: [req.user.id],
    createdAt: new Date()
  });

  await newMessage.save();

  // Update chat with latest message
  chat.latestMessage = newMessage._id;
  chat.updatedAt = new Date();
  await chat.save();

  // Send notification to donor
  const Notification = mongoose.model('Notification');
  const notification = new Notification({
    user: donorId,
    title: 'New Message from Requester',
    message: `${req.user.name}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
    type: 'message',
    actionUrl: `/chat/${chat._id}`,
    relatedTo: {
      model: 'Chat',
      id: chat._id
    },
    isRead: false,
    createdAt: new Date()
  });

  await notification.save();

  // Send real-time notification if possible
  const io = req.app.get('io');
  const socketStore = req.app.get('socketStore');

  if (io && socketStore) {
    const socketId = socketStore.getUserSocket(donorId);
    if (socketId) {
      io.to(socketId).emit('new-message', {
        chat: chat._id,
        message: newMessage
      });

      io.to(socketId).emit('notification', notification);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      chat: chat._id,
      message: newMessage
    }
  });
});

/**
 * Rate a donor after donation
 * @route POST /api/requesters/rate-donor
 * @access Private (Requester only)
 * @created 2025-06-20 17:29:17 by Sayanduary
 */
export const rateDonor = asyncHandler(async (req, res) => {
  const { requestId, rating, feedback } = req.body;

  if (!requestId || !rating || rating < 1 || rating > 5) {
    throw new AppError('Please provide request ID and valid rating (1-5)', 400);
  }

  const request = await Request.findById(requestId);

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Check if requester owns this request
  if (request.requester.toString() !== req.user.id) {
    throw new AppError('Not authorized to rate this donation', 403);
  }

  // Check if request is fulfilled
  if (request.status !== 'fulfilled') {
    throw new AppError('Can only rate fulfilled donations', 400);
  }

  // Check if donor exists
  if (!request.assignedDonor) {
    throw new AppError('No donor assigned to this request', 400);
  }

  // Add rating to request
  request.donorRating = {
    rating,
    feedback: feedback || '',
    ratedAt: new Date()
  };

  await request.save();

  // Update donor's average rating
  const donorRatings = await Request.find({
    assignedDonor: request.assignedDonor,
    'donorRating.rating': { $exists: true }
  }).select('donorRating.rating');

  const totalRatings = donorRatings.length;
  const avgRating = donorRatings.reduce((acc, curr) => acc + curr.donorRating.rating, 0) / totalRatings;

  const donor = await User.findById(request.assignedDonor);
  donor.avgRating = Math.round(avgRating * 10) / 10; // Round to 1 decimal place
  donor.ratingCount = totalRatings;
  await donor.save();

  res.status(200).json({
    success: true,
    message: 'Donor rated successfully',
    data: {
      requestId,
      rating,
      feedback,
      donorAvgRating: donor.avgRating,
      donorRatingCount: donor.ratingCount
    }
  });
});