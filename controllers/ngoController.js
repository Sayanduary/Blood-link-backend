import User from '../models/User.js';
import Blog from '../models/Blog.js';
import Camp from '../models/Camp.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * Get NGO profile
 * @route GET /api/ngos/:id
 * @access Public
 */
export const getNgoProfile = asyncHandler(async (req, res) => {
  const ngo = await User.findById(req.params.id)
    .select('-password -resetPasswordToken -resetPasswordExpires -fcmToken');
  
  if (!ngo || ngo.role !== 'ngo') {
    throw new AppError('NGO not found', 404);
  }
  
  // Get blog and camp counts
  const blogCount = await Blog.countDocuments({ author: ngo._id });
  const campCount = await Camp.countDocuments({ organizer: ngo._id });
  
  // Get upcoming camps
  const upcomingCamps = await Camp.find({
    organizer: ngo._id,
    status: { $in: ['upcoming', 'ongoing'] }
  }).sort({ startDate: 1 }).limit(3);
  
  // Get recent blogs
  const recentBlogs = await Blog.find({
    author: ngo._id,
    status: 'published'
  }).sort({ createdAt: -1 }).limit(3);
  
  res.status(200).json({
    success: true,
    data: {
      ngo,
      stats: {
        blogCount,
        campCount
      },
      upcomingCamps,
      recentBlogs
    }
  });
});

/**
 * Update NGO profile
 * @route PUT /api/ngos/profile
 * @access Private (NGO only)
 */
export const updateNgoProfile = asyncHandler(async (req, res) => {
  const { 
    name, 
    phone, 
    address, 
    ngoName,
    location
  } = req.body;
  
  const ngo = await User.findById(req.user.id);
  
  if (!ngo || ngo.role !== 'ngo') {
    throw new AppError('NGO not found', 404);
  }
  
  // Update fields if provided
  if (name) ngo.name = name;
  if (phone) ngo.phone = phone;
  if (address) ngo.address = address;
  if (ngoName) ngo.ngoName = ngoName;
  if (location) ngo.location = location;
  
  ngo.updatedAt = new Date();
  await ngo.save();
  
  // Remove password from response
  const ngoResponse = { ...ngo._doc };
  delete ngoResponse.password;
  
  res.status(200).json({
    success: true,
    message: 'NGO profile updated successfully',
    data: ngoResponse
  });
});

/**
 * Get NGO statistics
 * @route GET /api/ngos/stats
 * @access Private (NGO only)
 */
export const getNgoStats = asyncHandler(async (req, res) => {
  // Count blogs
  const blogCount = await Blog.countDocuments({ author: req.user.id });
  
  // Count camps
  const campCount = await Camp.countDocuments({ organizer: req.user.id });
  
  // Count camps by status
  const campStatusCounts = await Camp.aggregate([
    { $match: { organizer: req.user.id } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  
  // Format camp status counts
  const campStatusData = {};
  campStatusCounts.forEach(item => {
    campStatusData[item._id] = item.count;
  });
  
  // Count blog views
  const totalBlogViews = await Blog.aggregate([
    { $match: { author: req.user.id } },
    { $group: { _id: null, totalViews: { $sum: "$views" } } }
  ]);
  
  // Count monthly camps
  const monthlyCamps = await Camp.aggregate([
    { $match: { organizer: req.user.id } },
    {
      $group: {
        _id: {
          year: { $year: "$startDate" },
          month: { $month: "$startDate" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
  
  // Format monthly camp data
  const monthlyCampData = monthlyCamps.map(item => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count
  }));
  
  // Count monthly blog posts
  const monthlyBlogs = await Blog.aggregate([
    { $match: { author: req.user.id } },
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
  
  // Format monthly blog data
  const monthlyBlogData = monthlyBlogs.map(item => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count
  }));
  
  res.status(200).json({
    success: true,
    data: {
      totalBlogs: blogCount,
      totalCamps: campCount,
      totalBlogViews: totalBlogViews[0]?.totalViews || 0,
      campStatusData,
      monthlyCampData,
      monthlyBlogData
    }
  });
});