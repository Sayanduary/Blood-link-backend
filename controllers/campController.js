import Camp from '../models/Camp.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { notifyUser } from '../utils/notify.js';
import Notification from '../models/Notification.js';

/**
 * Create donation camp
 * @route POST /api/camps
 * @access Private (NGO only)
 */
export const createCamp = asyncHandler(async (req, res) => {
  const { 
    title, 
    description, 
    location, 
    address,
    startDate,
    endDate,
    startTime,
    endTime,
    targetUnits,
    bloodGroups,
    image,
    contactPerson,
    additionalInfo
  } = req.body;
  
  // Check if user is NGO
  if (req.user.role !== 'ngo') {
    throw new AppError('Only NGOs can create donation camps', 403);
  }
  
  // Validate required fields
  if (!title || !description || !location || !address || !startDate || !endDate) {
    throw new AppError('Please provide all required fields', 400);
  }
  
  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    throw new AppError('End date must be after start date', 400);
  }
  
  const camp = new Camp({
    title,
    description,
    organizer: req.user.id,
    location,
    address,
    startDate: start,
    endDate: end,
    startTime: startTime || '09:00',
    endTime: endTime || '17:00',
    targetUnits: targetUnits || 50,
    bloodGroups: bloodGroups || ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    image,
    contactPerson: contactPerson || {
      name: req.user.name,
      phone: req.user.phone,
      email: req.user.email
    },
    additionalInfo,
    status: start <= new Date() ? 'ongoing' : 'upcoming',
    createdAt: new Date()
  });
  
  await camp.save();
  
  // Increment camp count for NGO
  const ngo = await User.findById(req.user.id);
  if (ngo) {
    ngo.campCount = (ngo.campCount || 0) + 1;
    await ngo.save();
  }
  
  // Notify nearby donors
  try {
    // Find donors within 20km
    const nearbyDonors = await User.find({
      role: 'donor',
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: location.coordinates
          },
          $maxDistance: 20000 // 20km
        }
      }
    }).select('_id');
    
    if (nearbyDonors.length > 0) {
      const notificationData = {
        title: 'New Blood Donation Camp',
        message: `${ngo.ngoName || ngo.name} is organizing a blood donation camp near you on ${start.toLocaleDateString()}.`,
        type: 'system',
        actionUrl: `/camps/${camp._id}`,
        details: {
          campId: camp._id,
          ngoId: ngo._id,
          ngoName: ngo.ngoName || ngo.name
        }
      };
      
      // Batch notify donors
      const notificationPromises = nearbyDonors.map(donor => 
        notifyUser(donor, notificationData, Notification)
      );
      
      await Promise.allSettled(notificationPromises);
    }
  } catch (error) {
    console.error('Error notifying donors about camp:', error);
    // Continue with response, don't fail the request
  }
  
  res.status(201).json({
    success: true,
    message: 'Donation camp created successfully',
    data: camp
  });
});

/**
 * Get all camps (with filters)
 * @route GET /api/camps
 * @access Public
 */
export const getCamps = asyncHandler(async (req, res) => {
  const { 
    status, 
    organizer, 
    nearMe,
    lat,
    lng,
    radius = 20,
    bloodGroup,
    page = 1,
    limit = 10,
    sort = 'upcoming'
  } = req.query;
  
  // Build query
  let query = {};
  
  // Status filter
  if (status) {
    query.status = status;
  } else {
    // Default to active camps (upcoming and ongoing)
    query.status = { $in: ['upcoming', 'ongoing'] };
  }
  
  // Organizer filter
  if (organizer) {
    query.organizer = organizer;
  }
  
  // Blood group filter
  if (bloodGroup) {
    query.bloodGroups = bloodGroup;
  }
  
  // Near me filter
  if (nearMe === 'true' && lat && lng) {
    const coordinates = [parseFloat(lng), parseFloat(lat)];
    
    // Use the static method to find nearby camps
    const nearbyCamps = await Camp.findNearbyCamps(coordinates, parseInt(radius));
    
    res.status(200).json({
      success: true,
      count: nearbyCamps.length,
      data: nearbyCamps
    });
    return;
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Determine sort order
  let sortOptions = {};
  switch(sort) {
    case 'upcoming':
      sortOptions = { startDate: 1 };
      break;
    case 'recent':
      sortOptions = { startDate: -1 };
      break;
    case 'popular':
      sortOptions = { 'participants.length': -1 };
      break;
    default:
      sortOptions = { startDate: 1 };
  }
  
  // Execute query
  const camps = await Camp.find(query)
    .populate('organizer', 'name ngoName')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const total = await Camp.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: camps.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: camps
  });
});

/**
 * Get camp by ID
 * @route GET /api/camps/:id
 * @access Public
 */
