import User from '../models/User.js';
import Request from '../models/Request.js';
import Donation from '../models/Donation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { buildNearbyQuery } from '../utils/geoUtils.js';
import { notifyUser } from '../utils/notify.js';
import Notification from '../models/Notification.js';

/**
 * Toggle donor availability status
 * @route PUT /api/donors/toggle-availability
 * @access Private (Donor only)
 */
export const toggleAvailability = asyncHandler(async (req, res) => {
  const donor = await User.findById(req.user.id);
  
  if (!donor || donor.role !== 'donor') {
    throw new AppError('Donor not found', 404);
  }
  
  // Toggle availability
  donor.isAvailable = !donor.isAvailable;
  donor.updatedAt = new Date();
  await donor.save();
  
  res.status(200).json({
    success: true,
    message: `You are now ${donor.isAvailable ? 'available' : 'unavailable'} for donation`,
    data: {
      isAvailable: donor.isAvailable
    }
  });
});

/**
 * Get donor's active requests (requests they've accepted)
 * @route GET /api/donors/active-requests
 * @access Private (Donor only)
 */
export const getActiveRequests = asyncHandler(async (req, res) => {
  const activeRequests = await Request.find({
    assignedDonor: req.user.id,
    status: 'matched'
  })
  .populate('requester', 'name phone')
  .sort({ matchedAt: -1 });
  
  res.status(200).json({
    success: true,
    count: activeRequests.length,
    data: activeRequests
  });
});

/**
 * Get donor's donation history
 * @route GET /api/donors/donation-history
 * @access Private (Donor only)
 */
export const getDonationHistory = asyncHandler(async (req, res) => {
  const donations = await Donation.find({
    donor: req.user.id
  })
  .populate('requester', 'name')
  .populate('request', 'bloodGroup units')
  .populate('verifiedBy', 'name hospitalName')
  .sort({ donationDate: -1 });
  
  res.status(200).json({
    success: true,
    count: donations.length,
    data: donations
  });
});

/**
 * Get nearby blood requests matching donor's blood type
 * @route GET /api/donors/nearby-requests
 * @access Private (Donor only)
 */
export const getNearbyRequests = asyncHandler(async (req, res) => {
  const donor = await User.findById(req.user.id);
  
  if (!donor || donor.role !== 'donor') {
    throw new AppError('Donor not found', 404);
  }
  
  // Check if donor has location
  if (!donor.location || !donor.location.coordinates) {
    throw new AppError('Please update your location to find nearby requests', 400);
  }
  
  // Get custom radius from request or use donor's preference
  const radius = req.query.radius || donor.preferences?.radius || 10;
  
  // Build geo query
  const geoQuery = buildNearbyQuery(donor.location.coordinates, radius);
  
  // Find pending requests compatible with donor's blood type
  const compatibilityMap = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };
  
  // Get blood groups that this donor can donate to
  const compatibleGroups = compatibilityMap[donor.bloodGroup] || [];
  
  const nearbyRequests = await Request.find({
    ...geoQuery,
    status: 'pending',
    bloodGroup: { $in: compatibleGroups },
    isPublic: true
  })
  .populate('requester', 'name')
  .sort({ needByDate: 1 });
  
  res.status(200).json({
    success: true,
    count: nearbyRequests.length,
    data: nearbyRequests
  });
});

/**
 * Get donor statistics
 * @route GET /api/donors/stats
 * @access Private (Donor only)
 */
export const getDonorStats = asyncHandler(async (req, res) => {
  const donationCount = await Donation.countDocuments({ donor: req.user.id });
  
  const monthlyDonations = await Donation.aggregate([
    { $match: { donor: req.user.id } },
    {
      $group: {
        _id: {
          year: { $year: "$donationDate" },
          month: { $month: "$donationDate" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
  
  // Format monthly data
  const monthlyData = monthlyDonations.map(item => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count
  }));
  
  // Get blood groups donated to
  const bloodGroupData = await Donation.aggregate([
    { $match: { donor: req.user.id } },
    {
      $group: {
        _id: "$bloodGroup",
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Format blood group data
  const bloodGroups = bloodGroupData.map(item => ({
    bloodGroup: item._id,
    count: item.count
  }));
  
  res.status(200).json({
    success: true,
    data: {
      totalDonations: donationCount,
      monthlyData,
      bloodGroups
    }
  });
});

/**
 * Check donor eligibility
 * @route GET /api/donors/check-eligibility
 * @access Private (Donor only)
 */
export const checkEligibility = asyncHandler(async (req, res) => {
  const donor = await User.findById(req.user.id);
  
  if (!donor || donor.role !== 'donor') {
    throw new AppError('Donor not found', 404);
  }
  
  // Check if donor has donated in the last 3 months
  let isEligible = true;
  let reason = null;
  let nextEligibleDate = null;
  
  if (donor.lastDonationDate) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    if (donor.lastDonationDate > threeMonthsAgo) {
      isEligible = false;
      
      // Calculate next eligible date
      nextEligibleDate = new Date(donor.lastDonationDate);
      nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 3);
      
      reason = `You last donated on ${donor.lastDonationDate.toISOString().split('T')[0]}. You need to wait 3 months between donations.`;
    }
  }
  
  res.status(200).json({
    success: true,
    data: {
      isEligible,
      reason,
      nextEligibleDate,
      lastDonationDate: donor.lastDonationDate
    }
  });
});