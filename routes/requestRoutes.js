import Request from '../models/Request.js';
import User from '../models/User.js';
import { findNearbyDonors, isBloodCompatible } from '../utils/geoUtils.js';
import { notifyUser } from '../utils/notify.js';
import Notification from '../models/Notification.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * Create a new blood request
 * @route POST /api/requests
 * @access Private
 */
export const createRequest = asyncHandler(async (req, res) => {
  const {
    bloodGroup,
    units,
    diseases,
    location,
    address,
    hospital,
    needByDate,
    urgency,
    patientName,
    patientAge,
    patientGender,
    purpose,
    additionalNotes,
    contactDetails,
    isPublic
  } = req.body;

  if (!bloodGroup || !units || !location || !address || !needByDate || !patientName || !purpose) {
    throw new AppError('Please provide all required fields', 400);
  }

  // Create the request
  const request = new Request({
    requester: req.user.id,
    bloodGroup,
    units,
    diseases: diseases || [],
    location,
    address,
    hospital,
    needByDate: new Date(needByDate),
    urgency: urgency || 'medium',
    patientName,
    patientAge,
    patientGender,
    purpose,
    additionalNotes,
    contactDetails,
    isPublic: isPublic !== false,
    status: 'pending',
    createdAt: new Date()
  });

  await request.save();

  // Find nearby donors who match the blood group
  const matchingDonors = await findNearbyDonors(
    location.coordinates,
    bloodGroup,
    10, // Default radius in kilometers
    User
  );

  // Notify matching donors if any found
  if (matchingDonors.length > 0) {
    const notificationData = {
      title: 'New Blood Request',
      message: `Someone needs ${bloodGroup} blood ${units} unit(s) near you. Can you help?`,
      type: 'request',
      actionUrl: `/requests/${request._id}`,
      details: {
        requestId: request._id,
        bloodGroup,
        units,
        location: address
      }
    };
    for (const donor of matchingDonors) {
      try {
        await notifyUser(donor, notificationData, Notification);
      } catch (error) {
        console.error(`Failed to notify donor ${donor._id}:`, error);
      }
    }
  }

  res.status(201).json({
    success: true,
    message: 'Blood request created successfully',
    data: {
      request,
      potentialDonors: matchingDonors.length
    }
  });
});

/**
 * Get all requests (with filters)
 * @route GET /api/requests
 * @access Private
 */
export const getRequests = asyncHandler(async (req, res) => {
  const { 
    bloodGroup, 
    status, 
    urgency, 
    isPublic,
    nearMe,
    lat,
    lng,
    radius = 10
  } = req.query;

  let query = {};
  if (bloodGroup) query.bloodGroup = bloodGroup;
  if (status) query.status = status;
  if (urgency) query.urgency = urgency;
  if (isPublic !== undefined) query.isPublic = isPublic === 'true';

  if (nearMe === 'true' && lat && lng) {
    const coordinates = [parseFloat(lng), parseFloat(lat)];
    const nearbyRequests = await Request.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates
          },
          $maxDistance: parseInt(radius) * 1000
        }
      },
      status: 'pending'
    });
    res.status(200).json({
      success: true,
      count: nearbyRequests.length,
      data: nearbyRequests
    });
    return;
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const requests = await Request.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('requester', 'name')
    .populate('assignedDonor', 'name');

  const total = await Request.countDocuments(query);

  res.status(200).json({
    success: true,
    count: requests.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: requests
  });
});

/**
 * Get request by ID
 * @route GET /api/requests/:id
 * @access Private
 */
export const getRequestById = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id)
    .populate('requester', 'name email phone')
    .populate('assignedDonor', 'name')
    .populate('verifiedBy', 'name hospitalName');

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  if (!request.isPublic && 
      request.requester._id.toString() !== req.user.id && 
      req.user.role !== 'admin' && 
      request.assignedDonor?._id.toString() !== req.user.id) {
    throw new AppError('Not authorized to view this request', 403);
  }

  res.status(200).json({
    success: true,
    data: request
  });
});

/**
 * Update request
 * @route PUT /api/requests/:id
 * @access Private
 */