export const getCampById = asyncHandler(async (req, res) => {
  const camp = await Camp.findById(req.params.id)
    .populate('organizer', 'name ngoName email phone')
    .populate('participants.user', 'name');
  
  if (!camp) {
    throw new AppError('Camp not found', 404);
  }
  
  res.status(200).json({
    success: true,
    data: camp
  });
});

/**
 * Update camp
 * @route PUT /api/camps/:id
 * @access Private (Organizer or Admin)
 */
export const updateCamp = asyncHandler(async (req, res) => {
  let camp = await Camp.findById(req.params.id);
  
  if (!camp) {
    throw new AppError('Camp not found', 404);
  }
  
  // Check ownership
  if (camp.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this camp', 403);
  }
  
  // Prevent updating completed or cancelled camps
  if (['completed', 'cancelled'].includes(camp.status)) {
    throw new AppError(`Cannot update camp with status: ${camp.status}`, 400);
  }
  
  // Update camp
  camp = await Camp.findByIdAndUpdate(
    req.params.id,
    { 
      ...req.body,
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    message: 'Camp updated successfully',
    data: camp
  });
});

/**
 * Cancel camp
 * @route PUT /api/camps/:id/cancel
 * @access Private (Organizer or Admin)
 */
export const cancelCamp = asyncHandler(async (req, res) => {
  const camp = await Camp.findById(req.params.id);
  
  if (!camp) {
    throw new AppError('Camp not found', 404);
  }
  
  // Check ownership
  if (camp.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to cancel this camp', 403);
  }
  
  // Prevent cancelling completed camps
  if (camp.status === 'completed') {
    throw new AppError('Cannot cancel a completed camp', 400);
  }
  
  // Update camp status
  camp.status = 'cancelled';
  camp.updatedAt = new Date();
  await camp.save();
  
  // Notify registered participants
  if (camp.participants.length > 0) {
    const notificationData = {
      title: 'Camp Cancelled',
      message: `The blood donation camp "${camp.title}" has been cancelled.`,
      type: 'system',
      actionUrl: `/camps/${camp._id}`,
      details: {
        campId: camp._id
      }
    };
    
    // Get all participant user ids
    const participantIds = camp.participants.map(p => p.user);
    
    // Find all participants
    const participants = await User.find({ _id: { $in: participantIds } });
    
    // Notify each participant
    participants.forEach(async (participant) => {
      try {
        await notifyUser(participant, notificationData, Notification);
      } catch (error) {
        console.error(`Failed to notify participant ${participant._id}:`, error);
      }
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Camp cancelled successfully',
    data: camp
  });
});

/**
 * Register for a camp
 * @route POST /api/camps/:id/register
 * @access Private
 */
export const registerForCamp = asyncHandler(async (req, res) => {
  const camp = await Camp.findById(req.params.id);
  
  if (!camp) {
    throw new AppError('Camp not found', 404);
  }
  
  // Check if camp is active
  if (camp.status !== 'upcoming' && camp.status !== 'ongoing') {
    throw new AppError(`Cannot register for camp with status: ${camp.status}`, 400);
  }
  
  // Check if already registered
  const isRegistered = camp.participants.some(p => 
    p.user.toString() === req.user.id
  );
  
  if (isRegistered) {
    throw new AppError('You are already registered for this camp', 400);
  }
  
  // Add user to participants
  camp.participants.push({
    user: req.user.id,
    registrationDate: new Date()
  });
  
  await camp.save();
  
  // Notify NGO organizer
  const organizer = await User.findById(camp.organizer);
  
  if (organizer) {
    const user = await User.findById(req.user.id);
    
    const notificationData = {
      title: 'New Camp Registration',
      message: `${user.name} has registered for your blood donation camp "${camp.title}".`,
      type: 'system',
      actionUrl: `/camps/${camp._id}/participants`,
      details: {
        campId: camp._id,
        userId: user._id,
        userName: user.name
      }
    };
    
    await notifyUser(organizer, notificationData, Notification);
  }
  
  res.status(200).json({
    success: true,
    message: 'Registered for camp successfully',
    data: {
      campId: camp._id,
      registrationDate: new Date()
    }
  });
});

/**
 * Unregister from a camp
 * @route DELETE /api/camps/:id/register
 * @access Private
 */
export const unregisterFromCamp = asyncHandler(async (req, res) => {
  const camp = await Camp.findById(req.params.id);
  
  if (!camp) {
    throw new AppError('Camp not found', 404);
  }
  
  // Check if camp is active
  if (camp.status !== 'upcoming') {
    throw new AppError('Cannot unregister from an ongoing or completed camp', 400);
  }
  
  // Check if registered
  const participantIndex = camp.participants.findIndex(p => 
    p.user.toString() === req.user.id
  );
  
  if (participantIndex === -1) {
    throw new AppError('You are not registered for this camp', 400);
  }
  
  // Remove user from participants
  camp.participants.splice(participantIndex, 1);
  await camp.save();
  
  res.status(200).json({
    success: true,
    message: 'Unregistered from camp successfully'
  });
});