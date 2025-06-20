import User from '../models/User.js';
import Request from '../models/Request.js';
import Donation from '../models/Donation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { notifyUser } from '../utils/notify.js';
import Notification from '../models/Notification.js';

/**
 * Get pending verification requests
 * @route GET /api/doctors/pending-verifications
 * @access Private (Doctor only)
 */
export const getPendingVerifications = asyncHandler(async (req, res) => {
  const pendingRequests = await Request.find({
    status: 'matched'
  })
  .populate('requester', 'name phone')
  .populate('assignedDonor', 'name phone bloodGroup')
  .sort({ matchedAt: 1 });
  
  res.status(200).json({
    success: true,
    count: pendingRequests.length,
    data: pendingRequests
  });
});

/**
 * Verify donation
 * @route POST /api/doctors/verify-donation/:requestId
 * @access Private (Doctor only)
 */
export const verifyDonation = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { 
    units, 
    donationDate, 
    location, 
    hospitalName, 
    hospitalAddress, 
    notes,
    status
  } = req.body;
  
  // Validate input
  if (!units || !donationDate || !location || !hospitalName || !status) {
    throw new AppError('Please provide all required fields', 400);
  }
  
  // Find the request
  const request = await Request.findById(requestId)
    .populate('requester')
    .populate('assignedDonor');
  
  if (!request) {
    throw new AppError('Request not found', 404);
  }
  
  // Check if request is already verified
  if (request.status === 'fulfilled') {
    throw new AppError('This request has already been verified', 400);
  }
  
  // Check if request is matched
  if (request.status !== 'matched') {
    throw new AppError('Only matched requests can be verified', 400);
  }
  
  // Create donation record
  const donation = new Donation({
    donor: request.assignedDonor._id,
    request: request._id,
    requester: request.requester._id,
    bloodGroup: request.bloodGroup,
    units,
    donationDate: new Date(donationDate),
    location,
    hospitalName,
    hospitalAddress: hospitalAddress || '',
    verifiedBy: req.user.id,
    notes: notes || '',
    status
  });
  
  await donation.save();
  
  // Update request status
  request.status = status === 'verified' ? 'fulfilled' : 'expired';
  request.verifiedBy = req.user.id;
  request.verifiedAt = new Date();
  
  if (status === 'verified') {
    request.fulfilledAt = new Date();
  }
  
  await request.save();
  
  // If verified, update donor stats
  if (status === 'verified') {
    const donor = await User.findById(request.assignedDonor._id);
    
    if (donor) {
      donor.donationCount = (donor.donationCount || 0) + 1;
      donor.lastDonationDate = new Date(donationDate);
      await donor.save();
      
      // Notify donor
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
    
    // Notify requester
    const notificationData = {
      title: 'Donation Completed',
      message: `The blood donation for your request has been verified by a doctor.`,
      type: 'donation',
      actionUrl: `/requests/${request._id}`,
      details: {
        requestId: request._id
      }
    };
    
    await notifyUser(request.requester, notificationData, Notification);
  } else {
    // If rejected, notify both parties
    const donorNotification = {
      title: 'Donation Not Verified',
      message: `Your donation for a recent request could not be verified.`,
      type: 'verification',
      actionUrl: `/requests/${request._id}`,
      details: {
        requestId: request._id,
        reason: notes || 'No reason provided'
      }
    };
    
    const requesterNotification = {
      title: 'Donation Not Verified',
      message: `The donation for your request could not be verified.`,
      type: 'donation',
      actionUrl: `/requests/${request._id}`,
      details: {
        requestId: request._id,
        reason: notes || 'No reason provided'
      }
    };
    
    await notifyUser(request.assignedDonor, donorNotification, Notification);
    await notifyUser(request.requester, requesterNotification, Notification);
  }
  
  res.status(200).json({
    success: true,
    message: `Donation ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
    data: donation
  });
});

/**
 * Get verification history
 * @route GET /api/doctors/verification-history
 * @access Private (Doctor only)
 */
export const getVerificationHistory = asyncHandler(async (req, res) => {
  const verifications = await Donation.find({
    verifiedBy: req.user.id
  })
  .populate('donor', 'name bloodGroup')
  .populate('requester', 'name')
  .populate('request', 'bloodGroup units')
  .sort({ verificationDate: -1 });
  
  res.status(200).json({
    success: true,
    count: verifications.length,
    data: verifications
  });
});

/**
 * Get doctor statistics
 * @route GET /api/doctors/stats
 * @access Private (Doctor only)
 */
export const getDoctorStats = asyncHandler(async (req, res) => {
  // Count verifications by status
  const statusCounts = await Donation.aggregate([
    { $match: { verifiedBy: req.user.id } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  
  // Format status counts
  const statusData = {};
  statusCounts.forEach(item => {
    statusData[item._id] = item.count;
  });
  
  // Count verifications by month
  const monthlyVerifications = await Donation.aggregate([
    { $match: { verifiedBy: req.user.id } },
    {
      $group: {
        _id: {
          year: { $year: "$verificationDate" },
          month: { $month: "$verificationDate" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
  
  // Format monthly data
  const monthlyData = monthlyVerifications.map(item => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count
  }));
  
  // Count by blood group
  const bloodGroupData = await Donation.aggregate([
    { $match: { verifiedBy: req.user.id } },
    { $group: { _id: "$bloodGroup", count: { $sum: 1 } } }
  ]);
  
  // Format blood group data
  const bloodGroups = bloodGroupData.map(item => ({
    bloodGroup: item._id,
    count: item.count
  }));
  
  res.status(200).json({
    success: true,
    data: {
      totalVerifications: statusCounts.reduce((acc, curr) => acc + curr.count, 0),
      verified: statusData.verified || 0,
      rejected: statusData.rejected || 0,
      monthlyData,
      bloodGroups
    }
  });
});