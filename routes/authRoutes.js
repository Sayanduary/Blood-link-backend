import express from 'express';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { generateToken, verifyToken } from '../utils/tokenUtils.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register new user
 * @access Public
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !password || !role) {
    throw new AppError('Please provide all required fields', 400);
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    throw new AppError('User already exists with this email', 409);
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const token = generateToken(user._id, user.role);

  res.status(201).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    token
  });
}));

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403);
  }

  const token = generateToken(user._id, user.role);

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    token
  });
}));

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.status(200).json({
    success: true,
    user
  });
}));

/**
 * @route POST /api/auth/forgot-password
 * @desc Send password reset link
 * @access Public
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('Email is required', 400);

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('No user found with this email', 404);
  }

  // Generate token
  const resetToken = generateToken(user._id, user.role, '30m', 'reset');
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  await user.save();

  // Email sending logic should be here (see utils/notify.js)
  // For now, just return token for demo
  res.status(200).json({
    success: true,
    message: 'Password reset link sent',
    resetToken
  });
}));

/**
 * @route POST /api/auth/reset-password
 * @desc Reset user password
 * @access Public
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    throw new AppError('Token and new password are required', 400);
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'reset') {
    throw new AppError('Invalid or expired reset token', 400);
  }

  const user = await User.findById(decoded.id).select('+password');
  if (!user || !user.resetPasswordToken || user.resetPasswordToken !== token) {
    throw new AppError('Invalid or expired reset token', 400);
  }
  if (user.resetPasswordExpires < Date.now()) {
    throw new AppError('Reset token has expired', 400);
  }

  user.password = newPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successful'
  });
}));

export default router;