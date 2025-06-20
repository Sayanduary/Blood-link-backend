import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

// Import your controller functions here
import {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  logout,
  verifyEmail,
  resendVerification
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login a user
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', protect, getCurrentUser);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiate forgot password process
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset user password
 * @access  Public
 */
router.post('/reset-password', resetPassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (optional, if you use tokens in cookies)
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user email
 * @access  Public
 */
router.get('/verify-email/:token', verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification', protect, resendVerification);

<<<<<<< HEAD
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

=======
export default router;
>>>>>>> 6fc9fd49b651160fbbdb181994397f8b259b82c2