export const updateRequest = asyncHandler(async (req, res) => {
  let request = await Request.findById(req.params.id);

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  if (request.requester.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this request', 403);
  }

  if (['matched', 'fulfilled'].includes(request.status)) {
    throw new AppError(`Cannot update request with status: ${request.status}`, 400);
  }

  const updatedRequest = await Request.findByIdAndUpdate(
    req.params.id,
    { 
      ...req.body,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Request updated successfully',
    data: updatedRequest
  });
});

/**
 * Cancel request
 * @route PUT /api/requests/:id/cancel
 * @access Private
 */
export const cancelRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  if (request.requester.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to cancel this request', 403);
  }

  if (request.status === 'fulfilled') {
    throw new AppError('Cannot cancel a fulfilled request', 400);
  }

  if (request.status === 'matched' && request.assignedDonor) {
    const donor = await User.findById(request.assignedDonor);
    if (donor) {
      const notificationData = {
        title: 'Request Cancelled',
        message: `A blood request you accepted has been cancelled by the requester.`,
        type: 'request',
        actionUrl: `/requests/${request._id}`,
        details: {
          requestId: request._id
        }
      };
      await notifyUser(donor, notificationData, Notification);
    }
  }

  request.status = 'cancelled';
  request.updatedAt = new Date();
  await request.save();

  res.status(200).json({
    success: true,
    message: 'Request cancelled successfully',
    data: request
  });
});

/**
 * Accept request (for donors)
 * @route PUT /api/requests/:id/accept
 * @access Private (Donor only)
 */
export const acceptRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  if (req.user.role !== 'donor') {
    throw new AppError('Only donors can accept requests', 403);
  }

  if (request.status !== 'pending') {
    throw new AppError(`Cannot accept request with status: ${request.status}`, 400);
  }

  const donor = await User.findById(req.user.id);

  if (!donor.isAvailable) {
    throw new AppError('You are currently marked as unavailable for donation', 400);
  }

  if (!isBloodCompatible(donor.bloodGroup, request.bloodGroup)) {
    throw new AppError(`Your blood type ${donor.bloodGroup} is not compatible with the requested type ${request.bloodGroup}`, 400);
  }

  // Optionally: check donor eligibility by last donation date, diseases, etc.

  request.status = 'matched';
  request.assignedDonor = donor._id;
  request.matchedAt = new Date();
  request.updatedAt = new Date();
  await request.save();

  const requester = await User.findById(request.requester);

  if (requester) {
    const notificationData = {
      title: 'Donor Found!',
      message: `A donor has accepted your blood request. You can now chat with them to coordinate.`,
      type: 'match',
      actionUrl: `/requests/${request._id}`,
      details: {
        requestId: request._id,
        donorId: donor._id,
        donorName: donor.name
      }
    };
    await notifyUser(requester, notificationData, Notification);
  }

  res.status(200).json({
    success: true,
    message: 'Request accepted successfully',
    data: request
  });
});

/**
 * Mark request as fulfilled (for doctors)
 * @route PUT /api/requests/:id/fulfill
 * @access Private (Doctor only)
 */
export const fulfillRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  if (req.user.role !== 'doctor') {
    throw new AppError('Only doctors can verify fulfillment', 403);
  }

  if (request.status !== 'matched') {
    throw new AppError(`Cannot fulfill request with status: ${request.status}`, 400);
  }

  request.status = 'fulfilled';
  request.verifiedBy = req.user.id;
  request.verifiedAt = new Date();
  request.fulfilledAt = new Date();
  request.updatedAt = new Date();
  await request.save();

  const donor = await User.findById(request.assignedDonor);

  if (donor) {
    donor.donationCount = (donor.donationCount || 0) + 1;
    donor.lastDonationDate = new Date();
    await donor.save();

    const notificationData = {
      title: 'Donation Verified',
      message: `Your blood donation has been verified by Dr. ${req.user.name}. Thank you for saving lives!`,
      type: 'verification',
      actionUrl: `/donations/history`,
      details: {
        requestId: request._id
      }
    };
    await notifyUser(donor, notificationData, Notification);
  }

  const requester = await User.findById(request.requester);

  if (requester) {
    const notificationData = {
      title: 'Donation Completed',
      message: `The blood donation for your request has been verified by a doctor.`,
      type: 'donation',
      actionUrl: `/requests/${request._id}`,
      details: {
        requestId: request._id
      }
    };
    await notifyUser(requester, notificationData, Notification);
  }

  res.status(200).json({
    success: true,
    message: 'Request fulfilled successfully',
    data: request
  });
});