import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * Get donor heatmap data
 * @route GET /api/map/donors
 * @access Private
 */
export const getDonorHeatmap = asyncHandler(async (req, res) => {
  const { bloodGroup, radius = 50 } = req.query;
  
  // Build query
  let query = {
    role: 'donor',
    isAvailable: true,
    isActive: true,
    location: { $exists: true }
  };
  
  if (bloodGroup) {
    query.bloodGroup = bloodGroup;
  }
  
  // If user is not admin or doctor, anonymize the data
  const isPrivileged = ['admin', 'doctor'].includes(req.user.role);
  
  const donors = await User.find(query)
    .select(isPrivileged ? 'location name bloodGroup donationCount' : 'location bloodGroup');
  
  // Format data for heatmap
  const heatmapData = donors.map(donor => {
    const baseData = {
      location: donor.location,
      bloodGroup: donor.bloodGroup
    };
    
    // Only include identifying info for privileged users
    if (isPrivileged) {
      return {
        ...baseData,
        id: donor._id,
        name: donor.name,
        donationCount: donor.donationCount
      };
    }
    
    return baseData;
  });
  
  // Group by blood group for statistics
  const bloodGroupStats = donors.reduce((acc, donor) => {
    acc[donor.bloodGroup] = (acc[donor.bloodGroup] || 0) + 1;
    return acc;
  }, {});
  
  res.status(200).json({
    success: true,
    count: donors.length,
    data: heatmapData,
    stats: {
      bloodGroups: bloodGroupStats
    }
  });
});

/**
 * Get donation camp map data
 * @route GET /api/map/camps
 * @access Public
 */
export const getCampMap = asyncHandler(async (req, res) => {
  const { status } = req.query;
  
  // Build query
  let query = {
    location: { $exists: true }
  };
  
  if (status) {
    query.status = status;
  } else {
    query.status = { $in: ['upcoming', 'ongoing'] };
  }
  
  const Camp = mongoose.model('Camp');
  const camps = await Camp.find(query)
    .select('title location address startDate endDate status organizer')
    .populate('organizer', 'name ngoName');
  
  // Format data for map
  const mapData = camps.map(camp => ({
    id: camp._id,
    title: camp.title,
    location: camp.location,
    address: camp.address,
    startDate: camp.startDate,
    endDate: camp.endDate,
    status: camp.status,
    organizer: camp.organizer.ngoName || camp.organizer.name
  }));
  
  res.status(200).json({
    success: true,
    count: camps.length,
    data: mapData
  });
});

/**
 * Get request map data
 * @route GET /api/map/requests
 * @access Private
 */
export const getRequestMap = asyncHandler(async (req, res) => {
  const { bloodGroup, status } = req.query;
  
  // Build query
  let query = {
    location: { $exists: true },
    isPublic: true
  };
  
  if (bloodGroup) {
    query.bloodGroup = bloodGroup;
  }
  
  if (status) {
    query.status = status;
  } else {
    query.status = 'pending';
  }
  
  const Request = mongoose.model('Request');
  const requests = await Request.find(query)
    .select('bloodGroup location address status urgency needByDate');
  
  // Format data for map
  const mapData = requests.map(request => ({
    id: request._id,
    bloodGroup: request.bloodGroup,
    location: request.location,
    address: request.address,
    status: request.status,
    urgency: request.urgency,
    needByDate: request.needByDate
  }));
  
  res.status(200).json({
    success: true,
    count: requests.length,
    data: mapData
  });
});